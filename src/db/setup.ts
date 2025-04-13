import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
export async function setupDatabase() {
  const dbPath = path.resolve(__dirname, '../services/politicaldata.db');
  console.log(`Using database at: ${dbPath}`);
  
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
  await db.close();
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