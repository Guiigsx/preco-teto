const cheerio = require('cheerio');

const BASE_URL = 'https://investidor10.com.br';
const cache = new Map();
const inFlight = new Map();
const CACHE_TTL = 60_000;

function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase().replace(/\.SA$/, '');
}

function isValidTicker(ticker) {
  return /^[A-Z]{4}\d{1,2}$/.test(ticker);
}

function brNumber(value) {
  const text = String(value || '').replace(/R\$|\s|%/g, '');
  if (!/^-?[\d.]+(?:,\d+)?$/.test(text)) return null;
  const number = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

function normalizeLabel(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function stdev(values) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return null;
  const avg = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / clean.length;
  return Math.sqrt(variance);
}

function addMonths(monthKey, offset) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sentenceCase(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

function cleanSectorText(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+e\s+(?:tamb[eé]m\s+)?(?:no|na|do|da)?\s*subsetor.+$/i, '')
    .replace(/\s+do\s+subsetor.+$/i, '')
    .replace(/^(?:de|do|da|dos|das)\s+/i, '')
    .replace(/\s+(?:de|do|da|dos|das)$/i, '')
    .trim();
  return sentenceCase(text);
}

function parseJsonLd($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed && typeof parsed === 'object') blocks.push(parsed);
    } catch {
      // Ignore malformed metadata; visible page data remains the source of truth.
    }
  });
  return blocks;
}

function sectorGroup(sector, subsector, name, ticker = '') {
  const prefix = String(ticker || name || '').toUpperCase().match(/[A-Z]{4}/)?.[0];
  const known = {
    BBAS: 'Bancos', ITUB: 'Bancos', BBDC: 'Bancos', SANB: 'Bancos', BPAC: 'Bancos', BRSR: 'Bancos',
    BBSE: 'Seguros', PSSA: 'Seguros', CXSE: 'Seguros',
    CMIG: 'Elétricas', CPLE: 'Elétricas', TAEE: 'Elétricas', EGIE: 'Elétricas', CPFE: 'Elétricas', NEOE: 'Elétricas',
    SAPR: 'Saneamento', CSMG: 'Saneamento', SBSP: 'Saneamento',
    PETR: 'Commodities', VALE: 'Commodities', CSNA: 'Commodities', GGBR: 'Commodities', USIM: 'Commodities', KLBN: 'Commodities', SUZB: 'Commodities',
    ITSA: 'Bancos',
    WEGE: 'Indústria', POMO: 'Indústria', TUPY: 'Indústria',
    VIVT: 'Telecomunicações', TIMS: 'Telecomunicações', OIBR: 'Telecomunicações', TELB: 'Telecomunicações',
  };
  if (known[prefix]) return known[prefix];
  const text = normalizeLabel([sector, subsector, name].filter(Boolean).join(' '));
  if (/BANCO|BANCOS|INTERMEDIARIOS FINANCEIROS/.test(text)) return 'Bancos';
  if (/SEGUR/.test(text)) return 'Seguros';
  if (/ENERGIA ELETRICA|ELETRIC/.test(text)) return 'Elétricas';
  if (/AGUA|SANEAMENTO/.test(text)) return 'Saneamento';
  if (/PETROLEO|GAS|MINER|SIDER|COMMODIT/.test(text)) return 'Commodities';
  if (/HOLDING/.test(text)) return 'Holdings';
  if (/TRANSPORTE|RODOVIA|FERROVIA|LOGIST/.test(text)) return 'Infraestrutura';
  if (/INDUSTR/.test(text)) return 'Indústria';
  if (/VAREJO|COMERCIO|CONSUMO/.test(text)) return 'Consumo';
  if (/SAUDE|MEDIC/.test(text)) return 'Saúde';
  if (/TECNOLOG/.test(text)) return 'Tecnologia';
  if (/TELECOM|TELEFON/.test(text)) return 'Telecomunicações';
  return 'Outros';
}

function controlType(ticker) {
  const prefix = ticker.replace(/\d+$/, '');
  const stateControlled = new Set(['BBAS', 'PETR', 'CMIG', 'CPLE', 'SAPR', 'CSMG', 'BRSR', 'CEEB', 'CEBR', 'CGAS', 'AFLT']);
  return stateControlled.has(prefix) ? 'state' : 'private';
}

function summarizeDividends(rows, now = new Date(), validTable = true) {
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - 4;
  const start = `${startYear}-01-01`;
  const end = `${endYear}-12-31`;
  const allowedTypes = /^(DIVIDENDOS?|JCP|JSCP|JUROS SOBRE (?:O )?CAPITAL PROPRIO|RENDIMENTOS?)$/;
  const excludedTypes = /^(AMORTIZA|BONIFICACAO|REND\. TRIB\.$)/;
  const incomeRows = rows.filter((row) => allowedTypes.test(normalizeLabel(row.type)));
  const invalid = incomeRows.some((row) => !row.exDate || !Number.isFinite(row.amount) || row.amount < 0)
    || rows.some((row) => row.exDate >= start && row.exDate <= end && !allowedTypes.test(normalizeLabel(row.type)) && !excludedTypes.test(normalizeLabel(row.type)));
  const dates = incomeRows.map((row) => row.exDate).filter(Boolean).sort();
  // A history starting inside the window cannot establish whether earlier years were zero.
  const complete = validTable && !invalid && dates.length > 0 && dates[0] <= start;
  const annualTotals = Array.from({ length: 5 }, (_, index) => ({ year: startYear + index, total: 0, count: 0 }));
  const monthly = new Map();
  for (const row of incomeRows) {
    if (row.exDate && Number.isFinite(row.amount) && row.amount >= 0) {
      const key = row.exDate.slice(0, 7);
      monthly.set(key, (monthly.get(key) || 0) + row.amount);
    }
    if (!row.exDate || row.exDate < start || row.exDate > end || !Number.isFinite(row.amount)) continue;
    const annual = annualTotals[Number(row.exDate.slice(0, 4)) - startYear];
    annual.total += row.amount;
    annual.count += 1;
  }
  const total = annualTotals.reduce((sum, row) => sum + row.total, 0);
  const latestMonth = dates.length ? dates[dates.length - 1].slice(0, 7) : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(latestMonth, index - 11);
    return { month, total: monthly.get(month) || 0 };
  });
  const positiveMonthly = monthlyTotals.map((item) => item.total).filter((value) => value > 0);
  const monthlyMedian = median(positiveMonthly);
  const adjustedMonthly = monthlyMedian
    ? positiveMonthly.filter((value) => value <= monthlyMedian * 1.6)
    : [];
  const normalizedMonthly = median(adjustedMonthly.length >= Math.min(3, positiveMonthly.length) ? adjustedMonthly : positiveMonthly);
  const normalizedStdDev = normalizedMonthly ? stdev(positiveMonthly) / normalizedMonthly : null;
  return {
    complete, start, end,
    annualTotals: complete ? annualTotals : [],
    total: complete ? total : null,
    average: complete ? total / 5 : null,
    normalizedMonthly,
    normalizedAnnual: normalizedMonthly ? normalizedMonthly * 12 : null,
    normalizedSamples: positiveMonthly.length,
    normalizedStdDev,
    monthlyTotals,
    normalizedBasis: normalizedMonthly
      ? 'Mediana mensal dos últimos 12 meses com corte de distribuições extraordinárias acima de 1,6x a mediana.'
      : 'Não há pagamentos mensais suficientes para normalizar a renda.',
    reason: complete ? null : 'Histórico de cinco anos completos indisponível na fonte.',
    dateBasis: 'data com',
    basis: 'Dividendos, JCP e rendimentos por ação/cota, conforme valores ajustados publicados pela fonte. Amortizações e eventos classificados como “Rend. Trib.” excluídos.',
  };
}

function parseAssetPage(html, ticker, type, now = new Date()) {
  const $ = cheerio.load(html);
  const metadata = parseJsonLd($);
  const article = metadata.find((item) => item['@type'] === 'Article') || {};
  const source = `${BASE_URL}/${type === 'fii' ? 'fiis' : 'acoes'}/${ticker.toLowerCase()}/`;
  const canonical = $('link[rel="canonical"]').attr('href');
  const title = $('title').text().replace(/\s+/g, ' ').trim();
  if (canonical?.replace(/\/$/, '') !== source.replace(/\/$/, '') || !title.toUpperCase().includes(ticker)) {
    throw new Error('Ativo não encontrado. Confira o ticker.');
  }
  const priceCard = $('._card').filter((_, element) => normalizeLabel($(element).find('._card-header').text()).includes('COTACAO')).first();
  const currentPrice = brNumber(priceCard.find('._card-body .value').first().text());
  if (!(currentPrice > 0)) throw new Error('Cotação indisponível na fonte. Tente novamente mais tarde.');
  const indicator = (label) => {
    const values = $('[data-indicator][data-current-value]').filter((_, element) => normalizeLabel($(element).attr('data-indicator')) === normalizeLabel(label))
      .map((_, element) => $(element).attr('data-current-value')).get();
    const parsed = values.filter((value) => /^-?\d+(?:\.\d+)?$/.test(value)).map(Number);
    return parsed.length && parsed.every((value) => value === parsed[0]) ? parsed[0] : null;
  };
  const stockFundamentals = type === 'stock' ? {
    pl: indicator('P/L'),
    pvp: indicator('P/VP'),
    psr: indicator('P/Receita (PSR)'),
    evEbitda: indicator('EV/Ebitda'),
    lpa: indicator('LPA'),
    vpa: indicator('VPA'),
    roe: indicator('ROE'),
    roa: indicator('ROA'),
    roic: indicator('ROIC'),
    dividendYield: indicator('Dividend Yield'),
    payout: indicator('Payout'),
    currentLiquidity: indicator('Liquidez Corrente'),
    netDebtEbitda: indicator('Dívida Líquida / Ebitda'),
    netDebtEbit: indicator('Dívida Líquida / Ebit'),
    grossDebtEquity: indicator('Dívida Bruta / Patrimônio'),
    equityAssets: indicator('Patrimônio / Ativos'),
    liabilitiesAssets: indicator('Passivos / Ativos'),
    revenueCagr5y: indicator('CAGR Receitas 5 anos'),
    profitCagr5y: indicator('CAGR Lucros 5 anos'),
  } : null;
  const table = $('#table-dividends-history');
  const headers = table.find('thead th').map((_, element) => normalizeLabel($(element).text())).get();
  const validTable = headers.length === 4 && headers[0] === 'TIPO' && headers[1] === 'DATA COM' && headers[2] === 'PAGAMENTO' && headers[3] === 'VALOR';
  const rows = table.find('tbody tr').map((_, element) => {
    const cells = $(element).find('td');
    const amountCell = cells.eq(3).clone();
    amountCell.find('i, svg, script, .popover').remove();
    return { type: cells.eq(0).text().trim(), exDate: isoDate(cells.eq(1).text()), amount: brNumber(amountCell.text()) };
  }).get();
  const cellValue = (label) => {
    const cell = $('.cell').filter((_, element) => normalizeLabel($(element).find('.name').text()) === normalizeLabel(label)).first();
    return brNumber(cell.find('.value').text());
  };
  const cellText = (label) => {
    const cell = $('.cell').filter((_, element) => normalizeLabel($(element).find('.name').text()) === normalizeLabel(label)).first();
    return cell.find('.value').text().replace(/\s+/g, ' ').trim() || null;
  };
  const logoPath = $('img').filter((_, element) => {
    const alt = $(element).attr('alt') || '';
    return (alt === ticker || alt.startsWith(`${ticker} -`)) && /\/storage\/(companies|fiis)\//.test($(element).attr('src') || '');
  }).first().attr('src');
  const logoCandidate = logoPath ? new URL(logoPath, BASE_URL) : null;
  const sourceDateText = priceCard.find('.last-update').attr('data-content') || '';
  const dateMatch = sourceDateText.match(/\d{2}\/\d{2}\/\d{4}/);
  const stockName = title.split(' - ')[1];
  const articleBody = article.articleBody || '';
  const sectorMatch = articleBody.match(/setor\s+([^,.]+?)(?:\s+e\s+(?:tamb[eé]m\s+)?(?:(?:no|na|do|da)\s+)?subsetor|\s*,|\.)/i);
  const subsectorMatch = articleBody.match(/subsetor\s+de\s+([^,.]+?)(?:,|\.)/i);
  const sector = type === 'stock' ? cleanSectorText(sectorMatch?.[1]) : cellText('SEGMENTO');
  const subsector = type === 'stock' ? cleanSectorText(subsectorMatch?.[1]) : cellText('TIPO DE FUNDO');
  const legalName = article.mentions?.name || null;
  const profileName = type === 'stock' && stockName ? stockName : ticker;
  return {
    ticker, type,
    name: profileName,
    logoUrl: logoCandidate?.origin === BASE_URL ? logoCandidate.href : null,
    currentPrice,
    lpa: type === 'stock' ? stockFundamentals.lpa : null,
    vpa: type === 'stock' ? stockFundamentals.vpa : cellValue('VAL. PATRIMONIAL P/ COTA'),
    profile: {
      legalName,
      description: articleBody || article.description || null,
      sector,
      subsector,
      sectorGroup: type === 'stock' ? sectorGroup(sector, subsector, profileName, ticker) : sector || 'FIIs',
      controlType: type === 'stock' ? controlType(ticker) : null,
    },
    fundamentals: type === 'stock' ? stockFundamentals : {
      segment: cellText('SEGMENTO'),
      fundType: cellText('TIPO DE FUNDO'),
      managementType: cellText('TIPO DE GESTÃO'),
      vacancy: cellValue('VACÂNCIA'),
      shareholders: cellText('NUMERO DE COTISTAS'),
      sharesIssued: cellText('COTAS EMITIDAS'),
      equityValuePerShare: cellValue('VAL. PATRIMONIAL P/ COTA'),
      lastIncome: cellValue('ÚLTIMO RENDIMENTO'),
    },
    dividends: summarizeDividends(rows, now, validTable),
    source,
    sourceDate: dateMatch ? isoDate(dateMatch[0]) : null,
    consultedAt: now.toISOString(),
  };
}

async function fetchAssetPage(ticker, type) {
  const url = `${BASE_URL}/${type === 'fii' ? 'fiis' : 'acoes'}/${ticker.toLowerCase()}/`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`Fonte indisponível (${response.status}).`);
  return parseAssetPage(await response.text(), ticker, type);
}

async function fetchFairPriceAsset(rawTicker) {
  const ticker = normalizeTicker(rawTicker);
  if (!isValidTicker(ticker)) throw new Error('Informe um ticker válido, como BBAS3 ou GARE11.');
  const entry = cache.get(ticker);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  if (inFlight.has(ticker)) return inFlight.get(ticker);
  const task = (async () => {
    const types = ticker.endsWith('11') ? ['fii', 'stock'] : ['stock', 'fii'];
    for (const type of types) {
      try {
        const data = await fetchAssetPage(ticker, type);
        if (cache.size >= 250) cache.delete(cache.keys().next().value);
        cache.set(ticker, { time: Date.now(), data });
        return data;
      } catch {
        // Units ending in 11 must also be checked on the equities page.
      }
    }
    throw new Error(`Não foi possível consultar ${ticker}. Confira o ticker ou tente mais tarde.`);
  })();
  inFlight.set(ticker, task);
  try { return await task; } finally { inFlight.delete(ticker); }
}

module.exports = { fetchFairPriceAsset, normalizeTicker, isValidTicker, parseAssetPage, summarizeDividends, brNumber };
