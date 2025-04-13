import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const app = express();
const port = 3001;
const db = new sqlite3.Database('./polticaldata.db');

app.use(cors());

app.get('/api/senators', (req, res) => {
  db.all('SELECT id, name, state, photoUrl, phones FROM senate', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsed = rows.map(row => ({
      ...row,
      phones: typeof row.phones === 'string' ? JSON.parse(row.phones) : row.phones
    }));
    res.json(parsed);
  });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
