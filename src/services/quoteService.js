const API_BASE = 'https://stock-teto-api.vercel.app';
const MAX_QUOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseQuote(payload, ticker, now = new Date()) {
  if (!payload || payload.ticker !== ticker || !Number.isFinite(payload.price) || payload.price <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.price_date || '')) return null;
  const quoteTime = Date.parse(`${payload.price_date}T12:00:00Z`);
  const age = now.getTime() - quoteTime;
  if (!Number.isFinite(age) || age < -24 * 60 * 60 * 1000 || age > MAX_QUOTE_AGE_MS) return null;
  const acceptedStatus = payload.status === 'last_known'
    || payload.status === 'fresh'
    || (payload.status === 'intraday' && payload.fresh === true);
  if (!acceptedStatus) return null;
  return {
    currentPrice: payload.price,
    sourceDate: payload.price_date,
    quoteSource: 'Stock Teto API',
    quoteSourceUrl: `${API_BASE}/docs`,
    quoteProvider: typeof payload.source === 'string' ? payload.source : null,
    quoteStatus: payload.status,
  };
}

async function fetchQuote(ticker, fetcher = fetch) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetcher(`${API_BASE}/api/v1/quotes/${encodeURIComponent(ticker)}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: 'application/json' },
      });
      if (response.status >= 500) continue;
      if (!response.ok) return null;
      return parseQuote(await response.json(), ticker);
    } catch {
      // A second attempt covers transient network errors and cold starts.
    }
  }
  return null;
}

function mergeQuote(asset, quote) {
  return {
    ...asset,
    currentPrice: quote?.currentPrice ?? null,
    sourceDate: quote?.sourceDate ?? null,
    quoteSource: quote?.quoteSource ?? null,
    quoteSourceUrl: quote?.quoteSourceUrl ?? null,
    quoteProvider: quote?.quoteProvider ?? null,
    quoteStatus: quote?.quoteStatus ?? 'unavailable',
  };
}

module.exports = { fetchQuote, parseQuote, mergeQuote };
