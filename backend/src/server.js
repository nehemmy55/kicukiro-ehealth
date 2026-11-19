// Mobile-Based E-Health Application — Node.js + Express API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Simple request log
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', database: e.message });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/records', require('./routes/records'));
app.use('/api', require('./routes/dashboard'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✔ Kicukiro E-Health API running on http://localhost:${PORT}/api`);
  console.log('  Phones on the same Wi-Fi reach it at http://<this-computer-LAN-IP>:' + PORT + '/api');
});
