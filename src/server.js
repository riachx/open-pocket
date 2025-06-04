import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// API Key middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.CONGRESS_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  next();
};

// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173', // or whatever port your frontend runs on
  credentials: true
}));

const PORT = process.env.PORT || 3001;
// Serve images from the 'images' folder (adjust path to your actual images folder)
const imagesPath = path.join(__dirname, '../public/images');
console.log('__dirname:', __dirname);

app.use('/images', express.static(imagesPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
console.log('Server file loaded3')

// Add middleware to parse JSON bodies
app.use(express.json());

// Apply API key validation only to endpoints that need Congress.gov API
app.use('/api/congressman/*', validateApiKey);
app.use('/api/politician/*', validateApiKey);

app.get('/api/members', async (req, res) => {
  let db;
  try {
    console.log('Setting up database connection for /api/members');
    db = await setupDatabase();
    console.log('Database connection established');

    // Add logging to see what's in the database
    console.log('Executing query to get congressmen');
    const members = await db.all('SELECT id, name, state, party, chamber, congress, image FROM congressmen'); 
    console.log(`Found ${members.length} congressmen in database`);
    

    res.json(members);
  } catch (error) {
    console.error('Error in /api/members:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    });
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

// Add this new endpoint
app.get('/api/congressman/:id', async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    console.log('Fetching congressman with ID:', id);
    
    db = await setupDatabase();
    
    // Add logging to see the query result
    const congressman = await db.get(
      'SELECT id, name, state, party, chamber, congress, image, bioguide_id FROM congressmen WHERE id = ?',
      [id]
    );
    
    
    
    if (!congressman) {
      console.log('Congressman not found in database');
      return res.status(404).json({ error: 'Congressman not found' });
    }
    
    // Format the response to match the Congressman interface
    const formattedCongressman = {
      id: congressman.id,
      name: congressman.name,
      state: congressman.state,
      party: congressman.party,
      chamber: congressman.chamber,
      image: congressman.image,
      congress: congressman.congress,
      bioguide_id: congressman.bioguide_id
    };
    
    
    res.json(formattedCongressman);
  } catch (error) {
    console.error('Error fetching congressman:', error);
    res.status(500).json({ 
      error: 'Failed to fetch congressman', 
      details: error.message 
    });
  } finally {
    if (db) {
      await db.close();
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
        AND cc.entity_type != 'IND' -- Skip individual contributors
    `;
    
    console.log('Fetching all industry contributions');
    const industryContributions = await db.all(contributionsQuery, params);
    
    // Group by congressman and sum amounts
    const congressmanContributions = {};
    
    for (const contribution of industryContributions) {
      const { candidate_id, contributor_name, amount } = contribution;
      
      if (!congressmanContributions[candidate_id]) {
        congressmanContributions[candidate_id] = {
          candidate_id,
          total: 0,
          contributors: {}
        };
      }
      
      congressmanContributions[candidate_id].total += amount;
      
      // Track top contributors
      if (!congressmanContributions[candidate_id].contributors[contributor_name]) {
        congressmanContributions[candidate_id].contributors[contributor_name] = 0;
      }
      congressmanContributions[candidate_id].contributors[contributor_name] += amount;
    }
    
    // Convert to array and sort by total amount
    const sortedCongressmen = Object.values(congressmanContributions)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // Top 20 congressmen
    
    // Get congressman details from the candidates table first, then congressmen table as fallback
    const results = [];
    
    for (const congressman of sortedCongressmen) {
      try {
        // Always try to get candidate name from candidates table first
        const candidateInfo = await db.get(
          'SELECT CAND_NAME as name, PTY_CD, CAND_PTY_AFFILIATION, CAND_OFFICE_ST as state FROM candidates WHERE CAND_ID = ?',
          congressman.candidate_id
        );
        
        // Find top contributor
        const topContributor = Object.entries(congressman.contributors)
          .sort((a, b) => b[1] - a[1])[0];
        
        if (candidateInfo) {
          
          
          results.push({
            name: candidateInfo.name,
            party: getFullPartyName(candidateInfo.PTY_CD, candidateInfo.CAND_PTY_AFFILIATION),
            state: candidateInfo.state,
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: congressman.total,
            candidate_id: congressman.candidate_id
          });
        } else {
          // Fallback if not found in candidates table - try the candidates_master table
          console.log(`Looking up name in candidates_master for ID: ${congressman.candidate_id}`);
          
          const masterCandidate = await db.get(
            'SELECT CAND_NAME, CAND_PTY_AFFILIATION FROM candidates_master WHERE CAND_ID = ?',
            [congressman.candidate_id]
          );
          
          console.log(`candidates_master query result for ${congressman.candidate_id}:`, masterCandidate);
          
          if (masterCandidate && masterCandidate.CAND_NAME) {
            results.push({
              name: masterCandidate.CAND_NAME,
              party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
              state: 'Unknown',
              contributor_name: topContributor ? topContributor[0] : 'Unknown',
              amount: congressman.total,
              candidate_id: congressman.candidate_id
            });
          } else {
            // If still not found, use the direct SQL query as last resort
            const candidateNameQuery = `SELECT CAND_NAME FROM candidates WHERE CAND_ID = '${congressman.candidate_id}'`;
            const candidateName = await db.get(candidateNameQuery);
            
            results.push({
              name: candidateName && candidateName.CAND_NAME ? candidateName.CAND_NAME : `Candidate ${congressman.candidate_id}`,
              party: 'Unknown',
              state: 'Unknown',
              contributor_name: topContributor ? topContributor[0] : 'Unknown',
              amount: congressman.total,
              candidate_id: congressman.candidate_id
            });
          }
        }
      } catch (error) {
        console.error(`Error processing candidate ${congressman.candidate_id}:`, error);
        
        // Error fallback
        const topContributor = Object.entries(congressman.contributors)
          .sort((a, b) => b[1] - a[1])[0];
        
        // Try to get the name from candidates_master first
        const masterCandidate = await db.get(
          'SELECT CAND_NAME, CAND_PTY_AFFILIATION FROM candidates_master WHERE CAND_ID = ?',
          [congressman.candidate_id]
        );
        
        if (masterCandidate && masterCandidate.CAND_NAME) {
          results.push({
            name: masterCandidate.CAND_NAME,
            party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
            state: 'Unknown',
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: congressman.total,
            candidate_id: congressman.candidate_id
          });
        } else {
          // Fall back to the existing approach
          const candidateNameQuery = `SELECT CAND_NAME FROM candidates WHERE CAND_ID = '${congressman.candidate_id}'`;
          const candidateName = await db.get(candidateNameQuery);
          
          results.push({
            name: candidateName && candidateName.CAND_NAME ? candidateName.CAND_NAME : `Candidate ${congressman.candidate_id}`,
            party: 'Unknown',
            state: 'Unknown',
            contributor_name: topContributor ? topContributor[0] : 'Unknown',
            amount: congressman.total,
            candidate_id: congressman.candidate_id
          });
        }
      }
    }
    
    console.log(`Found ${results.length} congressmen who received ${industry} contributions`);
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

// Add endpoint to get candidate information from our database
app.get('/api/candidate-info/:candidateId', async (req, res) => {
  let db;
  try {
    const { candidateId } = req.params;
    
    
    db = await setupDatabase();
    
    // Try to find candidate in candidates table
    const candidate = await db.get(
      'SELECT * FROM candidates WHERE CAND_ID = ?',
      candidateId
    );
    
    if (candidate) {
      
      
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
      
      return res.json({
        id: masterCandidate.CAND_ID,
        name: masterCandidate.CAND_NAME,
        party: getFullPartyName(null, masterCandidate.CAND_PTY_AFFILIATION),
        state: 'Unknown'
      });
    }
    
    // If not found in candidates_master, try congressmen table as backup
    const congressmanData = await db.get(
      'SELECT id, name, party, state FROM congressmen WHERE id = ?',
      candidateId
    );
    
    if (congressmanData) {
      
      return res.json({
        id: congressmanData.id,
        name: congressmanData.name,
        party: congressmanData.party,
        state: congressmanData.state
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

// Add a debug endpoint to check contributors table
app.get('/api/debug-contributors', async (req, res) => {
  let db;
  try {
    db = await setupDatabase();
    
    // Check if the table exists
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='contributorsFromCommittees'"
    );
    
    if (!tableExists) {
      return res.json({
        error: 'Table does not exist',
        tables: await db.all("SELECT name FROM sqlite_master WHERE type='table'")
      });
    }
    
    // Get table structure
    const tableInfo = await db.all("PRAGMA table_info('contributorsFromCommittees')");
    
    // Get sample data
    const sampleData = await db.all("SELECT * FROM contributorsFromCommittees LIMIT 10");
    
    // Get count
    const countResult = await db.get("SELECT COUNT(*) as count FROM contributorsFromCommittees");
    
    res.json({
      tableExists: true,
      structure: tableInfo,
      sampleData,
      count: countResult.count
    });
  } catch (error) {
    console.error('Error checking contributors table:', error);
    res.status(500).json({ 
      error: 'Failed to check contributors table', 
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

// Special debug endpoint for Tim Scott's contributions
app.get('/api/tim-scott-debug', async (req, res) => {
  let db;
  try {
    console.log('Executing Tim Scott debug endpoint');
    
    db = await setupDatabase();
    
    // Directly query using the known FEC ID
    const contributions = await db.all(`
      SELECT 
        CMTE_ID, NAME, ENTITY_TP, TRANSACTION_AMT, TRANSACTION_DT
      FROM 
        contributorsFromCommittees
      WHERE 
        CAND_ID = 'S4SC00240' 
        AND ENTITY_TP != 'IND'
      ORDER BY 
        TRANSACTION_AMT DESC
      LIMIT 50
    `);
    
    console.log(`Direct query found ${contributions.length} contributions`);
    
    // Format the contributions for the frontend
    const formattedContributions = contributions.map(contrib => {
      return {
        name: contrib.NAME || contrib.CMTE_ID || 'Unknown',
        entity_type: contrib.ENTITY_TP || 'Unknown',
        total_amount: parseFloat(contrib.TRANSACTION_AMT) || 0,
        transaction_count: 1,
        transaction_date: contrib.TRANSACTION_DT,
        raw: contrib // Include raw data for debugging
      };
    });
    
    // Group by contributor name and sum amounts
    const contributionsByCommittee = {};
    
    for (const contrib of formattedContributions) {
      if (!contributionsByCommittee[contrib.name]) {
        contributionsByCommittee[contrib.name] = {
          name: contrib.name,
          entity_type: contrib.entity_type,
          total_amount: 0,
          transaction_count: 0
        };
      }
      
      contributionsByCommittee[contrib.name].total_amount += contrib.total_amount;
      contributionsByCommittee[contrib.name].transaction_count += 1;
    }
    
    // Convert to array and sort by amount
    const result = Object.values(contributionsByCommittee)
      .sort((a, b) => b.total_amount - a.total_amount);
    
    // Debug info
    const debugInfo = {
      dbPath: path.resolve(__dirname, 'services/politicaldata.db'),
      contributionsFound: contributions.length,
      firstContribution: contributions.length > 0 ? contributions[0] : null,
      tables: await db.all("SELECT name FROM sqlite_master WHERE type='table';")
    };
    
    res.json({
      contributions: result,
      debug: debugInfo
    });
    
  } catch (error) {
    console.error('Error in Tim Scott debug endpoint:', error);
    console.error(error.stack);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Add chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }
    
    // Initialize the Google AI client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
    

    const plainTextPrompt = `Respond in plain text only. Do not use markdown formatting like asterisks (*), bold (**), or bullet points. \n\n${message}`;

    
    // Process the message
    const result = await model.generateContent(plainTextPrompt);
    const response = await result.response;
    const text = response.text();
    

    
    res.json({ response: text });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Add GET /api/chat for helpful error message
app.get('/api/chat', (req, res) => {
  res.status(405).json({ error: 'Please use POST with a JSON body { message } to interact with the chat endpoint.' });
}); 

// Add new endpoint for recent votes
app.get('/api/politician/:bioguideId/recent-votes', async (req, res) => {
  try {
    const { bioguideId } = req.params;
    console.log('=== Starting vote fetch for bioguideId:', bioguideId, '===');
    
    // First verify the member exists and get their details
    const memberUrl = `https://api.congress.gov/v3/member?api_key=${process.env.CONGRESS_API_KEY}&format=json&bioguideId=${bioguideId}`;
    console.log('1. Verifying member exists at URL:', memberUrl);
    
    const memberResponse = await fetch(memberUrl);
    const memberData = await memberResponse.json();
    console.log('2. Member verification response:', JSON.stringify(memberData, null, 2));
    
    if (!memberResponse.ok) {
      console.error('3. Member verification failed:', memberResponse.status);
      return res.status(404).json({ 
        error: 'Member not found',
        details: `No member found with bioguide ID: ${bioguideId}`
      });
    }

    // For 119th Congress, we'll check both sessions but limit to recent votes
    const sessions = [2, 1]; // Check session 2 first (more recent), then session 1
    let allVotes = [];
    const MAX_VOTES = 10; // Limit to 10 most recent votes

    for (const session of sessions) {
      if (allVotes.length >= MAX_VOTES) break;
      
      console.log(`4. Checking session ${session} of 119th Congress...`);
      
      // Get recent votes for this session
      const votesUrl = `https://api.congress.gov/v3/house-vote?api_key=${process.env.CONGRESS_API_KEY}&format=json&congress=119&session=${session}&limit=50`;
      console.log('5. Fetching votes from URL:', votesUrl);
      
      const votesResponse = await fetch(votesUrl);
      if (!votesResponse.ok) {
        console.error('6. Failed to fetch votes:', votesResponse.status);
        continue;
      }
      
      const votesData = await votesResponse.json();
      const sessionVotes = votesData.houseRollCallVotes || [];
      console.log(`7. Found ${sessionVotes.length} votes for session ${session}`);
      
      // For each vote, get the member votes and bill information
      const votesWithDetails = await Promise.all(
        sessionVotes.map(async (vote) => {
          // Get member votes - using the correct URL structure
          const memberVotesUrl = `https://api.congress.gov/v3/house-vote/119/${session}/${vote.rollCallNumber}/members?api_key=${process.env.CONGRESS_API_KEY}&format=json&limit=500`;
          console.log('8. Fetching member votes from URL:', memberVotesUrl);
          
          const memberVotesResponse = await fetch(memberVotesUrl);
          if (!memberVotesResponse.ok) {
            console.error(`9. Failed to fetch member votes for vote ${vote.rollCallNumber}:`, memberVotesResponse.status);
            return null;
          }
          
          const memberVotesData = await memberVotesResponse.json();
          console.log(`10. Raw member votes data for vote ${vote.rollCallNumber}:`, JSON.stringify(memberVotesData, null, 2));
          
          // The member votes are in the houseRollCallMemberVotes array
          const results = memberVotesData.houseRollCallMemberVotes?.[0]?.members || [];
          console.log(`11. Vote ${vote.rollCallNumber} - Number of member votes: ${results.length}`);
          console.log('12. Available bioguideIds:', results.map(r => r.bioguideID).join(', '));
          
          // Find this member's vote
          const memberVote = results.find(result => {
            console.log(`13. Comparing ${result.bioguideID} with ${bioguideId}`);
            return result.bioguideID === bioguideId;
          });
          
          if (!memberVote) {
            console.log(`14. No vote found for member ${bioguideId} in vote ${vote.rollCallNumber}`);
            return null;
          }

          console.log(`15. Found vote for member ${bioguideId} in vote ${vote.rollCallNumber}:`, memberVote.voteCast);

          // Get bill information if available
          let billInfo = null;
          if (vote.bill) {
            const billUrl = `https://api.congress.gov/v3/bill/119/${vote.bill.billType}/${vote.bill.billNumber}?api_key=${process.env.CONGRESS_API_KEY}&format=json`;
            const subjectsUrl = `https://api.congress.gov/v3/bill/119/${vote.bill.billType}/${vote.bill.billNumber}/subjects?api_key=${process.env.CONGRESS_API_KEY}&format=json`;
            try {
              const [billResponse, subjectsResponse] = await Promise.all([
                fetch(billUrl),
                fetch(subjectsUrl)
              ]);
              
              if (billResponse.ok) {
                const billData = await billResponse.json();
                billInfo = {
                  title: billData.bill?.title,
                  shortTitle: billData.bill?.shortTitle,
                  latestAction: billData.bill?.latestAction
                };
              }
              
              if (subjectsResponse.ok) {
                const subjectsData = await subjectsResponse.json();
                if (subjectsData.subjects?.policyArea?.name) {
                  billInfo = {
                    ...billInfo,
                    policyArea: subjectsData.subjects.policyArea.name
                  };
                }
              }
            } catch (error) {
              console.error(`16. Error fetching bill info for ${vote.bill.billType}${vote.bill.billNumber}`);
            }
          }

          return {
            congress: vote.congress,
            session: vote.sessionNumber,
            rollCallNumber: vote.rollCallNumber,
            date: vote.startDate,
            question: vote.question,
            description: vote.description,
            voteCast: memberVote.voteCast,
            voteParty: memberVote.voteParty,
            voteState: memberVote.voteState,
            bill: vote.bill,
            billInfo: billInfo
          };
        })
      );
      
      // Filter out null results and add to all votes
      const filteredVotes = votesWithDetails.filter(vote => vote !== null);
      console.log(`17. Found ${filteredVotes.length} votes for member in session ${session}`);
      allVotes = [...allVotes, ...filteredVotes];
    }
    
    console.log('18. Total votes found across all sessions:', allVotes.length);
    
    if (allVotes.length === 0) {
      return res.json({ 
        votes: [],
        message: 'No votes found for this member in the 119th Congress'
      });
    }
    
    // Sort votes by date, most recent first
    allVotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Take only the most recent votes
    const recentVotes = allVotes.slice(0, MAX_VOTES);
    
    res.json({
      votes: recentVotes
    });
    
  } catch (error) {
    console.error('19. Error in vote fetch:', error);
    res.status(500).json({ 
      error: 'Failed to fetch votes',
      details: error.message 
    });
  }
});

app.all('/{*any}', (req, res, next) => {})