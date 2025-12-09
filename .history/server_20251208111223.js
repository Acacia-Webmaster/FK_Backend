// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');
const authRoutes = require('./authRoutes');
const clientsRoutes = require('./clientsRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log('Incoming:', req.method, req.url);
  next();
});

app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0] });
  } catch (err) {
    console.error('DB error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/auth', authRoutes);
app.use('/clients', clientsRoutes);

const port = 4100; // <--- change this
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
