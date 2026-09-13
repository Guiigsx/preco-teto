require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const priceRoutes = require('./routes/prices');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/prices', priceRoutes);
app.use('/icons', express.static(path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons')));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Stock Teto rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
