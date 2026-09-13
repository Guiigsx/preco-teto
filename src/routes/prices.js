const express = require('express');
const { fetchFairPriceAsset, normalizeTicker, isValidTicker } = require('../services/fairPriceService');
const router = express.Router();

router.get('/:ticker', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const ticker = normalizeTicker(req.params.ticker);
  if (!isValidTicker(ticker)) return res.status(400).json({ error: 'Informe um ticker válido, como BBAS3 ou GARE11.' });
  try {
    res.json({ data: await fetchFairPriceAsset(ticker) });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

module.exports = router;
