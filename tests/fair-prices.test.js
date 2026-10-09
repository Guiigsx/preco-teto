const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, rank } = require('../public/js/fair-price-model');
const { summarizeDividends, parseAssetPage, brNumber, isValidTicker } = require('../src/services/fairPriceService');
const now = new Date('2026-09-09T12:00:00Z');
const payment = (year, amount, type = 'Dividendos') => ({ exDate: `${year}-06-01`, amount, type });

test('Bazin uses five complete years, includes zero years and JSCP, excludes current year and non-cash events', () => {
  const rows = [payment(2020, 1), payment(2021, 2), payment(2022, 3, 'JSCP'), payment(2024, 4), payment(2025, 6), payment(2026, 99), payment(2023, 100, 'Amortização'), payment(2023, 100, 'Bonificação'), payment(2023, 0.1, 'Rend. Trib.')];
  const history = summarizeDividends(rows, now);
  assert.equal(history.complete, true);
  assert.equal(history.total, 15);
  assert.equal(history.average, 3);
  assert.deepEqual(history.annualTotals.map((row) => row.total), [2, 3, 0, 4, 6]);
  assert.equal(evaluate({ dividends: history }, 6).bazin, 50);
});

test('incomplete, malformed or unknown income histories never receive a five-year valuation', () => {
  for (const rows of [[payment(2022, 2)], [payment(2020, 1), payment(2022, null)], [payment(2020, 1), payment(2023, 2, 'Tipo novo')]]) {
    const history = summarizeDividends(rows, now);
    assert.equal(history.complete, false);
    assert.equal(evaluate({ dividends: history }, 6).bazin, null);
  }
});

test('Graham requires positive reported EPS and book value, never applies to FIIs', () => {
  assert.equal(evaluate({ type: 'stock', lpa: 2, vpa: 20 }).graham, 30);
  for (const asset of [{ type: 'stock', lpa: -2, vpa: -20 }, { type: 'stock', lpa: 0, vpa: 20 }, { type: 'stock', lpa: null, vpa: 20 }, { type: 'fii', lpa: 2, vpa: 20 }]) {
    assert.equal(evaluate(asset).graham, null);
  }
});

test('stocks rank by average fair value discounted by the safety margin', () => {
  const annualTotals = [2021, 2022, 2023, 2024, 2025].map((year, index) => ({ year, total: 1 + index * 0.1 }));
  const a = { ticker: 'AAAA3', type: 'stock', currentPrice: 12, lpa: 2, vpa: 20, profile: { controlType: 'private' }, fundamentals: { roe: 20, payout: 60 }, dividends: { complete: true, average: 1.2, annualTotals } };
  const b = { ticker: 'BBBB3', type: 'stock', currentPrice: 20, lpa: 1, vpa: 10, profile: { controlType: 'state' }, fundamentals: { roe: 10, payout: 90 }, dividends: { complete: true, average: 3, annualTotals } };
  assert.equal(evaluate(a, { method: 'bazin', bazinYield: 6 }).margin, 40);
  assert.ok(Math.abs(evaluate(a).bazin - 12) < 1e-10);
  assert.equal(evaluate(a).safetyMargin, 15);
  assert.equal(evaluate(b).safetyMargin, 20);
  assert.equal(evaluate(a).selectedMethod, 'buy');
  assert.ok(evaluate(a).buyPrice < evaluate(a).fairAverage);
  assert.equal(evaluate(a).assumptions.gordonGrowth.selected, 5);
  assert.deepEqual(rank([a, b]).map((row) => row.ticker), ['AAAA3', 'BBBB3']);
  assert.deepEqual(rank([a, b], { method: 'gordon' }).map((row) => row.ticker), ['AAAA3', 'BBBB3']);
  assert.equal(evaluate(a, { method: 'best' }).selectedMethod, 'graham');
  assert.deepEqual(rank([a, b], { method: 'bazin', bazinYield: 10 }).map((row) => row.ticker), ['BBBB3', 'AAAA3']);
  assert.equal(evaluate({ ...a, currentPrice: null }).margin, null);
});

test('growth strategy ignores dividends and can value an asset with no payouts', () => {
  const asset = { ticker: 'SUZB3', type: 'stock', currentPrice: 20, lpa: 4, vpa: 40,
    dividends: { complete: false, average: null }, profile: { controlType: 'private' } };
  const result = evaluate(asset, { strategy: 'growth' });
  assert.deepEqual(result.includedMethods, ['graham']);
  assert.equal(result.bazin, null);
  assert.equal(result.gordon, null);
  assert.equal(result.fairAverage, 60);
  assert.equal(result.buyPrice, 51);
  assert.ok(result.margin > 0);
  assert.equal(evaluate({ ...asset, lpa: null }, { strategy: 'growth' }).buyPrice, null);
});

test('income strategy excludes Graham even when earnings are available', () => {
  const asset = { type: 'stock', currentPrice: 20, lpa: 4, vpa: 40,
    dividends: { complete: false, average: null } };
  assert.equal(evaluate(asset, { strategy: 'income' }).buyPrice, null);
  assert.equal(evaluate(asset, { strategy: 'balanced' }).buyPrice, 51);
  assert.deepEqual(rank([asset], () => ({ strategy: 'growth' }))[0].valuation.includedMethods, ['graham']);
});

function fixture(extra = '') {
  return `<html><head><title>TEST3 - Empresa - Indicadores</title><link rel="canonical" href="https://investidor10.com.br/acoes/test3/"></head><body>
    <img src="/storage/companies/wrong.png" alt="ABCD3"><img src="/storage/companies/right.png" alt="TEST3 - Empresa">
    <div class="_card"><div class="_card-header">Cotação</div><div class="_card-body"><span class="value">R$ 20,00</span></div></div>
    <i data-indicator="LPA" data-current-value="2.0"></i><i data-indicator="VPA" data-current-value="20.0"></i>${extra}
    <table id="table-dividends-history"><thead><tr><th>tipo</th><th>data com</th><th>pagamento</th><th>valor</th></tr></thead><tbody>
      <tr><td>JSCP</td><td>01/06/2022</td><td>02/06/2022</td><td>2,00000000 <i data-content="Valor original 4,0000"></i></td></tr>
      <tr><td>Dividendos</td><td>01/06/2020</td><td>02/06/2020</td><td>1,0000</td></tr></tbody></table></body></html>`;
}

test('parser uses matching logo and adjusted cash amount, and preserves numeric indicators', () => {
  const asset = parseAssetPage(fixture(), 'TEST3', 'stock', now);
  assert.equal(asset.logoUrl, 'https://investidor10.com.br/storage/companies/right.png');
  assert.equal(asset.dividends.total, 2);
  assert.equal(asset.lpa, 2);
  assert.equal(asset.vpa, 20);
  assert.equal(asset.fundamentals.lpa, 2);
  assert.equal(asset.fundamentals.vpa, 20);
  assert.equal(asset.currentPrice, 20);
  assert.throws(() => parseAssetPage(fixture(), 'FAKE3', 'stock', now));
});

test('Axia and Irani use their investment sectors', () => {
  const axia = parseAssetPage(fixture().replaceAll('TEST3', 'AXIA3').replaceAll('test3', 'axia3'), 'AXIA3', 'stock', now);
  const irani = parseAssetPage(fixture().replaceAll('TEST3', 'RANI3').replaceAll('test3', 'rani3'), 'RANI3', 'stock', now);
  assert.equal(axia.profile.sectorGroup, 'Elétricas');
  assert.equal(irani.profile.sectorGroup, 'Commodities');
});

test('conflicting indicators are withheld; unsupported formats and ticker paths rejected', () => {
  assert.equal(parseAssetPage(fixture('<i data-indicator="LPA" data-current-value="99"></i>'), 'TEST3', 'stock', now).lpa, null);
  assert.equal(brNumber('2,63 Bilhões'), null);
  assert.equal(brNumber('R$ 1.234,56'), 1234.56);
  assert.equal(isValidTicker('../BBAS3'), false);
  assert.equal(isValidTicker('TAEE11'), true);
});
