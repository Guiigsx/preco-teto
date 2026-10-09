const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchQuote, parseQuote, mergeQuote } = require('../src/services/quoteService');

const now = new Date('2026-10-06T12:00:00Z');
const quote = {
  ticker: 'ITUB4',
  price: 49.48,
  price_date: '2026-10-05',
  status: 'last_known',
  source: 'Yahoo Finance chart',
};

test('accepts a dated quote from the API and records its provenance', () => {
  assert.deepEqual(parseQuote(quote, 'ITUB4', now), {
    currentPrice: 49.48,
    sourceDate: '2026-10-05',
    quoteSource: 'Stock Teto API',
    quoteSourceUrl: 'https://stock-teto-api.vercel.app/docs',
    quoteProvider: 'Yahoo Finance chart',
    quoteStatus: 'last_known',
  });
});

test('accepts a fresh intraday quote from the API', () => {
  const intraday = { ...quote, price: 50.51, price_date: '2026-10-07', status: 'intraday', fresh: true };
  const parsed = parseQuote(intraday, 'ITUB4', new Date('2026-10-07T14:00:00Z'));
  assert.equal(parsed.currentPrice, 50.51);
  assert.equal(parsed.sourceDate, '2026-10-07');
  assert.equal(parsed.quoteStatus, 'intraday');
  assert.equal(parseQuote({ ...intraday, fresh: false }, 'ITUB4', new Date('2026-10-07T14:00:00Z')), null);
});

test('rejects mismatched, invalid, or stale quotes', () => {
  assert.equal(parseQuote(quote, 'BBAS3', now), null);
  assert.equal(parseQuote({ ...quote, price: -1 }, 'ITUB4', now), null);
  assert.equal(parseQuote({ ...quote, price_date: '2026-09-25' }, 'ITUB4', now), null);
  assert.equal(parseQuote({ ...quote, status: 'unavailable' }, 'ITUB4', now), null);
});

test('does not silently fall back to a scraped price when the API quote fails', () => {
  const asset = { ticker: 'ITUB4', currentPrice: 48, sourceDate: '2026-10-06' };
  assert.deepEqual(mergeQuote(asset, null), {
    ticker: 'ITUB4',
    currentPrice: null,
    sourceDate: null,
    quoteSource: null,
    quoteSourceUrl: null,
    quoteProvider: null,
    quoteStatus: 'unavailable',
  });
});

test('retries a temporary API failure once', async () => {
  let calls = 0;
  const result = await fetchQuote('ITUB4', async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 502 };
    return { ok: true, status: 200, json: async () => ({ ...quote, price_date: new Date().toISOString().slice(0, 10), status: 'intraday', fresh: true }) };
  });
  assert.equal(calls, 2);
  assert.equal(result.currentPrice, 49.48);
});

test('does not retry a missing ticker', async () => {
  let calls = 0;
  const result = await fetchQuote('FAKE3', async () => {
    calls += 1;
    return { ok: false, status: 404 };
  });
  assert.equal(calls, 1);
  assert.equal(result, null);
});
