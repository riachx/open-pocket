import sqlite3 from 'sqlite3';
import { Router, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SenatorRow {
  name: string;
  party: string;
  state: string;
  photoUrl: string;
  phones: string[];
}

const router = Router();

router.get('/api/senators', (req: Request, res: Response) => {
  const dbPath = path.resolve(__dirname, '../services/politicaldata.db');
  const db = new sqlite3.Database(dbPath, (err: Error | null) => {
    if (err) {
      console.error('Error opening database:', err);
      console.error('Database path:', dbPath);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    db.all(
      `SELECT name, party, state, photo_url as photoUrl, phone as phones 
       FROM candidates 
       ORDER BY state, name`,
      (err: Error | null, rows: SenatorRow[]) => {
        if (err) {
          console.error('Error querying database:', err);
          return res.status(500).json({ error: 'Query error' });
        }

        // Transform the data to match the expected format
        const senators = rows.map((row: SenatorRow) => ({
          ...row,
          phones: row.phones ? [row.phones] : []
        }));

        res.json(senators);
      }
    );

    db.close();
  });
});

export default router; 