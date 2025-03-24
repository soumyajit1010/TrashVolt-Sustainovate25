const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const db = new sqlite3.Database(path.join(__dirname, '../database/trashvolt.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, total_points INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS waste_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount REAL, energy REAL, points INTEGER, timestamp TEXT, FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`INSERT OR IGNORE INTO users (username, total_points) VALUES ('DemoUser', 0)`);
  db.get(`SELECT id FROM users WHERE username = 'DemoUser'`, (err, row) => {
    if (row) {
      db.run(`INSERT OR IGNORE INTO waste_logs (user_id, type, amount, energy, points, timestamp) VALUES (?, 'organic', 2, 1, 10, ?)`, [row.id, new Date().toISOString()]);
      db.run(`UPDATE users SET total_points = 10 WHERE id = ?`, [row.id]);
    }
  });
});

app.post('/log-waste', (req, res) => {
  const { type, amount, username = 'DemoUser' } = req.body;
  const energy = type === 'organic' ? amount * 0.5 : type === 'recyclable' ? amount * 0.2 : amount * 0.1;
  const points = amount < 1 ? 60 : 10;
  const timestamp = new Date().toISOString();
  const tips = {
    organic: 'Compost organic waste to create fertilizer!',
    recyclable: 'Clean recyclables for better processing.',
    'non-recyclable': 'Reduce single-use items.'
  };

  db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
    const user_id = row.id;
    db.run(`INSERT INTO waste_logs (user_id, type, amount, energy, points, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [user_id, type, amount, energy, points, timestamp]);
    db.run(`UPDATE users SET total_points = total_points + ? WHERE id = ?`, [points, user_id]);
    res.json({ energy, points, tip: tips[type] });
  });
});

app.get('/leaderboard', (req, res) => {
  db.all(`SELECT u.username, SUM(w.points) as total_points FROM waste_logs w JOIN users u ON w.user_id = u.id GROUP BY u.id, u.username ORDER BY total_points DESC LIMIT 5`, (err, rows) => {
    res.json(rows.length ? rows : [{ username: 'DemoUser', total_points: 0 }]);
  });
});

app.get('/stats', (req, res) => {
  db.get(`SELECT SUM(amount) as total_waste, SUM(energy) as total_energy FROM waste_logs`, (err, row) => {
    res.json({
      totalWaste: row.total_waste || 0,
      totalEnergy: row.total_energy || 0,
      co2Avoided: (row.total_energy || 0) * 0.5
    });
  });
});

app.post('/analyze-waste', (req, res) => {
  const fileName = req.body.photo ? req.body.photo.filename.toLowerCase() : '';
  const tips = {
    organic: 'Looks like food waste—compost it!',
    recyclable: 'This can be recycled—rinse it first!',
    'non-recyclable': 'Hard to recycle—try reducing this type.'
  };

  const organicKeywords = ['food', 'banana', 'apple', 'vegetable', 'fruit', 'leaf', 'compost'];
  const recyclableKeywords = ['plastic', 'bottle', 'can', 'paper', 'cardboard', 'glass', 'metal'];
  const nonRecyclableKeywords = ['styrofoam', 'wrapper', 'chip', 'bag', 'diaper'];

  let type = 'non-recyclable';
  let confidence = 60;

  if (organicKeywords.some(keyword => fileName.includes(keyword))) {
    type = 'organic';
    confidence = 90;
  } else if (recyclableKeywords.some(keyword => fileName.includes(keyword))) {
    type = 'recyclable';
    confidence = 85;
  } else if (nonRecyclableKeywords.some(keyword => fileName.includes(keyword))) {
    type = 'non-recyclable';
    confidence = 80;
  } else {
    const types = ['organic', 'recyclable', 'non-recyclable'];
    type = types[Math.floor(Math.random() * types.length)];
    confidence = 70;
  }

  res.json({ type, confidence, tip: tips[type] });
});

app.post('/add-bonus-points', (req, res) => {
  const { username = 'DemoUser', points } = req.body;
  db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
    if (err || !row) return res.status(500).json({ error: 'User not found' });
    const user_id = row.id;
    db.run(`UPDATE users SET total_points = total_points + ? WHERE id = ?`, [points, user_id], (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    });
  });
});

// New Map Data Endpoint
app.get('/map-data', (req, res) => {
  res.json([{ lat: 51.5, lng: -0.09, name: 'Recycling Center' }]);
});

app.listen(3000, () => console.log('Server running on port 3000'));