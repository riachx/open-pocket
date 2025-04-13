import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const app = express();
const port = 3001;
const db = new sqlite3.Database('./politicaldata.db');

app.use(cors());

app.get('/api/senators/:id', async (req, res) => {
  let db;
  try {
    db = await setupDatabase();
    const senator = await db.get('SELECT * FROM senate WHERE id = ?', req.params.id);
    
    if (!senator) {
      return res.status(404).json({ error: 'Senator not found' });
    }
    
    const formattedSenator = {
      ...senator,
      photoUrl: senator.photoUrl || 'https://i.imgur.com/VlKTQWO.png',
      phones: JSON.parse(senator.phones || '[]')
    };
    
    res.json(formattedSenator);
  } catch (error) {
    console.error('Error fetching senator:', error);
    res.status(500).json({ error: 'Failed to fetch senator', details: error.message });
  } finally {
    if (db) {
      await db.close();
    }
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
