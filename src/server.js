import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Database setup
async function setupDatabase() {
  const dbPath = path.resolve(__dirname, 'services/politicaldata.db');
  
  // Check if file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file does not exist at: ${dbPath}`);
    throw new Error(`Database file not found at: ${dbPath}`);
  }
  
  //console.log(`Database file exists at: ${dbPath}`);
  
  try {
    // Open the database connection with consistent configuration
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Verify connection by running a simple query
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
    //console.log(`Available tables: ${tables.map(t => t.name).join(', ')}`);
    
    return db;
  } catch (error) {
    console.error('Error opening database:', error);
    throw error;
  }
}

// Helper function to run Python code and get the result
async function runPythonFunction(functionName, args = []) {
  return new Promise((resolve, reject) => {
    // Create a Python script that imports and calls the function
    const pythonCode = `
import sys
import json
sys.path.append('${path.resolve(__dirname, 'services')}')
from candidate_functions import ${functionName}

try:
    # Call the function with the provided arguments
    result = ${functionName}(${args.map(arg => JSON.stringify(arg)).join(', ')})
    # Print the result as JSON
    print(json.dumps(result))
except Exception as e:
    # Print error message
    print(json.dumps({"error": str(e)}))
`;

    // Run the Python code
    const pythonProcess = spawn('python', ['-c', pythonCode]);
    
    let resultData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error('Error:', errorData);
        reject(new Error(`Python process failed: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData);
        if (result && result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${resultData}`));
      }
    });
  });
}

// API Routes
app.get('/api/senators', async (req, res) => {
  let db;
  try {
    console.log('Setting up database connection for /api/senators');
    db = await setupDatabase();
    
    console.log('Executing query to get senators');
    const senators = await db.all('SELECT * FROM senate');
    
    console.log(`Successfully retrieved ${senators.length} senators`);
    
    // Parse the phones JSON string
    const formattedSenators = senators.map(senator => ({
      ...senator,
      photoUrl: senator.photoUrl || 'https://i.imgur.com/VlKTQWO.png',
      phones: JSON.parse(senator.phones || '[]')
    }));
    
    res.json(formattedSenators);
  } catch (error) {
    console.error('Error fetching senators:', error);
    
    // Check for specific error types and provide more detailed response
    if (error.code === 'SQLITE_CANTOPEN') {
      res.status(500).json({ 
        error: 'Database not found or cannot be opened', 
        details: error.message,
        path: error.path 
      });
    } else if (error.code === 'SQLITE_ERROR') {
      res.status(500).json({ 
        error: 'SQL query error', 
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch senators', 
        details: error.message 
      });
    }
  } finally {
    if (db) {
      try {
        await db.close();
        console.log('Database connection closed');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
});

// Industry contributions endpoint
app.get('/api/industry-contributions/:industry', async (req, res) => {
  let db;
  try {
    const { industry } = req.params;
    db = await setupDatabase();
    console.log(`Fetching contributions for industry: ${industry}`);
    
    // Industry classification logic from contribute.py
    const industryKeywords = {
      'Pharmaceuticals': ['health', 'pharmaceutical', 'drugs', 'medical', 'pharma', 'medicine', 'healthcare'],
      'Military & Defense': ['defense', 'military', 'army', 'navy', 'lockheed', 'marine', 'force', 'security'],
      'Insurance': ['insurance', 'finance', 'fund', 'financial', 'capital', 'invest', 'bank'],
      'Oil & Gas': ['energy', 'oil', 'gas', 'petroleum', 'pipeline', 'drill', 'fuel'],
      'Electronics & Tech': ['tech', 'electronics', 'digital', 'communications', 'google', 'facebook', 'meta', 'software']
    };
    
    // Get keywords for the selected industry
    const keywords = industryKeywords[industry] || [industry.toLowerCase()];
    
    // Build LIKE clauses for each keyword
    const whereClauses = keywords.map(() => 'LOWER(cc.contributor_name) LIKE ?').join(' OR ');
    const params = keywords.map(keyword => `%${keyword.toLowerCase()}%`);
    
    // First, get all contributions that match the industry
    const contributionsQuery = `
      SELECT 
        cc.candidate_id, 
        cc.contributor_name, 
        cc.amount
      FROM 
        contributorsFromCommittees cc 
      WHERE 
        (${whereClauses})
        AND cc.entity_type != 'IND' -- Skip individual contributors (from contribute.py)
    `;
    
    console.log('Fetching all industry contributions');
    const industryContributions = await db.all(contributionsQuery, params);
    
    // Group by senator and sum amounts
    const senatorContributions = {};
    
    for (const contribution of industryContributions) {
      const { candidate_id, contributor_name, amount } = contribution;
      
      if (!senatorContributions[candidate_id]) {
        senatorContributions[candidate_id] = {
          candidate_id,
          total: 0,
          contributors: {}
        };
      }
      
      senatorContributions[candidate_id].total += amount;
      
      // Track top contributors
      if (!senatorContributions[candidate_id].contributors[contributor_name]) {
        senatorContributions[candidate_id].contributors[contributor_name] = 0;
      }
      senatorContributions[candidate_id].contributors[contributor_name] += amount;
    }
    
    // Convert to array and sort by total amount
    const sortedSenators = Object.values(senatorContributions)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // Top 20 senators
    
    // Get senator details from the candidates table first, then senate table as fallback
    const results = [];
    
    for (const senator of sortedSenators) {
      try {
        // Always try to get candidate name from candidates table first
        const candidateInfo = await db.get(
          'SELECT CAND_NAME as name, PTY_CD, CAND_PTY_AFFILIATION, CAND_OFFICE_ST as state FROM candidates WHERE CAND_ID = ?',
          senator.candidate_id
        );
        
        // Find top contributor
        const topContributor = Object.entries(senator.contributors)
          .sort((a, b) => b[1] - a[1])[0];
        
        if (candidateInfo) {
          console.log(`Found candidate ${senator.candidate_id} in candidates table`);
          
          results.push({
            name: candidateInfo.name,
            party: getFullPartyName(candidateInfo.PTY_CD, candidateInfo.CAND_PTY_AFFILIATION),
            state: candidateInfo.state,
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: senator.total,
            candidate_id: senator.candidate_id // Include the ID for lookups
          });
        } else {
          // Fallback if not found in candidates table - try the candidates_master table
          console.log(`Looking up name in candidates_master for ID: ${senator.candidate_id}`);
          
          const masterCandidate = await db.get(
            'SELECT CAND_NAME, CAND_PTY_AFFILIATION FROM candidates_master WHERE CAND_ID = ?',
            [senator.candidate_id]
          );
          
          console.log(`candidates_master query result for ${senator.candidate_id}:`, masterCandidate);
          
          if (masterCandidate && masterCandidate.CAND_NAME) {
            results.push({
              name: masterCandidate.CAND_NAME,
              party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
              state: 'Unknown',
              contributor_name: topContributor ? topContributor[0] : 'Unknown',
              amount: senator.total,
              candidate_id: senator.candidate_id
            });
          } else {
            // If still not found, use the direct SQL query as last resort
            const candidateNameQuery = `SELECT CAND_NAME FROM candidates WHERE CAND_ID = '${senator.candidate_id}'`;
            const candidateName = await db.get(candidateNameQuery);
            
            results.push({
              name: candidateName && candidateName.CAND_NAME ? candidateName.CAND_NAME : `Candidate ${senator.candidate_id}`,
              party: 'Unknown',
              state: 'Unknown',
              contributor_name: topContributor ? topContributor[0] : 'Unknown',
              amount: senator.total,
              candidate_id: senator.candidate_id
            });
          }
        }
      } catch (error) {
        console.error(`Error processing candidate ${senator.candidate_id}:`, error);
        
        // Error fallback
        const topContributor = Object.entries(senator.contributors)
          .sort((a, b) => b[1] - a[1])[0];
        
        // Try to get the name from candidates_master first
        const masterCandidate = await db.get(
          'SELECT CAND_NAME, CAND_PTY_AFFILIATION FROM candidates_master WHERE CAND_ID = ?',
          [senator.candidate_id]
        );
        
        if (masterCandidate && masterCandidate.CAND_NAME) {
          results.push({
            name: masterCandidate.CAND_NAME,
            party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
            state: 'Unknown',
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: senator.total,
            candidate_id: senator.candidate_id
          });
        } else {
          // Fall back to the existing approach
          const candidateNameQuery = `SELECT CAND_NAME FROM candidates WHERE CAND_ID = '${senator.candidate_id}'`;
          const candidateName = await db.get(candidateNameQuery);
          
          results.push({
            name: candidateName && candidateName.CAND_NAME ? candidateName.CAND_NAME : `Candidate ${senator.candidate_id}`,
            party: 'Unknown',
            state: 'Unknown',
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: senator.total,
            candidate_id: senator.candidate_id
          });
        }
      }
    }
    
    console.log(`Found ${results.length} senators who received ${industry} contributions`);
    res.json(results);
    
  } catch (error) {
    console.error(`Error fetching ${req.params.industry} contributions:`, error);
    res.status(500).json({ error: 'Failed to fetch industry contributions', details: error.message });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// New endpoint to get candidate info directly
app.get('/api/candidate/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidateInfo = await runPythonFunction('candidate_info', [candidateId]);
    
    if (!candidateInfo) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    res.json(candidateInfo);
  } catch (error) {
    console.error('Error fetching candidate info:', error);
    res.status(500).json({ error: 'Failed to fetch candidate info', details: error.message });
  }
});

// New endpoint to get candidate name
app.get('/api/candidate/name/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    
    // First check if we have this candidate in our database
    const db = await setupDatabase();
    const candidateFromDb = await db.get('SELECT name FROM senate WHERE id = ?', candidateId);
    
    if (candidateFromDb && candidateFromDb.name) {
      return res.json({ name: candidateFromDb.name });
    }
    
    // If not in DB, try the Python function
    try {
      const result = await runPythonFunction('get_candidate_name', [candidateId]);
      if (result) {
        return res.json({ name: result });
      }
    } catch (pythonError) {
      console.error(`Python error for candidate ${candidateId}:`, pythonError);
      // Continue to fallback
    }
    
    // Fallback - return formatted candidate ID
    return res.json({ name: `Candidate ${candidateId}` });
  } catch (error) {
    console.error('Error fetching candidate name:', error);
    res.status(500).json({ error: 'Failed to fetch candidate name' });
  }
});

// New endpoint to get candidate information from our database
app.get('/api/candidate-info/:candidateId', async (req, res) => {
  let db;
  try {
    const { candidateId } = req.params;
    console.log(`Fetching candidate info for ID: ${candidateId}`);
    
    db = await setupDatabase();
    
    // Try to find candidate in candidates table
    const candidate = await db.get(
      'SELECT * FROM candidates WHERE CAND_ID = ?',
      candidateId
    );
    
    if (candidate) {
      console.log(`Found candidate ${candidateId} in candidates table`);
      
      // Transform data to a more friendly format
      const formattedCandidate = {
        id: candidate.CAND_ID,
        name: candidate.CAND_NAME,
        party: getFullPartyName(candidate.PTY_CD, candidate.CAND_PTY_AFFILIATION),
        state: candidate.CAND_OFFICE_ST,
        district: candidate.CAND_OFFICE_DISTRICT,
        totalReceipts: candidate.TTL_RECEIPTS,
        totalDisbursements: candidate.TTL_DISB,
        cashOnHand: candidate.COH_COP,
        debtsOwed: candidate.DEBTS_OWED_BY,
        individualContributions: candidate.TTL_INDIV_CONTRIB,
        coverageEndDate: candidate.CVG_END_DT
      };
      
      return res.json(formattedCandidate);
    }
    
    // If not found in candidates table, try candidates_master table
    const masterCandidate = await db.get(
      'SELECT CAND_ID, CAND_NAME, CAND_PTY_AFFILIATION FROM candidates_master WHERE CAND_ID = ?',
      candidateId
    );
    
    if (masterCandidate) {
      console.log(`Found candidate ${candidateId} in candidates_master table`);
      return res.json({
        id: masterCandidate.CAND_ID,
        name: masterCandidate.CAND_NAME,
        party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
        state: 'Unknown'
      });
    }
    
    // If not found in candidates_master, try senate table as backup
    const senatorData = await db.get(
      'SELECT id, name, party, state FROM senate WHERE id = ?',
      candidateId
    );
    
    if (senatorData) {
      console.log(`Found candidate ${candidateId} in senate table`);
      return res.json({
        id: senatorData.id,
        name: senatorData.name,
        party: senatorData.party,
        state: senatorData.state
      });
    }
    
    // If both options fail, return 404
    console.log(`Candidate ${candidateId} not found in any table`);
    res.status(404).json({ error: 'Candidate not found' });
  } catch (error) {
    console.error('Error fetching candidate info from database:', error);
    res.status(500).json({ error: 'Failed to fetch candidate info', details: error.message });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Add a debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    // Test database connection and return detailed info
    const dbPath = path.resolve(__dirname, 'services/politicaldata.db');
    const stats = fs.statSync(dbPath);
    
    const diagnosticInfo = {
      database: {
        path: dbPath,
        exists: fs.existsSync(dbPath),
        size: stats.size,
        permissions: {
          read: fs.accessSync(dbPath, fs.constants.R_OK) === undefined,
          write: fs.accessSync(dbPath, fs.constants.W_OK) === undefined
        },
        mtime: stats.mtime
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        dirname: __dirname
      }
    };
    
    // Try to connect to the database and get tables
    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
      diagnosticInfo.database.tables = tables.map(t => t.name);
      
      // Try to query the senate table
      try {
        const senateCount = await db.get('SELECT COUNT(*) as count FROM senate');
        diagnosticInfo.database.senateTableRows = senateCount.count;
        
        const senateSchema = await db.all("PRAGMA table_info('senate')");
        diagnosticInfo.database.senateTableSchema = senateSchema;
        
        const sampleRows = await db.all('SELECT * FROM senate LIMIT 1');
        diagnosticInfo.database.sampleRow = sampleRows[0];
      } catch (senateError) {
        diagnosticInfo.database.senateTableError = senateError.message;
      }
      
      await db.close();
    } catch (dbError) {
      diagnosticInfo.database.connectionError = dbError.message;
    }
    
    res.json(diagnosticInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Add a debug endpoint to inspect candidates table
app.get('/api/debug-candidates', async (req, res) => {
  let db;
  try {
    db = await setupDatabase();
    
    // Get a sample of candidate records
    const candidateSample = await db.all('SELECT * FROM candidates LIMIT 10');
    
    // Get count of candidates
    const countResult = await db.get('SELECT COUNT(*) as count FROM candidates');
    
    // Get table structure
    const tableInfo = await db.all("PRAGMA table_info('candidates')");
    
    res.json({
      sample: candidateSample,
      count: countResult.count,
      tableStructure: tableInfo
    });
  } catch (error) {
    console.error('Error inspecting candidates table:', error);
    res.status(500).json({ 
      error: 'Failed to inspect candidates table', 
      details: error.message 
    });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Add a debug endpoint to check a specific candidate ID
app.get('/api/debug-candidate/:candidateId', async (req, res) => {
  let db;
  try {
    const { candidateId } = req.params;
    db = await setupDatabase();
    
    // Check if the candidate exists with direct query
    const directQuery = `SELECT * FROM candidates WHERE CAND_ID = '${candidateId}'`;
    const candidateRecord = await db.get(directQuery);
    
    // Check with parameterized query
    const paramQuery = await db.get(
      'SELECT * FROM candidates WHERE CAND_ID = ?',
      candidateId
    );
    
    // Check with exact column selection
    const nameOnlyQuery = await db.get(
      'SELECT CAND_NAME FROM candidates WHERE CAND_ID = ?',
      candidateId
    );
    
    res.json({
      candidateId,
      directQuery: {
        sql: directQuery,
        result: candidateRecord
      },
      paramQuery: {
        result: paramQuery
      },
      nameOnlyQuery: {
        result: nameOnlyQuery
      }
    });
  } catch (error) {
    console.error(`Error checking candidate ID ${req.params.candidateId}:`, error);
    res.status(500).json({ 
      error: 'Failed to check candidate ID', 
      details: error.message 
    });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Add a debug endpoint for the candidates_master table
app.get('/api/debug-candidates-master', async (req, res) => {
  let db;
  try {
    db = await setupDatabase();
    
    // Get a sample of master candidate records
    const candidateSample = await db.all('SELECT * FROM candidates_master LIMIT 10');
    
    // Get count of master candidates
    const countResult = await db.get('SELECT COUNT(*) as count FROM candidates_master');
    
    // Get table structure
    const tableInfo = await db.all("PRAGMA table_info('candidates_master')");
    
    res.json({
      sample: candidateSample,
      count: countResult.count,
      tableStructure: tableInfo
    });
  } catch (error) {
    console.error('Error inspecting candidates_master table:', error);
    res.status(500).json({ 
      error: 'Failed to inspect candidates_master table', 
      details: error.message 
    });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Helper function to get full party name
function getFullPartyName(partyCode, partyAffiliation) {
  if (partyAffiliation && partyAffiliation !== '') {
    return partyAffiliation;
  }
  
  const partyCodes = {
    '1': 'Democrat',
    '2': 'Republican',
    '3': 'Independent',
    'DEM': 'Democrat',
    'REP': 'Republican',
    'IND': 'Independent',
    'GRE': 'Green',
    'LIB': 'Libertarian',
    'NPA': 'No Party Affiliation'
  };
  
  return partyCodes[partyCode] || 'Unknown';
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Function to create and populate the candidates-master table
async function setupCandidatesMasterTable() {
  let db;
  try {
    db = await setupDatabase();
    
    // Create the candidates-master table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS candidates_master (
        CAND_ID TEXT PRIMARY KEY,
        CAND_NAME TEXT,
        CAND_PTY_AFFILIATION TEXT
      )
    `);
    
    // Check if the table already has data
    const countResult = await db.get('SELECT COUNT(*) as count FROM candidates_master');
    if (countResult.count > 0) {
      console.log(`candidates_master table already contains ${countResult.count} records. Skipping import.`);
      return;
    }
    
    // Check and verify file paths
    console.log('Current directory:', __dirname);
    
    // File paths for candidate data
    const candidateFiles = [
      './assets/data/cand/cn-21.txt',
      './assets/data/cand/cn-23.txt'
    ];
    
    // Read the header file to get column indices
    const headerPath = path.resolve(__dirname, './assets/data/cand/cn_header_file.csv');
    console.log('Looking for header file at:', headerPath);
    
    if (!fs.existsSync(headerPath)) {
      throw new Error(`Header file not found at: ${headerPath}`);
    }
    
    const headerContent = fs.readFileSync(headerPath, 'utf8');
    const headerFields = headerContent.trim().split(',');
    console.log('Header fields:', headerFields);
    
    // Find indices for the fields we need
    const idIndex = headerFields.indexOf('CAND_ID');
    const nameIndex = headerFields.indexOf('CAND_NAME');
    const partyIndex = headerFields.indexOf('CAND_PTY_AFFILIATION');
    
    if (idIndex === -1 || nameIndex === -1 || partyIndex === -1) {
      throw new Error('Required header fields not found in header file');
    }
    
    let totalRecords = 0;
    
    // Process each candidate file
    for (const relativeFilePath of candidateFiles) {
      const fullPath = path.resolve(__dirname, relativeFilePath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Candidate file not found: ${fullPath}`);
        continue;
      }
      
      console.log(`Reading candidate data from: ${fullPath}`);
      
      // Read and parse the file
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const lines = fileContents.trim().split('\n');
      
      console.log(`Found ${lines.length} candidate records in ${relativeFilePath}`);
      
      // Begin a transaction for faster inserts
      await db.exec('BEGIN TRANSACTION');
      
      // Process each line
      for (const line of lines) {
        const fields = line.split('|');
        
        if (fields.length <= Math.max(idIndex, nameIndex, partyIndex)) {
          console.warn('Skipping line with insufficient fields');
          continue;
        }
        
        const candidateId = fields[idIndex];
        const candidateName = fields[nameIndex];
        const partyAffiliation = fields[partyIndex];
        
        // Skip if any required field is missing
        if (!candidateId || !candidateName) {
          continue;
        }
        
        // Check if the candidate already exists
        const existing = await db.get('SELECT 1 FROM candidates_master WHERE CAND_ID = ?', candidateId);
        
        if (!existing) {
          // Insert into the table
          await db.run(
            'INSERT INTO candidates_master (CAND_ID, CAND_NAME, CAND_PTY_AFFILIATION) VALUES (?, ?, ?)',
            [candidateId, candidateName, partyAffiliation || '']
          );
          
          totalRecords++;
        }
      }
      
      // Commit the transaction
      await db.exec('COMMIT');
    }
    
    console.log(`Successfully imported ${totalRecords} candidate records to candidates_master table`);
    
  } catch (error) {
    console.error('Error setting up candidates_master table:', error);
    if (db) {
      await db.exec('ROLLBACK');
    }
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Create the new table when the server starts
setupCandidatesMasterTable()
  .then(() => console.log('Candidates master table setup complete'))
  .catch(err => console.error('Failed to set up candidates master table:', err)); 