import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
export async function setupDatabase() {
  const dbPath = path.resolve(__dirname, '../services/politicaldata.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create senate table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS senate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT NOT NULL,
      state TEXT NOT NULL,
      photoUrl TEXT,
      phones TEXT,
      UNIQUE(name, state)
    )
  `);

  // Create candidates table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      CAND_ID TEXT PRIMARY KEY,
      CAND_NAME TEXT,
      CAND_ICI TEXT,
      PTY_CD TEXT,
      CAND_PTY_AFFILIATION TEXT,
      TTL_RECEIPTS REAL,
      TRANS_FROM_AUTH REAL,
      TTL_DISB REAL,
      TRANS_TO_AUTH REAL,
      COH_BOP REAL,
      COH_COP REAL,
      CAND_CONTRIB REAL,
      CAND_LOANS REAL,
      OTHER_LOANS REAL,
      CAND_LOAN_REPAY REAL,
      OTHER_LOAN_REPAY REAL,
      DEBTS_OWED_BY REAL,
      TTL_INDIV_CONTRIB REAL,
      CAND_OFFICE_ST TEXT,
      CAND_OFFICE_DISTRICT TEXT,
      SPEC_ELECTION TEXT,
      PRIM_ELECTION TEXT,
      RUN_ELECTION TEXT,
      GEN_ELECTION TEXT,
      GEN_ELECTION_PRECENT TEXT,
      OTHER_POL_CMTE_CONTRIB REAL,
      POL_PTY_CONTRIB REAL,
      CVG_END_DT TEXT,
      INDIV_REFUNDS REAL,
      CMTE_REFUNDS REAL
    )
  `);

  return db;
}

// Function to populate the database with senator data
export async function populateDatabase(senators: any[]) {
  const db = await setupDatabase();
  
  // Clear existing data
  await db.run('DELETE FROM senate');
  
  // Insert new data
  const stmt = await db.prepare(`
    INSERT INTO senate (name, party, state, photoUrl, phones)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const senator of senators) {
    await stmt.run(
      senator.name,
      senator.party,
      senator.state,
      senator.photoUrl,
      JSON.stringify(senator.phones || [])
    );
  }

  await stmt.finalize();
  
  // Check if candidates table already has data
  const candidateCount = await db.get('SELECT COUNT(*) as count FROM candidates');
  
  // Only load candidate data if the table is empty
  if (candidateCount.count === 0) {
    await populateCandidatesTable(db);
  } else {
    console.log(`Candidates table already contains ${candidateCount.count} records. Skipping import.`);
  }
  
  await db.close();
}

// Function to populate the candidates table from multiple data files
async function populateCandidatesTable(db: any) {
  try {
    // Paths to the candidates data files
    const dataFiles = [
      '../assets/data/cand/candidates-19.txt',
      '../assets/data/cand/candidates-21.txt',
      '../assets/data/cand/candidates-23.txt',
      '../assets/data/cand/weball26.txt',
      // Add any additional candidate files here
    ];
    
    let totalRecords = 0;
    
    // Prepare the SQL statement for bulk insert
    const stmt = await db.prepare(`
      INSERT INTO candidates (
        CAND_ID, CAND_NAME, CAND_ICI, PTY_CD, CAND_PTY_AFFILIATION, 
        TTL_RECEIPTS, TRANS_FROM_AUTH, TTL_DISB, TRANS_TO_AUTH, 
        COH_BOP, COH_COP, CAND_CONTRIB, CAND_LOANS, OTHER_LOANS, 
        CAND_LOAN_REPAY, OTHER_LOAN_REPAY, DEBTS_OWED_BY, TTL_INDIV_CONTRIB, 
        CAND_OFFICE_ST, CAND_OFFICE_DISTRICT, SPEC_ELECTION, PRIM_ELECTION, 
        RUN_ELECTION, GEN_ELECTION, GEN_ELECTION_PRECENT, OTHER_POL_CMTE_CONTRIB, 
        POL_PTY_CONTRIB, CVG_END_DT, INDIV_REFUNDS, CMTE_REFUNDS
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Process each data file
    for (const filePath of dataFiles) {
      const fullPath = path.resolve(__dirname, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: File not found: ${fullPath} - Skipping`);
        continue;
      }
      
      console.log(`Reading candidates data from: ${fullPath}`);
      
      // Read the data file
      const fileData = fs.readFileSync(fullPath, 'utf8');
      const lines = fileData.trim().split('\n');
      
      console.log(`Found ${lines.length} candidate records in ${filePath}`);
      
      // Process and insert each line
      for (const line of lines) {
        try {
          const fields = line.split('|');
          
          // Skip if invalid data
          if (fields.length < 30) {
            console.warn(`Warning: Invalid data format in line: ${line.substring(0, 30)}... - Skipping`);
            continue;
          }
          
          // Skip if already exists (handle duplicates between files)
          const existing = await db.get('SELECT 1 FROM candidates WHERE CAND_ID = ?', fields[0]);
          if (existing) continue;
          
          // Convert numeric fields to numbers
          const processedFields = fields.map((field, index) => {
            // These fields are numeric (based on the CSV header)
            const numericFields = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 25, 26, 28, 29];
            
            if (numericFields.includes(index)) {
              return field === '' ? 0 : parseFloat(field);
            }
            
            return field;
          });
          
          // Insert the record
          await stmt.run(...processedFields);
          totalRecords++;
        } catch (lineError) {
          console.error(`Error processing line in ${filePath}: ${lineError}`);
          // Continue with next line
        }
      }
    }
    
    await stmt.finalize();
    console.log(`Successfully imported ${totalRecords} total candidate records`);
  } catch (error) {
    console.error('Error importing candidate data:', error);
    throw error;
  }
}

// Function to get all senators from the database
export async function getAllSenators() {
  const db = await setupDatabase();
  const senators = await db.all('SELECT * FROM senate');
  await db.close();
  
  return senators.map(senator => ({
    ...senator,
    phones: JSON.parse(senator.phones || '[]')
  }));
} 