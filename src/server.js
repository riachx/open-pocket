import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Database setup
async function setupDatabase() {
  const dbPath = path.resolve(__dirname, 'services/politicaldata.db');
  console.log(`Using database at: ${dbPath}`);
  
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    return db;
  } catch (error) {
    console.error('Error opening database:', error);
    throw error;
  }
}

// API Routes
app.get('/api/senators', async (req, res) => {
  let db;
  try {
    db = await setupDatabase();
    const senators = await db.all('SELECT * FROM senate');
    
    // Parse the phones JSON string
    const formattedSenators = senators.map(senator => ({
      ...senator,
      photoUrl: senator.photoUrl || 'https://i.imgur.com/VlKTQWO.png',
      phones: JSON.parse(senator.phones || '[]')
    }));
    
    res.json(formattedSenators);
  } catch (error) {
    console.error('Error fetching senators:', error);
    res.status(500).json({ error: 'Failed to fetch senators', details: error.message });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 