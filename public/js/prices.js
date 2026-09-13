'use strict';

const STORAGE_KEY = 'stock-teto.fair-prices.v1';
const model = window.FairPriceModel;
const $ = (id) => document.getElementById(id);
const money = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const percent = (value) => Number.isFinite(value) ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name) => `<img src="/icons/${name}.svg" alt="" />`;
const defaults = () => ({ list: [], stockSector: 'all' });
const STOCK_CONFIG = { method: 'buy', bazinYield: 10, gordonReturn: 12 };
const FII_CONFIG = { method: 'fiiReference', requiredReturn: 10 };
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

function sectorPill(sector) {
  const canonical = canonicalSector(sector);
  const meta = sectorMeta(canonical);
  return `<span class="sector-pill" title="${escape(meta.legend)}" style="--sector-color:${meta.color}">${icon(meta.icon)}${escape(canonical)}</span>`;
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
    return { list, stockSector };
  } catch { return defaults(); }
}

let settings = readSaved();
const assets = new Map();
let preview = null;
let searchBusy = false;
let refreshBusy = false;
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

function applySettings() {
  settings.stockSector = canonicalSector(settings.stockSector);
}

function logo(asset) {
  const url = /^https:\/\/investidor10\.com\.br\/storage\//.test(asset.logoUrl || '') ? asset.logoUrl : null;
  return `<span class="logo"><span>${escape(asset.ticker.slice(0, 2))}</span>${url ? `<img src="${escape(url)}" alt="" loading="lazy" />` : ''}</span>`;
}

function priceCell(value, selected, reason, label) {
  return `<td data-label="${label}" class="${Number.isFinite(value) ? selected ? 'price-selected' : '' : 'unavailable'}"${!Number.isFinite(value) ? ` title="${escape(reason)}"` : ''}>${money(value)}</td>`;
}

function compactRisks(risks, limit = 2) {
  const clean = Array.isArray(risks) ? risks.filter(Boolean) : [];
  if (!clean.length) return 'Sem risco crítico capturado';
  const visible = clean.slice(0, limit).join('; ');
  return clean.length > limit ? `${visible}; +${clean.length - limit}` : visible;
}

function qualityBadge(score) {
  if (!Number.isFinite(score)) return '<span class="quality-badge neutral">—</span>';
  const level = score >= 7 ? 'good' : score >= 5 ? 'warn' : 'bad';
  return `<span class="quality-badge ${level}">${score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>`;
}

function classificationClass(label) {
  if (/boa qualidade/i.test(label)) return 'good';
  if (/justo/i.test(label)) return 'neutral';
  if (/riscos/i.test(label)) return 'warn';
  return 'bad';
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
  const filter = $('sector-filter');
  if (!filter) return;
  const current = settings.stockSector || 'all';
  const counts = new Map();
  for (const item of settings.list) {
    const asset = assets.get(item.ticker);
    if (asset?.type === 'stock') {
      const sector = stockSector(asset);
      counts.set(sector, (counts.get(sector) || 0) + 1);
    }
  }
  const valid = current === 'all' || DEFAULT_SECTORS.includes(current);
  if (!valid) settings.stockSector = 'all';
  const allCount = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const buttons = [
    { id: 'all', label: 'Todos', count: allCount, icon: 'layout-grid', color: '#101318', legend: 'Todos os setores' },
    ...DEFAULT_SECTORS.map((sector) => ({ id: sector, label: sector, count: counts.get(sector) || 0, ...sectorMeta(sector) })),
  ];
  filter.innerHTML = buttons.map((item) => `<button type="button" class="sector-button ${settings.stockSector === item.id ? 'active' : ''}" data-sector-filter="${escape(item.id)}" data-tooltip="${escape(item.legend)}" aria-pressed="${settings.stockSector === item.id}" title="${escape(item.legend)}" style="--sector-color:${item.color}">
    ${icon(item.icon)}<span>${escape(item.label)}</span>${item.count ? `<small>${item.count}</small>` : ''}
  </button>`).join('');
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

function renderFiiGroups(ranked) {
  const labels = ['Possivelmente descontado e de boa qualidade', 'Preço próximo do justo', 'Barato, mas com riscos relevantes', 'Possivelmente caro'];
  const groups = new Map(labels.map((label) => [label, []]));
  for (const asset of ranked) {
    const label = asset.valuation?.fii?.classification || 'Sem dados suficientes';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(asset);
  }
  return `<div class="fii-groups">${[...groups.entries()].map(([label, items]) => `<section class="fii-group ${classificationClass(label)}"><h3>${escape(label)}</h3><p>${items.length ? items.map((item) => item.ticker).join(', ') : 'Nenhum fundo'}</p></section>`).join('')}</div>`;
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

function renderClass(type) {
  const isStock = type === 'stock';
  const fullList = settings.list.filter((item) => item.type === type).map((item) => assets.get(item.ticker) || { ...item, loading: true });
  const list = isStock && settings.stockSector !== 'all'
    ? fullList.filter((asset) => stockSector(asset) === settings.stockSector) : fullList;
  const ranked = model.rank(list, isStock ? STOCK_CONFIG : FII_CONFIG);
  $(isStock ? 'stock-count' : 'fii-count').textContent = isStock && list.length !== fullList.length ? `${list.length}/${fullList.length}` : list.length;
  const target = $(isStock ? 'stocks-list' : 'fiis-list');
  if (!list.length) {
    target.innerHTML = `<div class="empty">${icon(isStock ? 'chart-no-axes-combined' : 'building-2')}<p>${isStock ? 'Nenhuma ação nesse setor.' : 'Nenhum FII adicionado.'}</p></div>`;
    return;
  }
  const visible = isStock ? ranked.slice(0, stockVisibleCount) : ranked;
  let place = 0;
  if (!isStock) {
    target.innerHTML = `<div class="table-scroll" tabindex="0" role="region" aria-label="Ranking de FIIs"><table class="asset-table fii-table">
    <thead><tr><th scope="col">FII</th><th scope="col">Preço atual</th><th scope="col">Div. norm.</th><th scope="col">DY norm.</th><th scope="col">VPA</th><th scope="col">P/VP</th><th scope="col">Preço renda</th><th scope="col">VR</th><th scope="col" aria-sort="descending">Desconto ↓</th><th scope="col">Nota</th><th scope="col">Principais riscos</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${visible.map((asset) => {
      const fii = asset.valuation.fii || {};
      const rowLabel = asset.loading ? 'Consultando…' : asset.error ? 'Consulta indisponível' : asset.name;
      return `<tr class="${asset.error ? 'error-row' : ''}"><td class="identity-cell"><div class="asset-name"><span class="rank">${Number.isFinite(fii.discount) ? ++place : '—'}</span>${logo(asset)}<button class="asset-link" data-action="analyze" data-ticker="${asset.ticker}">${asset.ticker}<small title="${escape(rowLabel)}">${escape(rowLabel)}</small></button></div></td>
      <td data-label="Preço atual">${money(asset.currentPrice)}</td>
      <td data-label="Dividendo normalizado">${money(fii.normalizedMonthlyDividend, 4)}</td>
      <td data-label="DY normalizado">${percent(fii.normalizedDy)}</td>
      <td data-label="VPA">${money(fii.vpa)}</td>
      <td data-label="P/VP">${Number.isFinite(fii.pvp) ? fii.pvp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
      <td data-label="Preço pela renda">${money(fii.incomePrice)}</td>
      <td data-label="Valor de referência" class="price-selected">${money(fii.referenceValue)}</td>
      <td data-label="Desconto estimado">${Number.isFinite(fii.discount) ? `<span class="margin ${fii.discount < 0 ? 'negative' : ''}">${percent(fii.discount)}<small>${escape(methodNames[asset.valuation.selectedMethod])}</small></span>` : '<span class="unavailable">—</span>'}</td>
      <td data-label="Nota de qualidade">${qualityBadge(fii.qualityScore)}<small class="table-note">${escape(fii.classification || '')}</small></td>
      <td data-label="Principais riscos"><span class="risk-text" title="${escape((fii.risks || []).join('; '))}">${escape(compactRisks(fii.risks))}</span></td>
      <td class="actions-cell"><div class="row-actions"><button class="icon-button" data-action="analyze" data-ticker="${asset.ticker}" title="Ver cálculo de ${asset.ticker}" aria-label="Ver cálculo de ${asset.ticker}">${icon('calculator')}</button><button class="icon-button remove" data-action="remove" data-ticker="${asset.ticker}" title="Remover ${asset.ticker}" aria-label="Remover ${asset.ticker}">${icon('trash-2')}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>${renderFiiGroups(ranked)}`;
    return;
  }
  target.innerHTML = `<div class="table-scroll" tabindex="0" role="region" aria-label="Ranking de ações"><table class="asset-table">
    <thead><tr><th scope="col">Ativo</th><th scope="col">Setor</th><th scope="col">Cotação</th><th scope="col">Bazin · 10%</th><th scope="col">Graham</th><th scope="col">Gordon</th><th scope="col">Média</th><th scope="col">Preço de compra</th><th scope="col" aria-sort="descending" title="1 − cotação ÷ preço de compra">Margem ↓</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${visible.map((asset) => {
      const { bazin, graham, gordon, fairAverage, buyPrice, margin, selectedMethod } = asset.valuation;
      const unavailableReason = asset.error || asset.dividends?.reason || 'Sem base de proventos para o cálculo.';
      const gordonReason = asset.error || asset.dividends?.reason || 'Gordon exige histórico completo de proventos e crescimento válido.';
      const rowLabel = asset.loading ? 'Consultando…' : asset.error ? 'Consulta indisponível' : asset.name;
      return `<tr class="${asset.error ? 'error-row' : ''}"><td class="identity-cell"><div class="asset-name"><span class="rank">${Number.isFinite(margin) ? ++place : '—'}</span>${logo(asset)}<button class="asset-link" data-action="analyze" data-ticker="${asset.ticker}">${asset.ticker}<small title="${escape(rowLabel)}">${escape(rowLabel)}</small></button></div></td>
      ${isStock ? `<td data-label="Setor">${sectorPill(stockSector(asset))}</td>` : ''}<td data-label="Cotação">${money(asset.currentPrice)}</td>${priceCell(bazin, selectedMethod === 'bazin', unavailableReason, 'Bazin · 10%')}${isStock ? `${priceCell(graham, false, 'LPA e VPA positivos são necessários.', 'Graham')}${priceCell(gordon, false, gordonReason, 'Gordon')}${priceCell(fairAverage, false, 'Nenhum preço teto válido.', 'Média')}${priceCell(buyPrice, true, 'Nenhum preço teto válido.', 'Preço de compra')}` : ''}
      <td data-label="Margem de segurança">${Number.isFinite(margin) ? `<span class="margin ${margin < 0 ? 'negative' : ''}">${percent(margin)}<small>${escape(methodNames[selectedMethod] || selectedMethod)}</small></span>` : `<span class="unavailable" title="${escape(asset.error || 'Sem dados para o método selecionado.')}">—</span>`}</td>
      <td class="actions-cell"><div class="row-actions"><button class="icon-button" data-action="analyze" data-ticker="${asset.ticker}" title="Ver cálculo de ${asset.ticker}" aria-label="Ver cálculo de ${asset.ticker}">${icon('calculator')}</button><button class="icon-button remove" data-action="remove" data-ticker="${asset.ticker}" title="Remover ${asset.ticker}" aria-label="Remover ${asset.ticker}">${icon('trash-2')}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>${isStock && ranked.length > visible.length ? `<div class="show-more-row"><button class="button secondary" type="button" data-action="show-more-stocks">Mostrar mais ${Math.min(STOCK_PAGE_SIZE, ranked.length - visible.length)}</button></div>` : ''}`;
}

function render() {
  const count = settings.list.length;
  $('asset-count').textContent = `${count} ${count === 1 ? 'ativo' : 'ativos'}`;
  renderSectorFilter();
  renderClass('stock');
  renderClass('fii');
}

function showAnalysis(asset) {
  preview = asset;
  const valuation = model.evaluate(asset, asset.type === 'stock' ? STOCK_CONFIG : FII_CONFIG);
  const bazinYield = valuation.assumptions.bazinYield;
  const gordonGrowth = valuation.assumptions.gordonGrowth;
  const history = asset.dividends;
  const saved = settings.list.some((item) => item.ticker === asset.ticker);
  const sourceDate = asset.sourceDate ? asset.sourceDate.split('-').reverse().join('/') : null;
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
    <div class="calculation-inputs"><span>Média dos métodos <b>${money(valuation.fairAverage)}</b></span><span>Margem aplicada <b>${percent(valuation.safetyMargin)}</b></span></div>
    ${Number.isFinite(valuation.buyPrice) ? `<div class="formula">${money(valuation.fairAverage)} × (1 − ${percent(valuation.safetyMargin)}) = <b>${money(valuation.buyPrice)}</b></div>` : '<p>É preciso ao menos um preço teto válido para calcular o preço de compra.</p>'}</section>` : '';
  const stockAnalysisBody = asset.type === 'stock' ? `${profileBody}${fundamentalsGrid(asset)}${averageBody}${grahamBody}${gordonBody}
    <section class="method-block"><div class="method-heading"><h3>Bazin histórico · ${percent(bazinYield)}</h3><strong>${money(valuation.bazin)}</strong></div>${historyBody}</section>
    <section class="method-block"><div class="method-heading"><h3>Margem · ${escape(methodNames[valuation.selectedMethod] || 'Bazin 10%')}</h3><strong>${percent(valuation.margin)}</strong></div>${Number.isFinite(valuation.margin) ? `<div class="formula">(1 − ${money(asset.currentPrice)} ÷ ${money(valuation.selected)}) × 100 = ${percent(valuation.margin)}</div>` : '<p>Sem dados suficientes para calcular a margem.</p>'}</section>` : '';
  const fiiAnalysisBody = asset.type === 'fii' ? `${fundamentalsGrid(asset)}${fiiAnalysisSections(asset, valuation, history)}` : '';
  $('analysis-content').innerHTML = `<div class="dialog-title">${logo(asset)}<div><h2 id="analysis-title">${asset.ticker}</h2><p>${escape(asset.name)} · ${asset.type === 'fii' ? 'FII' : 'Ação'}</p></div><div class="dialog-quote"><small>Cotação${sourceDate ? ` · ${sourceDate}` : ''}</small><strong>${money(asset.currentPrice)}</strong></div></div>
    ${stockAnalysisBody}${fiiAnalysisBody}
    <div class="dialog-bottom"><div class="source"><a href="${escape(asset.source)}" target="_blank" rel="noopener noreferrer">Fonte: Investidor10 ↗</a><br>Consulta: ${escape(consulted)}</div><button class="button ${saved ? 'secondary' : 'primary'}" id="dialog-add" ${saved ? 'disabled' : ''}>${icon(saved ? 'check' : 'plus')}${saved ? 'Adicionado' : 'Adicionar ativo'}</button></div>
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
  const saved = persist();
  render();
  if (saved) notify(`${asset.ticker} adicionado.`);
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
    if (settings.list.some((item) => item.ticker === ticker)) { assets.set(ticker, asset); render(); }
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
  $('sync-status').textContent = 'Consultando dados…';
  const queue = [...settings.list];
  let failed = 0;
  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      try {
        const asset = await requestAsset(entry.ticker);
        if (settings.list.some((item) => item.ticker === entry.ticker)) {
          assets.set(entry.ticker, asset);
          if (preview?.ticker === entry.ticker && $('analysis-dialog').open) showAnalysis(asset);
        }
      } catch {
        failed += 1;
        if (settings.list.some((item) => item.ticker === entry.ticker)) assets.set(entry.ticker, { ...entry, error: 'Consulta indisponível. Nova tentativa automática em um minuto.' });
        if (preview?.ticker === entry.ticker && $('analysis-dialog').open) { $('analysis-dialog').close(); notify('A atualização desse ativo falhou. Nova tentativa em um minuto.', true); }
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
document.addEventListener('click', (event) => {
  const suggestion = event.target.closest('[data-suggest-ticker]');
  if (suggestion) {
    $('ticker').value = suggestion.dataset.suggestTicker;
    hideSuggestions();
    $('ticker').focus();
    return;
  }
  if (!event.target.closest('.searchbar')) hideSuggestions();
  const sectorButton = event.target.closest('[data-sector-filter]');
  if (sectorButton) {
    settings.stockSector = canonicalSector(sectorButton.dataset.sectorFilter);
    stockVisibleCount = STOCK_PAGE_SIZE;
    persist();
    render();
    return;
  }
  const metric = event.target.closest('.metric-card');
  if (metric) {
    renderMetricHistory(metric);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'show-more-stocks') {
    stockVisibleCount += STOCK_PAGE_SIZE;
    render();
    return;
  }
  const ticker = button.dataset.ticker;
  if (button.dataset.action === 'remove') {
    settings.list = settings.list.filter((item) => item.ticker !== ticker);
    assets.delete(ticker);
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
render();
refreshSaved();
setInterval(refreshSaved, 60_000);
