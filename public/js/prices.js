'use strict';

const STORAGE_KEY = 'stock-teto.fair-prices.v1';
const SNAPSHOT_KEY = 'stock-teto.asset-snapshots.v1';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_QUOTE_AGE_MS = 5 * 60 * 1000;
const model = window.FairPriceModel;
const $ = (id) => document.getElementById(id);
const money = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const percent = (value) => Number.isFinite(value) ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name) => `<img src="/icons/${name}.svg" alt="" />`;
const defaults = () => ({ list: [], stockSector: 'all', favorites: [], sortOrder: 'margin', strategies: {} });
const STOCK_CONFIG = { method: 'buy', bazinYield: 10, gordonReturn: 12 };
const FII_CONFIG = { method: 'fiiReference', requiredReturn: 10 };
const STRATEGY_LABELS = { balanced: 'Equilibrada', income: 'Renda', growth: 'Crescimento' };
const STRATEGY_METHODS = { balanced: 'Bazin, Graham e Gordon', income: 'Bazin e Gordon', growth: 'Graham' };
const DEFAULT_STRATEGIES = { SUZB3: 'growth' };
const methodNames = { buy: 'Compra', bazin: 'Bazin 10%', graham: 'Graham', gordon: 'Gordon', best: 'Maior margem', fiiReference: 'VR renda + VPA' };
const SECTOR_META = {
  Bancos: { icon: 'landmark', color: '#165dff', legend: 'Bancos, financeiras e holdings bancárias' },
  Seguros: { icon: 'shield-check', color: '#0f9f6e', legend: 'Seguradoras e resseguradoras' },
  Elétricas: { icon: 'zap', color: '#f5a400', legend: 'Geração, transmissão e distribuição de energia' },
  Saneamento: { icon: 'droplets', color: '#0ea5e9', legend: 'Água, esgoto e saneamento básico' },
  Commodities: { icon: 'factory', color: '#7c3aed', legend: 'Petróleo, mineração, siderurgia, papel e celulose' },
  Infraestrutura: { icon: 'construction', color: '#f97316', legend: 'Rodovias, logística, transporte e concessões' },
  Indústria: { icon: 'warehouse', color: '#334155', legend: 'Indústria, máquinas, equipamentos e bens de capital' },
  Consumo: { icon: 'shopping-bag', color: '#db2777', legend: 'Varejo, bebidas, alimentos e consumo' },
  Saúde: { icon: 'heart-pulse', color: '#dc2626', legend: 'Saúde, hospitais, laboratórios e medicina' },
  Tecnologia: { icon: 'cpu', color: '#0891b2', legend: 'Software, tecnologia e serviços digitais' },
  Telecomunicações: { icon: 'radio-tower', color: '#4f46e5', legend: 'Telecom, telefonia e conectividade' },
  Outros: { icon: 'circle-help', color: '#64748b', legend: 'Setor ainda não classificado' },
};
const DEFAULT_SECTORS = Object.keys(SECTOR_META);
const SEARCH_UNIVERSE = [
  { company: 'Banco do Brasil', sector: 'Bancos', tickers: ['BBAS3'], aliases: ['bb', 'brasil'] },
  { company: 'Itaúsa', sector: 'Bancos', tickers: ['ITSA3', 'ITSA4'], aliases: ['itausa', 'holding itau'] },
  { company: 'Itaú Unibanco', sector: 'Bancos', tickers: ['ITUB3', 'ITUB4'], aliases: ['itau', 'itaú', 'unibanco'] },
  { company: 'Banco Bradesco', sector: 'Bancos', tickers: ['BBDC3', 'BBDC4'], aliases: ['bradesco'] },
  { company: 'Santander Brasil', sector: 'Bancos', tickers: ['SANB3', 'SANB4', 'SANB11'], aliases: ['santander'] },
  { company: 'BTG Pactual', sector: 'Bancos', tickers: ['BPAC3', 'BPAC5', 'BPAC11'], aliases: ['btg'] },
  { company: 'BB Seguridade', sector: 'Seguros', tickers: ['BBSE3'], aliases: ['seguridade'] },
  { company: 'Porto Seguro', sector: 'Seguros', tickers: ['PSSA3'], aliases: ['porto'] },
  { company: 'Caixa Seguridade', sector: 'Seguros', tickers: ['CXSE3'], aliases: ['caixa'] },
  { company: 'Cemig', sector: 'Elétricas', tickers: ['CMIG3', 'CMIG4'], aliases: ['companhia energetica minas gerais'] },
  { company: 'Taesa', sector: 'Elétricas', tickers: ['TAEE3', 'TAEE4', 'TAEE11'], aliases: ['transmissora aliança'] },
  { company: 'Copel', sector: 'Elétricas', tickers: ['CPLE3', 'CPLE5', 'CPLE6', 'CPLE11'], aliases: ['companhia paranaense energia'] },
  { company: 'CPFL Energia', sector: 'Elétricas', tickers: ['CPFE3'], aliases: ['cpfl'] },
  { company: 'Engie Brasil', sector: 'Elétricas', tickers: ['EGIE3'], aliases: ['engie'] },
  { company: 'Axia Energia', sector: 'Elétricas', tickers: ['AXIA3'], aliases: ['axia', 'eletrobras'] },
  { company: 'Sabesp', sector: 'Saneamento', tickers: ['SBSP3'], aliases: ['saneamento basico sao paulo'] },
  { company: 'Sanepar', sector: 'Saneamento', tickers: ['SAPR3', 'SAPR4', 'SAPR11'], aliases: ['parana saneamento'] },
  { company: 'Copasa', sector: 'Saneamento', tickers: ['CSMG3'], aliases: ['minas saneamento'] },
  { company: 'Petrobras', sector: 'Commodities', tickers: ['PETR3', 'PETR4'], aliases: ['petróleo brasileiro', 'petroleo'] },
  { company: 'Vale', sector: 'Commodities', tickers: ['VALE3'], aliases: ['mineracao', 'mineração'] },
  { company: 'CSN', sector: 'Commodities', tickers: ['CSNA3'], aliases: ['companhia siderurgica nacional'] },
  { company: 'Gerdau', sector: 'Commodities', tickers: ['GGBR3', 'GGBR4'], aliases: ['siderurgia'] },
  { company: 'Usiminas', sector: 'Commodities', tickers: ['USIM3', 'USIM5'], aliases: ['usinas siderurgicas minas gerais'] },
  { company: 'Klabin', sector: 'Commodities', tickers: ['KLBN3', 'KLBN4', 'KLBN11'], aliases: ['papel celulose'] },
  { company: 'Suzano', sector: 'Commodities', tickers: ['SUZB3'], aliases: ['celulose'] },
  { company: 'Irani', sector: 'Commodities', tickers: ['RANI3'], aliases: ['irani papel', 'embalagens'] },
  { company: 'WEG', sector: 'Indústria', tickers: ['WEGE3'], aliases: ['weg equipamentos'] },
  { company: 'Marcopolo', sector: 'Indústria', tickers: ['POMO3', 'POMO4'], aliases: ['ônibus', 'onibus'] },
  { company: 'Tupy', sector: 'Indústria', tickers: ['TUPY3'], aliases: ['fundição', 'fundicao'] },
  { company: 'Localiza', sector: 'Consumo', tickers: ['RENT3'], aliases: ['aluguel carros'] },
  { company: 'Lojas Renner', sector: 'Consumo', tickers: ['LREN3'], aliases: ['renner'] },
  { company: 'Magazine Luiza', sector: 'Consumo', tickers: ['MGLU3'], aliases: ['magalu'] },
  { company: 'Ambev', sector: 'Consumo', tickers: ['ABEV3'], aliases: ['bebidas'] },
  { company: 'Raia Drogasil', sector: 'Saúde', tickers: ['RADL3'], aliases: ['rdsaude', 'drogasil'] },
  { company: 'Fleury', sector: 'Saúde', tickers: ['FLRY3'], aliases: ['laboratorio'] },
  { company: 'Totvs', sector: 'Tecnologia', tickers: ['TOTS3'], aliases: ['software'] },
  { company: 'Telefônica Brasil Vivo', sector: 'Telecomunicações', tickers: ['VIVT3'], aliases: ['telefonica', 'vivo'] },
  { company: 'TIM', sector: 'Telecomunicações', tickers: ['TIMS3'], aliases: ['tim brasil'] },
  { company: 'Oi', sector: 'Telecomunicações', tickers: ['OIBR3', 'OIBR4'], aliases: ['telecom oi'] },
  { company: 'Allos', sector: 'Consumo', tickers: ['ALOS3'], aliases: ['aliansce sonae', 'shoppings'] },
];
const STOCK_PAGE_SIZE = 10;
let stockVisibleCount = STOCK_PAGE_SIZE;

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function canonicalSector(value) {
  const text = normalizeText(value).replace(/^(DE|DA|DO|DAS|DOS)\s+/, '');
  if (!text || text === 'ALL') return 'all';
  if (/BANCO|INTERMEDIARIO|FINANCEIR/.test(text)) return 'Bancos';
  if (/SEGURO|SEGURAD/.test(text)) return 'Seguros';
  if (/ELETRIC|ENERGIA/.test(text)) return 'Elétricas';
  if (/SANEAMENTO|AGUA|ESGOTO/.test(text)) return 'Saneamento';
  if (/PETROLEO|MINER|SIDER|CELULOSE|PAPEL|COMMODIT|GAS/.test(text)) return 'Commodities';
  if (/INFRA|LOGIST|TRANSPORTE|RODOVIA|FERROVIA|CONCESS/.test(text)) return 'Infraestrutura';
  if (/INDUSTR|MAQUINA|EQUIPAMENTO/.test(text)) return 'Indústria';
  if (/CONSUMO|VAREJO|COMERCIO|BEBIDA|ALIMENTO|SHOPPING/.test(text)) return 'Consumo';
  if (/SAUDE|MEDIC|HOSPITAL|LABORATOR/.test(text)) return 'Saúde';
  if (/TECNOLOG|SOFTWARE/.test(text)) return 'Tecnologia';
  if (/TELECOM|TELEFON|CONECT/.test(text)) return 'Telecomunicações';
  return DEFAULT_SECTORS.includes(value) ? value : 'Outros';
}

function sectorMeta(sector) {
  return SECTOR_META[canonicalSector(sector)] || SECTOR_META.Outros;
}

function sectorIcon(sector) {
  const meta = sectorMeta(sector);
  return `<span class="sector-dot" style="--sector-color:${meta.color}">${icon(meta.icon)}</span>`;
}


function tickerSearchValue(value) {
  return String(value || '').trim().toUpperCase().replace(/\.SA$/, '');
}

function searchSuggestions(query, limit = 7) {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const directTicker = tickerSearchValue(query);
  return SEARCH_UNIVERSE.map((item) => {
    const fields = [item.company, item.sector, ...item.tickers, ...(item.aliases || [])].map(normalizeText);
    const tickerHit = item.tickers.some((ticker) => ticker.startsWith(directTicker));
    const starts = fields.some((field) => field.startsWith(q));
    const includes = fields.some((field) => field.includes(q));
    const score = tickerHit ? 100 : starts ? 80 : includes ? 50 : 0;
    return { ...item, sector: canonicalSector(item.sector), score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company, 'pt-BR'))
    .slice(0, limit);
}

function readSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || !Array.isArray(raw.list)) return defaults();
    const seen = new Set();
    const list = raw.list.filter((row) => row && /^[A-Z]{4}\d{1,2}$/.test(row.ticker) && ['stock', 'fii'].includes(row.type) && !seen.has(row.ticker) && seen.add(row.ticker))
      .slice(0, 50).map(({ ticker, type }) => ({ ticker, type }));
    const stockSector = typeof raw.stockSector === 'string' ? canonicalSector(raw.stockSector) : 'all';
    const favorites = Array.isArray(raw.favorites) ? raw.favorites.filter((ticker) => list.some((row) => row.ticker === ticker)) : [];
    const sortOrder = ['margin', 'ticker', 'price', 'reference'].includes(raw.sortOrder) ? raw.sortOrder : 'margin';
    const strategies = Object.fromEntries(Object.entries(raw.strategies || {}).filter(([ticker, strategy]) => /^[A-Z]{4}\d{1,2}$/.test(ticker) && Object.hasOwn(STRATEGY_LABELS, strategy)).slice(0, 100));
    return { list, stockSector, favorites, sortOrder, strategies };
  } catch { return defaults(); }
}

let settings = readSaved();
const assets = new Map();
let preview = null;
let searchBusy = false;
let refreshBusy = false;
let activeType = 'stock';
let selectedTicker = null;
let favoriteOnly = false;
const requests = new Map();

function notify(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
  $('message').hidden = !text;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); return true; }
  catch {
    notify('O navegador não permitiu salvar. Sua lista ficará disponível somente nesta sessão.', true);
    return false;
  }
}

function strategyFor(asset) {
  return settings.strategies?.[asset.ticker] || DEFAULT_STRATEGIES[asset.ticker] || 'balanced';
}

function evaluateAsset(asset) {
  return model.evaluate(asset, asset.type === 'stock' ? { ...STOCK_CONFIG, strategy: strategyFor(asset) } : FII_CONFIG);
}

function strategyControl(asset) {
  const current = strategyFor(asset);
  const caution = current === 'growth' ? ' Graham usa lucro e patrimônio atuais; não projeta crescimento nem normaliza ciclos.' : '';
  return `<div class="strategy-control" role="group" aria-label="Estratégia de ${escape(asset.ticker)}"><span>Perfil do ativo</span><div>${Object.entries(STRATEGY_LABELS).map(([key, label]) => `<button type="button" data-strategy="${key}" data-ticker="${escape(asset.ticker)}" aria-pressed="${key === current}" title="${escape(STRATEGY_METHODS[key])}">${label}</button>`).join('')}</div><small>Preço de compra usa ${escape(STRATEGY_METHODS[current])} com dados válidos.${caution}</small></div>`;
}

function favoriteIcon(active) {
  return `<svg class="favorite-star" viewBox="0 0 24 24" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`;
}

function readSnapshots() {
  try {
    const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function cacheAsset(asset) {
  if (!asset || asset.error) return;
  try {
    const snapshots = readSnapshots();
    const tickers = new Set(settings.list.map((item) => item.ticker));
    for (const ticker of Object.keys(snapshots)) if (!tickers.has(ticker)) delete snapshots[ticker];
    snapshots[asset.ticker] = { savedAt: Date.now(), data: asset };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Cached data is optional; the live request remains the source of truth.
  }
}

function hydrateCachedAssets() {
  const snapshots = readSnapshots();
  const now = Date.now();
  let count = 0;
  for (const entry of settings.list) {
    const snapshot = snapshots[entry.ticker];
    const age = now - snapshot?.savedAt;
    const asset = snapshot?.data;
    if (!Number.isFinite(age) || age < 0 || age > SNAPSHOT_MAX_AGE_MS || asset?.ticker !== entry.ticker || asset.type !== entry.type) continue;
    assets.set(entry.ticker, age <= SNAPSHOT_QUOTE_AGE_MS ? asset : {
      ...asset,
      currentPrice: null,
      sourceDate: null,
      quoteSource: null,
      quoteSourceUrl: null,
      quoteProvider: null,
      quoteStatus: 'cached_expired',
    });
    count += 1;
  }
  return count;
}

function applySettings() {
  settings.stockSector = canonicalSector(settings.stockSector);
}

function logo(asset) {
  const url = /^https:\/\/investidor10\.com\.br\/storage\//.test(asset.logoUrl || '') ? asset.logoUrl : null;
  return `<span class="logo"><span>${escape(asset.ticker.slice(0, 2))}</span>${url ? `<img src="${escape(url)}" alt="" loading="lazy" />` : ''}</span>`;
}


function qualityBadge(score) {
  if (!Number.isFinite(score)) return '<span class="quality-badge neutral">—</span>';
  const level = score >= 7 ? 'good' : score >= 5 ? 'warn' : 'bad';
  return `<span class="quality-badge ${level}">${score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>`;
}


function metricValue(value, kind = 'number') {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'text') return escape(value);
  if (!Number.isFinite(value)) return '—';
  if (kind === 'money') return money(value);
  if (kind === 'percent') return percent(value);
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function metricRule(asset, key) {
  const group = stockSector(asset);
  const rules = {
    default: {
      roe: { min: 12, label: 'ideal acima de 12%' },
      payout: { min: 20, max: 80, label: 'ideal entre 20% e 80%' },
      pvp: { max: 2.5, label: 'atenção acima de 2,5x' },
      pl: { max: 15, label: 'atenção acima de 15x' },
      netDebtEbitda: { max: 3, label: 'ideal abaixo de 3x' },
      grossDebtEquity: { max: 1, label: 'ideal abaixo de 1x' },
      profitCagr5y: { min: 5, label: 'ideal acima de 5%' },
      dividendYield: { min: 5, label: 'ideal acima de 5%' },
    },
    Bancos: { roe: { min: 15, label: 'bancos: ROE acima de 15%' }, pvp: { max: 1.8, label: 'bancos: P/VP até 1,8x' }, payout: { min: 20, max: 70, label: 'bancos: payout entre 20% e 70%' } },
    Seguros: { roe: { min: 15, label: 'seguros: ROE acima de 15%' }, pvp: { max: 2.5, label: 'seguros: P/VP até 2,5x' } },
    Elétricas: { roe: { min: 10, label: 'elétricas: ROE acima de 10%' }, netDebtEbitda: { max: 3.5, label: 'elétricas: dívida líquida/EBITDA até 3,5x' }, payout: { min: 40, max: 95, label: 'elétricas: payout entre 40% e 95%' } },
    Saneamento: { roe: { min: 10, label: 'saneamento: ROE acima de 10%' }, netDebtEbitda: { max: 3.5, label: 'saneamento: dívida líquida/EBITDA até 3,5x' } },
    Commodities: { roe: { min: 12, label: 'commodities: ROE acima de 12%' }, netDebtEbitda: { max: 2.5, label: 'commodities: dívida líquida/EBITDA até 2,5x' }, payout: { min: 20, max: 80, label: 'commodities: payout entre 20% e 80%' } },
    Holdings: { roe: { min: 12, label: 'holdings: ROE acima de 12%' }, pvp: { max: 1.8, label: 'holdings: P/VP até 1,8x' } },
  };
  return { ...rules.default[key], ...(rules[group]?.[key] || {}) };
}

function metricStatus(asset, key, value) {
  if (!Number.isFinite(value)) return { className: 'neutral', label: 'Sem parâmetro confiável' };
  if (strategyFor(asset) === 'growth' && ['payout', 'dividendYield'].includes(key)) {
    return { className: 'neutral', label: 'Informativo neste perfil' };
  }
  const rule = metricRule(asset, key);
  const goodMin = rule.min === undefined || value >= rule.min;
  const goodMax = rule.max === undefined || value <= rule.max;
  return { className: goodMin && goodMax ? 'good' : 'bad', label: rule.label || 'Parâmetro geral' };
}

function fundamentalsGrid(asset) {
  const f = asset.fundamentals || {};
  const items = asset.type === 'stock'
    ? [
      ['roe', 'ROE', f.roe, 'percent'], ['payout', 'Payout', f.payout, 'percent'], ['pvp', 'P/VP', f.pvp], ['pl', 'P/L', f.pl],
      ['dividendYield', 'DY atual', f.dividendYield, 'percent'], ['netDebtEbitda', 'Dív. líq./EBITDA', f.netDebtEbitda], ['grossDebtEquity', 'Dív. bruta/PL', f.grossDebtEquity], ['profitCagr5y', 'CAGR lucro 5a', f.profitCagr5y, 'percent'],
    ]
    : [
      ['segment', 'Segmento', f.segment, 'text'], ['fundType', 'Tipo', f.fundType, 'text'], ['vacancy', 'Vacância', f.vacancy, 'percent'], ['managementType', 'Gestão', f.managementType, 'text'],
      ['equityValuePerShare', 'VP/cota', f.equityValuePerShare, 'money'], ['lastIncome', 'Último rendimento', f.lastIncome, 'money'], ['shareholders', 'Cotistas', f.shareholders, 'text'], ['sharesIssued', 'Cotas emitidas', f.sharesIssued, 'text'],
    ];
  return `<section class="method-block"><h3>Indicadores relevantes</h3><div class="metrics-grid">${items.map(([key, label, value, kind]) => {
    const status = asset.type === 'stock' ? metricStatus(asset, key, value) : { className: 'neutral', label: 'Dados do fundo' };
    return `<button type="button" class="metric-card ${status.className}" data-metric="${escape(key)}" data-label="${escape(label)}" data-value="${escape(metricValue(value, kind))}" data-rule="${escape(status.label)}"><span>${label}</span><strong>${metricValue(value, kind)}</strong><small>${escape(status.label)}</small></button>`;
  }).join('')}</div><div id="metric-history" class="metric-history" hidden></div></section>`;
}

function stockSector(asset) {
  const tickerSector = SEARCH_UNIVERSE.find((item) => item.tickers.includes(asset.ticker))?.sector;
  return canonicalSector(tickerSector || asset.profile?.sectorGroup || asset.profile?.sector || 'Outros');
}

function renderSectorFilter() {
  const counts = new Map();
  for (const item of settings.list) {
    const asset = assets.get(item.ticker);
    if (item.type === 'stock') {
      const sector = stockSector(asset || item);
      counts.set(sector, (counts.get(sector) || 0) + 1);
    }
  }
  if (settings.stockSector !== 'all' && !counts.has(settings.stockSector)) settings.stockSector = 'all';
  $('sector-current').textContent = settings.stockSector === 'all' ? 'Todos' : settings.stockSector;
  $('sector-options').innerHTML = ['all', ...DEFAULT_SECTORS.filter((sector) => counts.has(sector))].map((sector) => {
    const selected = settings.stockSector === sector;
    const label = sector === 'all' ? 'Todos os setores' : sector;
    return `<button type="button" class="filter-option ${selected ? 'selected' : ''}" data-sector="${escape(sector)}" aria-pressed="${selected}">${sector === 'all' ? '<span class="sector-dot all-sectors">' + icon('layout-grid') + '</span>' : sectorIcon(sector)}<span>${escape(label)}</span>${sector === 'all' ? '' : `<small>${counts.get(sector)}</small>`}${selected ? icon('check') : ''}</button>`;
  }).join('');
}

function renderSortFilter() {
  const options = [
    ['margin', 'Maior margem'],
    ['ticker', 'Ativo A–Z'],
    ['price', 'Menor cotação'],
    ['reference', activeType === 'stock' ? 'Menor preço de compra' : 'Menor valor de referência'],
  ];
  $('sort-current').textContent = options.find(([value]) => value === settings.sortOrder)?.[1] || options[0][1];
  $('sort-options').innerHTML = options.map(([value, label]) => {
    const selected = settings.sortOrder === value;
    return `<button type="button" class="filter-option ${selected ? 'selected' : ''}" data-sort="${value}" aria-pressed="${selected}"><span>${escape(label)}</span>${selected ? icon('check') : ''}</button>`;
  }).join('');
}

function closeFilters() {
  $('sector-control').open = false;
  $('sort-control').open = false;
}

function renderMetricHistory(button) {
  const target = $('metric-history');
  if (!target || !preview) return;
  const key = button.dataset.metric;
  const label = button.dataset.label;
  const value = button.dataset.value;
  const rule = button.dataset.rule;
  const annual = preview.dividends?.annualTotals || [];
  if ((key === 'dividendYield' || key === 'lastIncome') && annual.length) {
    const max = Math.max(...annual.map((row) => row.total), 0);
    target.innerHTML = `<div class="metric-history-title"><strong>${escape(label)}</strong><span>${escape(rule)}</span></div><div class="mini-bars">${annual.map((row) => `<div><span style="height:${max > 0 ? Math.max(8, row.total / max * 88) : 8}%"></span><small>${row.year}</small><b>${money(row.total, 2)}</b></div>`).join('')}</div>`;
  } else {
    target.innerHTML = `<div class="metric-history-title"><strong>${escape(label)}</strong><span>${escape(rule)}</span></div><p>Valor atual: <b>${escape(value)}</b>. Histórico estruturado desse indicador não veio limpo da fonte pública, então o app não desenha série estimada.</p>`;
  }
  target.hidden = false;
}


function fiiAnalysisSections(asset, valuation, history) {
  const fii = valuation.fii || {};
  const risks = Array.isArray(fii.risks) ? fii.risks : [];
  const samples = history?.normalizedSamples || 0;
  return `<section class="method-block"><div class="method-heading"><h3>Valor de referência</h3><strong>${money(fii.referenceValue)}</strong></div>
    <div class="calculation-inputs"><span>K exigido <b>${percent(fii.requiredReturn)}</b></span><span>Peso renda <b>${percent((fii.incomeWeight || 0) * 100)}</b></span><span>Peso VPA <b>${percent((fii.equityWeight || 0) * 100)}</b></span></div>
    <div class="formula">
      D mensal normalizado = <b>${money(fii.normalizedMonthlyDividend, 4)}</b><br>
      D anual = 12 × ${money(fii.normalizedMonthlyDividend, 4)} = <b>${money(fii.normalizedAnnualDividend, 4)}</b><br>
      P renda = ${money(fii.normalizedAnnualDividend, 4)} ÷ ${percent(fii.requiredReturn)} = <b>${money(fii.incomePrice)}</b><br>
      VR = ${percent((fii.incomeWeight || 0) * 100)} × ${money(fii.incomePrice)} + ${percent((fii.equityWeight || 0) * 100)} × ${money(fii.vpa)} = <b>${money(fii.referenceValue)}</b><br>
      Desconto = (${money(fii.referenceValue)} ÷ ${money(asset.currentPrice)} − 1) × 100 = <b>${percent(fii.discount)}</b>
    </div>
    <p>${escape(history?.normalizedBasis || 'Renda normalizada indisponível.')} Amostra: ${samples} ${samples === 1 ? 'mês' : 'meses'} com distribuição positiva.</p></section>
    <section class="method-block"><div class="method-heading"><h3>Patrimônio e qualidade</h3><strong>${qualityBadge(fii.qualityScore)}</strong></div>
    <div class="calculation-inputs"><span>VPA <b>${money(fii.vpa)}</b></span><span>P/VP <b>${Number.isFinite(fii.pvp) ? fii.pvp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</b></span><span>DY normalizado <b>${percent(fii.normalizedDy)}</b></span></div>
    <div class="risk-list">${risks.map((risk) => `<span>${escape(risk)}</span>`).join('')}</div>
    <p>Classificação: <b>${escape(fii.classification || 'Sem dados suficientes')}</b>. O fundo só entra como candidato quando desconto é positivo e nota de qualidade é pelo menos 7.</p></section>`;
}


function referencePrice(asset) {
  const value = asset.type === 'stock' ? asset.valuation?.buyPrice : asset.valuation?.fii?.referenceValue;
  return Number.isFinite(value) && value > 0 && !asset.error && (asset.type !== 'fii' || Number.isFinite(FII_CONFIG.requiredReturn)) ? value : null;
}

function recentQuote(asset) {
  if (!Number.isFinite(asset.currentPrice) || asset.currentPrice <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(asset.sourceDate || '')) return false;
  const age = Date.now() - new Date(asset.sourceDate + 'T12:00:00Z').getTime();
  return age >= -86_400_000 && age <= 7 * 86_400_000;
}

function assetMargin(asset) {
  return referencePrice(asset) === null || !recentQuote(asset) ? null : Number.isFinite(asset.valuation?.margin) ? asset.valuation.margin : null;
}

function assetStatus(asset) {
  const margin = assetMargin(asset);
  if (margin === null) return { text: asset.loading ? 'Consultando' : !recentQuote(asset) ? 'Cotação indisponível' : 'Sem dados', className: 'neutral' };
  if (asset.type === 'fii') {
    if (margin > 5) return { text: 'Desconto, avaliar', className: 'positive' };
    if (margin >= -5) return { text: 'Próximo do justo', className: 'neutral' };
    return { text: 'Acima do valor', className: 'negative' };
  }
  return margin >= 0 ? { text: 'Dentro do preço', className: 'positive' } : { text: 'Acima do preço', className: 'negative' };
}

function quoteDate(asset) {
  return /^\d{4}-\d{2}-\d{2}$/.test(asset.sourceDate || '') ? asset.sourceDate.split('-').reverse().join('/') : 'data indisponível';
}

function sortedAssets(type) {
  const list = settings.list.filter((item) => item.type === type)
    .map((item) => assets.get(item.ticker) || { ...item, loading: true })
    .filter((asset) => type !== 'stock' || settings.stockSector === 'all' || stockSector(asset) === settings.stockSector)
    .filter((asset) => !favoriteOnly || settings.favorites.includes(asset.ticker));
  const ranked = model.rank(list, type === 'stock' ? (asset) => ({ ...STOCK_CONFIG, strategy: strategyFor(asset) }) : FII_CONFIG);
  if (settings.sortOrder === 'ticker') ranked.sort((a, b) => a.ticker.localeCompare(b.ticker));
  if (settings.sortOrder === 'price') ranked.sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity));
  if (settings.sortOrder === 'reference') ranked.sort((a, b) => (referencePrice(a) ?? Infinity) - (referencePrice(b) ?? Infinity));
  return ranked;
}

function renderClassCompact(type) {
  const ranked = sortedAssets(type);
  const target = $(type === 'stock' ? 'stocks-list' : 'fiis-list');
  if (type === activeType && !ranked.some((asset) => asset.ticker === selectedTicker)) selectedTicker = ranked[0]?.ticker || null;
  if (!ranked.length) {
    const message = favoriteOnly ? 'Nenhum favorito nesta lista.' : type === 'stock' && settings.stockSector !== 'all' ? 'Nenhuma ação neste setor.' : type === 'stock' ? 'Nenhuma ação adicionada.' : 'Nenhum FII adicionado.';
    target.innerHTML = `<div class="empty compact-empty">${icon(type === 'stock' ? 'chart-no-axes-combined' : 'building-2')}<p>${message}</p></div>`;
    return ranked;
  }
  const visible = type === 'stock' ? ranked.slice(0, stockVisibleCount) : ranked;
  target.innerHTML = `<div class="table-scroll" tabindex="0" role="region" aria-label="Ranking de ${type === 'stock' ? 'ações' : 'FIIs'}"><table class="asset-table compact-table">
    <thead><tr><th scope="col">Ativo</th><th scope="col">Cotação</th><th scope="col">${type === 'stock' ? 'Preço de compra' : 'Valor de referência'}</th><th scope="col">${type === 'stock' ? 'Margem' : 'Desconto'}</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${visible.map((asset, index) => {
      const margin = assetMargin(asset);
      const status = assetStatus(asset);
      const label = asset.loading ? 'Consultando…' : asset.error ? 'Consulta indisponível' : asset.name || asset.ticker;
      const favorite = settings.favorites.includes(asset.ticker);
      return `<tr class="${asset.ticker === selectedTicker && type === activeType ? 'selected-row' : ''}" data-row-ticker="${escape(asset.ticker)}"><td class="identity-cell"><div class="asset-name"><span class="rank-index" aria-label="Posição ${index + 1}">#${index + 1}</span>${logo(asset)}<button class="asset-link" type="button" data-action="select" data-ticker="${escape(asset.ticker)}" aria-label="Selecionar ${escape(asset.ticker)}">${escape(asset.ticker)}<small title="${escape(label)}">${escape(label)}</small>${type === 'stock' ? `<span class="strategy-tag">${escape(STRATEGY_LABELS[strategyFor(asset)])}</span>` : ''}</button></div></td>
        <td data-label="Cotação"><span class="cell-value">${money(recentQuote(asset) ? asset.currentPrice : null)}</span>${Number.isFinite(asset.currentPrice) ? `<small class="quote-date">${escape(quoteDate(asset))}</small>` : ''}</td>
        <td data-label="${type === 'stock' ? 'Preço de compra' : 'Valor de referência'}" class="price-selected">${money(referencePrice(asset))}</td>
        <td data-label="${type === 'stock' ? 'Margem' : 'Desconto'}" class="${margin === null ? '' : margin >= 0 ? 'positive-text' : 'negative-text'}">${percent(margin)}</td>
        <td data-label="Situação"><span class="status-pill ${status.className}">${status.text}</span></td>
        <td class="actions-cell"><div class="row-actions"><button class="icon-button favorite-button ${favorite ? 'active' : ''}" type="button" data-action="favorite" data-ticker="${escape(asset.ticker)}" aria-pressed="${favorite}" title="${favorite ? 'Desfavoritar' : 'Favoritar'} ${escape(asset.ticker)}" aria-label="${favorite ? 'Desfavoritar' : 'Favoritar'} ${escape(asset.ticker)}">${favoriteIcon(favorite)}</button><button class="icon-button remove" type="button" data-action="remove" data-ticker="${escape(asset.ticker)}" title="Remover ${escape(asset.ticker)}" aria-label="Remover ${escape(asset.ticker)}">${icon('trash-2')}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>${type === 'stock' && ranked.length > visible.length ? `<div class="show-more-row"><button class="button secondary" type="button" data-action="show-more-stocks">Mostrar mais ${Math.min(STOCK_PAGE_SIZE, ranked.length - visible.length)}</button></div>` : ''}`;
  return ranked;
}

function methodLine(label, value, maximum) {
  const width = Number.isFinite(value) && maximum > 0 ? Math.max(4, value / maximum * 100) : 0;
  return `<div class="method-line"><span>${label}</span><div class="method-track"><i style="width:${width}%"></i></div><strong>${money(value)}</strong></div>`;
}

function renderInsight(ranked) {
  const panel = $('asset-insight');
  const asset = assets.get(selectedTicker);
  if (!selectedTicker) {
    panel.innerHTML = `<div class="insight-empty">${icon('scan-search')}<h2>Nenhum ativo selecionado</h2></div>`;
    return;
  }
  if (!asset || asset.loading || asset.error) {
    panel.innerHTML = `<div class="insight-empty">${icon(asset?.error ? 'circle-help' : 'scan-search')}<h2>${escape(selectedTicker)}</h2><p>${escape(asset?.error || 'Consultando dados do ativo…')}</p></div>`;
    return;
  }
  const valuation = evaluateAsset(asset);
  const view = { ...asset, valuation };
  const reference = referencePrice(view);
  const margin = assetMargin(view);
  const status = assetStatus(view);
  const sector = asset.type === 'stock' ? stockSector(asset) : asset.fundamentals?.segment || 'FII';
  const control = asset.type === 'stock' ? (asset.profile?.controlType === 'state' ? 'Estatal' : 'Privada') : asset.fundamentals?.fundType || 'Fundo imobiliário';
  const source = /^https:\/\/investidor10\.com\.br\//.test(asset.source || '') ? asset.source : null;
  const quoteSource = asset.quoteSourceUrl === 'https://stock-teto-api.vercel.app/docs' ? asset.quoteSourceUrl : null;
  const methods = [valuation.bazin, valuation.graham, valuation.gordon].filter(Number.isFinite);
  const maximum = Math.max(...methods, 0);
  const fii = valuation.fii || {};
  const fiiIncomePrice = reference === null ? null : fii.incomePrice;
  const fiiMaximum = Math.max(fiiIncomePrice || 0, fii.vpa || 0);
  const position = ranked.findIndex((item) => item.ticker === asset.ticker) + 1;
  panel.innerHTML = `<div class="insight-heading">${logo(asset)}<div><h2>${escape(asset.ticker)}</h2><strong>${escape(asset.name || asset.ticker)}</strong><small>${escape(sector)} · ${escape(control)}</small></div>${position ? `<span class="rank-summary" title="Posição conforme os filtros e a ordenação atuais"><span>Posição</span><strong>#${position}</strong><span>de ${ranked.length}</span></span>` : ''}</div>
    <div class="insight-source">${recentQuote(asset) ? `Cotação de ${escape(quoteDate(asset))}` : 'Cotação indisponível'} · ${quoteSource ? `<a href="${quoteSource}" target="_blank" rel="noopener noreferrer">Stock Teto API</a>` : 'API indisponível'}${source ? ` · <a href="${escape(source)}" target="_blank" rel="noopener noreferrer">Fundamentos</a>` : ''}</div>
    ${asset.type === 'stock' ? strategyControl(asset) : ''}
    <div class="insight-primary"><div><small>${asset.type === 'stock' ? 'Preço de compra' : 'Valor de referência'}</small><strong>${money(reference)}</strong></div><div><small>${asset.type === 'stock' ? 'Margem de segurança' : 'Desconto estimado'}</small><strong class="${margin === null ? '' : margin >= 0 ? 'positive-text' : 'negative-text'}">${percent(margin)}</strong></div></div>
    <div class="insight-status"><span class="status-pill ${status.className}">${status.text}</span><span>Cotação ${money(recentQuote(asset) ? asset.currentPrice : null)}</span></div>
    ${asset.type === 'stock'
      ? `<section class="insight-methods"><h3>Preços por método</h3>${methodLine('Bazin 10%', valuation.bazin, maximum)}${methodLine('Graham', valuation.graham, maximum)}${methodLine('Gordon', valuation.gordon, maximum)}</section><div class="insight-breakdown"><span>Referência do perfil <strong>${money(valuation.fairAverage)}</strong></span><span>Margem aplicada <strong>${percent(valuation.safetyMargin)}</strong></span></div>`
      : `<section class="insight-methods"><h3>Renda e patrimônio</h3>${methodLine('Pela renda', fiiIncomePrice, fiiMaximum)}${methodLine('VPA', fii.vpa, fiiMaximum)}</section><div class="insight-breakdown"><span>Div. normalizado <strong>${money(fii.normalizedMonthlyDividend, 4)}</strong></span><span>DY normalizado <strong>${percent(fii.normalizedDy)}</strong></span><span>P/VP <strong>${Number.isFinite(fii.pvp) ? fii.pvp.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}</strong></span><span>Nota indicativa <strong>${Number.isFinite(fii.qualityScore) ? fii.qualityScore.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</strong></span></div><p class="insight-caution">Qualidade requer verificar imóveis, contratos e concentração.${reference === null ? ' Taxa mínima indisponível.' : ''}</p>`}
    <button class="insight-detail" type="button" data-action="analyze" data-ticker="${escape(asset.ticker)}">Ver memória de cálculo ${icon('arrow-right')}</button>`;
}

function render() {
  const count = settings.list.length;
  document.querySelector('.workspace-grid').classList.toggle('is-empty', count === 0);
  if (!count) $('sync-status').textContent = 'Sem consultas';
  $('asset-count').textContent = `${count} ${count === 1 ? 'ativo' : 'ativos'}`;
  $('stock-count').textContent = settings.list.filter((item) => item.type === 'stock').length;
  $('fii-count').textContent = settings.list.filter((item) => item.type === 'fii').length;
  for (const type of ['stock', 'fii']) {
    $(type + '-tab').setAttribute('aria-selected', String(activeType === type));
    $(type === 'stock' ? 'stocks-section' : 'fiis-section').hidden = activeType !== type;
  }
  $('sector-control').hidden = activeType !== 'stock';
  $('favorites-filter').setAttribute('aria-pressed', String(favoriteOnly));
  $('favorites-filter').innerHTML = favoriteIcon(favoriteOnly);
  renderSectorFilter();
  renderSortFilter();
  const stocks = renderClassCompact('stock');
  const fiis = renderClassCompact('fii');
  renderInsight(activeType === 'stock' ? stocks : fiis);
}

function showAnalysis(asset) {
  preview = asset;
  const valuation = evaluateAsset(asset);
  const bazinYield = valuation.assumptions.bazinYield;
  const gordonGrowth = valuation.assumptions.gordonGrowth;
  const history = asset.dividends;
  const saved = settings.list.some((item) => item.ticker === asset.ticker);
  const sourceDate = asset.sourceDate ? asset.sourceDate.split('-').reverse().join('/') : null;
  const quoteSource = asset.quoteSourceUrl === 'https://stock-teto-api.vercel.app/docs' ? asset.quoteSourceUrl : null;
  const consulted = new Date(asset.consultedAt).toLocaleString('pt-BR');
  const profile = asset.profile || {};
  const profileBody = asset.type === 'stock' ? `<section class="company-brief"><p>${escape(profile.description || 'Descrição breve indisponível na fonte.')}</p><div><span>${escape(stockSector(asset))}</span><span>${escape(profile.subsector || profile.sector || 'Setor indisponível')}</span><span>${profile.controlType === 'state' ? 'Estatal · margem 20%' : 'Privada · margem 15%'}</span></div></section>` : '';
  const historyBody = history?.complete ? `
    <table class="annual-table"><thead><tr><th>Ano · data com</th><th>Proventos por ${asset.type === 'fii' ? 'cota' : 'ação'}</th></tr></thead><tbody>${history.annualTotals.map((row) => `<tr><td>${row.year}</td><td>${money(row.total, 4)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Média anual</td><td>${money(history.average, 4)}</td></tr></tfoot></table>
    <div class="formula">${money(history.total, 4)} ÷ 5 = ${money(history.average, 4)}<br>${money(history.average, 4)} ÷ ${percent(bazinYield)} = <b>${money(valuation.bazin)}</b></div>
    <p>${escape(history.basis)}</p>` : `<p>${escape(history?.reason || 'Histórico indisponível.')}</p>`;
  const grahamBody = asset.type === 'stock' ? `<section class="method-block"><div class="method-heading"><h3>Graham</h3><strong>${money(valuation.graham)}</strong></div>
    <div class="calculation-inputs"><span>LPA <b>${money(asset.lpa)}</b></span><span>VPA <b>${money(asset.vpa)}</b></span></div>
    ${valuation.graham !== null ? `<div class="formula">√(22,5 × ${money(asset.lpa)} × ${money(asset.vpa)}) = <b>${money(valuation.graham)}</b></div>` : '<p>O cálculo exige LPA e VPA positivos, disponíveis na fonte.</p>'}</section>` : '';
  const gordonBody = asset.type === 'stock' ? `<section class="method-block"><div class="method-heading"><h3>Gordon</h3><strong>${money(valuation.gordon)}</strong></div>
    ${gordonGrowth ? `<div class="calculation-inputs"><span>Dividendo base <b>${money(valuation.assumptions.gordonDividendBase, 4)}</b></span><span>Crescimento usado <b>${percent(gordonGrowth.selected)}</b></span><span>Retorno exigido <b>${percent(valuation.assumptions.gordonReturn)}</b></span></div>
    <div class="formula">${money(valuation.assumptions.gordonNextDividend, 4)} ÷ (${percent(valuation.assumptions.gordonReturn)} − ${percent(gordonGrowth.selected)}) = <b>${money(valuation.gordon)}</b></div>
    <p>Use com cautela em ações. O crescimento fica limitado pelo menor valor entre CAGR dos dividendos (${percent(gordonGrowth.dividendCagr)}), ROE × retenção (${percent(gordonGrowth.sustainableGrowth)}) e teto de ${percent(gordonGrowth.cap)}.</p>` : '<p>Gordon exige histórico completo de proventos em dinheiro.</p>'}</section>` : '';
  const averageBody = asset.type === 'stock' ? `<section class="method-block"><div class="method-heading"><h3>Preço de compra</h3><strong>${money(valuation.buyPrice)}</strong></div>
    <div class="calculation-inputs"><span>Métodos usados <b>${escape(valuation.includedMethods.map((name) => methodNames[name]).join(' + ') || 'Nenhum')}</b></span><span>Referência <b>${money(valuation.fairAverage)}</b></span><span>Margem aplicada <b>${percent(valuation.safetyMargin)}</b></span></div>
    ${Number.isFinite(valuation.buyPrice) ? `<div class="formula">${money(valuation.fairAverage)} × (1 − ${percent(valuation.safetyMargin)}) = <b>${money(valuation.buyPrice)}</b></div>` : '<p>Dados insuficientes para os métodos deste perfil. Nenhum preço de compra foi estimado.</p>'}</section>` : '';
  const stockAnalysisBody = asset.type === 'stock' ? `${profileBody}${strategyControl(asset)}${fundamentalsGrid(asset)}${averageBody}${grahamBody}${gordonBody}
    <section class="method-block"><div class="method-heading"><h3>Bazin histórico · ${percent(bazinYield)}</h3><strong>${money(valuation.bazin)}</strong></div>${historyBody}</section>
    <section class="method-block"><div class="method-heading"><h3>Margem · ${escape(methodNames[valuation.selectedMethod] || 'Bazin 10%')}</h3><strong>${percent(valuation.margin)}</strong></div>${Number.isFinite(valuation.margin) ? `<div class="formula">(1 − ${money(asset.currentPrice)} ÷ ${money(valuation.selected)}) × 100 = ${percent(valuation.margin)}</div>` : '<p>Sem dados suficientes para calcular a margem.</p>'}</section>` : '';
  const fiiAnalysisBody = asset.type === 'fii' ? `${fundamentalsGrid(asset)}${fiiAnalysisSections(asset, valuation, history)}` : '';
  $('analysis-content').innerHTML = `<div class="dialog-title">${logo(asset)}<div><h2 id="analysis-title">${asset.ticker}</h2><p>${escape(asset.name)} · ${asset.type === 'fii' ? 'FII' : 'Ação'}</p></div><div class="dialog-quote"><small>Cotação${sourceDate ? ` · ${sourceDate}` : ''}</small><strong>${money(asset.currentPrice)}</strong></div></div>
    ${stockAnalysisBody}${fiiAnalysisBody}
    <div class="dialog-bottom"><div class="source">Cotação: ${quoteSource ? `<a href="${quoteSource}" target="_blank" rel="noopener noreferrer">Stock Teto API ↗</a>` : 'indisponível'}<br><a href="${escape(asset.source)}" target="_blank" rel="noopener noreferrer">Fundamentos: Investidor10 ↗</a><br>Consulta: ${escape(consulted)}</div><button class="button ${saved ? 'secondary' : 'primary'}" id="dialog-add" ${saved ? 'disabled' : ''}>${icon(saved ? 'check' : 'plus')}${saved ? 'Adicionado' : 'Adicionar ativo'}</button></div>
    <p class="dialog-note">Estimativas por fórmula. Histórico de proventos não garante pagamentos futuros.${asset.type === 'fii' ? ' Em FIIs de papel, valide CRIs, garantias, LTV, duration e indexadores antes de concluir.' : ' Compare os métodos: cada ação pode pedir uma régua diferente.'}</p>`;
  $('dialog-add').addEventListener('click', () => { addAsset(asset); showAnalysis(asset); });
  if (!$('analysis-dialog').open) $('analysis-dialog').showModal();
}

function hideSuggestions() {
  const box = $('ticker-suggestions');
  if (box) box.hidden = true;
}

function renderSearchSuggestions() {
  const box = $('ticker-suggestions');
  const input = $('ticker');
  if (!box || !input) return;
  const suggestions = searchSuggestions(input.value);
  if (!suggestions.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.innerHTML = suggestions.map((item) => {
    const meta = sectorMeta(item.sector);
    return `<div class="suggestion-row" role="option">
      <div class="suggestion-company">${sectorIcon(item.sector)}<div><strong>${escape(item.company)}</strong><small>${escape(item.sector)} · ${escape(meta.legend)}</small></div></div>
      <div class="ticker-chips">${item.tickers.map((ticker) => `<button type="button" data-suggest-ticker="${escape(ticker)}">${escape(ticker)}</button>`).join('')}</div>
    </div>`;
  }).join('');
  box.hidden = false;
}

function resolveSearchTicker(value) {
  const ticker = tickerSearchValue(value);
  if (/^[A-Z]{4}\d{1,2}$/.test(ticker)) return ticker;
  const suggestion = searchSuggestions(value, 1)[0];
  return suggestion?.tickers?.[0] || ticker;
}

async function requestAsset(ticker) {
  if (requests.has(ticker)) return requests.get(ticker);
  const task = (async () => {
    const response = await fetch(`/api/prices/${encodeURIComponent(ticker)}`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    const json = await response.json();
    if (!response.ok || !json.data || json.data.ticker !== ticker) throw new Error(json.error || 'Não foi possível consultar esse ativo.');
    return json.data;
  })();
  requests.set(ticker, task);
  try { return await task; } finally { requests.delete(ticker); }
}

function addAsset(asset) {
  if (settings.list.some((item) => item.ticker === asset.ticker)) {
    notify(`${asset.ticker} já está na lista.`);
    return;
  }
  if (settings.list.length >= 50) { notify('Limite de 50 ativos. Remova um ativo antes de adicionar outro.', true); return; }
  settings.list.push({ ticker: asset.ticker, type: asset.type });
  assets.set(asset.ticker, asset);
  cacheAsset(asset);
  activeType = asset.type;
  selectedTicker = asset.ticker;
  favoriteOnly = false;
  if (asset.type === 'stock') settings.stockSector = 'all';
  const saved = persist();
  render();
  if (saved) {
    $('sync-status').textContent = `Última consulta às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a cada minuto`;
    notify(`${asset.ticker} adicionado.`);
  }
}

async function search(value, action = 'analyze') {
  if (searchBusy) return;
  const ticker = resolveSearchTicker(value);
  if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) { notify('Informe um ticker válido, como BBAS3 ou GARE11.', true); $('ticker').focus(); return; }
  if (action === 'add' && settings.list.some((item) => item.ticker === ticker)) { notify(`${ticker} já está na lista.`); return; }
  searchBusy = true;
  $('add-button').disabled = true;
  $('analyze-button').disabled = true;
  $('search-form').setAttribute('aria-busy', 'true');
  notify(`Consultando ${ticker}…`);
  try {
    const asset = await requestAsset(ticker);
    if (settings.list.some((item) => item.ticker === ticker)) { assets.set(ticker, asset); cacheAsset(asset); render(); }
    if (action === 'add') { addAsset(asset); $('ticker').value = ''; hideSuggestions(); }
    else { notify(''); showAnalysis(asset); }
  } catch (error) { notify(error.name === 'TimeoutError' ? 'A consulta demorou mais que o esperado. Tente novamente.' : error.message, true); }
  finally {
    searchBusy = false;
    $('add-button').disabled = false;
    $('analyze-button').disabled = false;
    $('search-form').setAttribute('aria-busy', 'false');
  }
}

async function refreshSaved() {
  if (refreshBusy || document.hidden || !settings.list.length) return;
  refreshBusy = true;
  const queue = [...settings.list];
  const total = queue.length;
  let completed = 0;
  $('sync-status').textContent = queue.some((item) => assets.has(item.ticker)) ? 'Dados salvos · atualizando…' : 'Consultando dados…';
  let failed = 0;
  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      try {
        const asset = await requestAsset(entry.ticker);
        if (settings.list.some((item) => item.ticker === entry.ticker)) {
          assets.set(entry.ticker, asset);
          cacheAsset(asset);
          if (preview?.ticker === entry.ticker && $('analysis-dialog').open) showAnalysis(asset);
        }
      } catch {
        failed += 1;
        if (settings.list.some((item) => item.ticker === entry.ticker)) {
          const previous = assets.get(entry.ticker);
          assets.set(entry.ticker, previous && !previous.error ? {
            ...previous,
            currentPrice: null,
            sourceDate: null,
            quoteSource: null,
            quoteSourceUrl: null,
            quoteStatus: 'unavailable',
          } : { ...entry, error: 'Consulta indisponível. Nova tentativa automática em um minuto.' });
        }
        if (preview?.ticker === entry.ticker && $('analysis-dialog').open) { $('analysis-dialog').close(); notify('A atualização desse ativo falhou. Nova tentativa em um minuto.', true); }
      } finally {
        completed += 1;
        render();
        if (completed < total) $('sync-status').textContent = `Atualizando ${completed}/${total}…`;
      }
    }
  }
  try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); }
  finally {
    refreshBusy = false;
    render();
    $('sync-status').textContent = failed ? `${failed} ${failed === 1 ? 'consulta indisponível' : 'consultas indisponíveis'}. Nova tentativa em 1 min.` : `Última consulta às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a cada minuto`;
  }
}

$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  search($('ticker').value, event.submitter?.value || 'analyze');
});
$('ticker').addEventListener('input', renderSearchSuggestions);
$('ticker').addEventListener('focus', renderSearchSuggestions);
$('ticker').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideSuggestions();
});
document.querySelectorAll('.filter-menu').forEach((menu) => menu.addEventListener('toggle', () => {
  if (!menu.open) return;
  document.querySelectorAll('.filter-menu').forEach((other) => { if (other !== menu) other.open = false; });
}));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeFilters(); });
$('favorites-filter').addEventListener('click', () => {
  favoriteOnly = !favoriteOnly;
  render();
});
document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
  closeFilters();
  activeType = tab.dataset.tab;
  selectedTicker = null;
  render();
}));
document.addEventListener('click', (event) => {
  const sectorOption = event.target.closest('[data-sector]');
  if (sectorOption) {
    settings.stockSector = canonicalSector(sectorOption.dataset.sector);
    stockVisibleCount = STOCK_PAGE_SIZE;
    closeFilters();
    persist();
    render();
    return;
  }
  const sortOption = event.target.closest('[data-sort]');
  if (sortOption) {
    settings.sortOrder = sortOption.dataset.sort;
    closeFilters();
    persist();
    render();
    return;
  }
  if (!event.target.closest('.filter-menu')) closeFilters();
  const suggestion = event.target.closest('[data-suggest-ticker]');
  if (suggestion) {
    $('ticker').value = suggestion.dataset.suggestTicker;
    hideSuggestions();
    $('ticker').focus();
    return;
  }
  if (!event.target.closest('.searchbar')) hideSuggestions();
  const strategyButton = event.target.closest('[data-strategy]');
  if (strategyButton) {
    const { ticker, strategy } = strategyButton.dataset;
    if (!Object.hasOwn(STRATEGY_LABELS, strategy)) return;
    settings.strategies[ticker] = strategy;
    persist();
    render();
    if (preview?.ticker === ticker && $('analysis-dialog').open) showAnalysis(preview);
    return;
  }
  const metric = event.target.closest('.metric-card');
  if (metric) {
    renderMetricHistory(metric);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) {
    const row = event.target.closest('[data-row-ticker]');
    if (row) {
      selectedTicker = row.dataset.rowTicker;
      render();
      if (window.matchMedia('(max-width: 960px)').matches) $('asset-insight').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (button.dataset.action === 'show-more-stocks') {
    stockVisibleCount += STOCK_PAGE_SIZE;
    render();
    return;
  }
  const ticker = button.dataset.ticker;
  if (button.dataset.action === 'select') {
    selectedTicker = ticker;
    render();
    if (window.matchMedia('(max-width: 960px)').matches) $('asset-insight').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (button.dataset.action === 'favorite') {
    settings.favorites = settings.favorites.includes(ticker)
      ? settings.favorites.filter((item) => item !== ticker) : [...settings.favorites, ticker];
    persist();
    render();
    return;
  }
  if (button.dataset.action === 'remove') {
    settings.list = settings.list.filter((item) => item.ticker !== ticker);
    settings.favorites = settings.favorites.filter((item) => item !== ticker);
    delete settings.strategies[ticker];
    assets.delete(ticker);
    try {
      const snapshots = readSnapshots();
      delete snapshots[ticker];
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
    } catch {}
    if (selectedTicker === ticker) selectedTicker = null;
    const saved = persist();
    render();
    if (saved) notify(`${ticker} removido.`);
  } else {
    const asset = assets.get(ticker);
    if (asset && !asset.error) showAnalysis(asset);
    else search(ticker);
  }
});
document.addEventListener('error', (event) => {
  if (event.target.matches?.('.logo img')) event.target.remove();
}, true);
$('close-dialog').addEventListener('click', () => $('analysis-dialog').close());
$('analysis-dialog').addEventListener('click', (event) => {
  if (event.target !== $('analysis-dialog')) return;
  const box = event.target.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
});
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  settings = readSaved();
  applySettings();
  render();
  refreshSaved();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSaved(); });
applySettings();
hydrateCachedAssets();
render();
refreshSaved();
setInterval(refreshSaved, 60_000);
