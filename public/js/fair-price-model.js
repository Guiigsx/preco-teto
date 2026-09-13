(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.FairPriceModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const positive = (value) => Number.isFinite(value) && value > 0;
  const DEFAULT_BAZIN_YIELD = 10;
  const DEFAULT_GORDON_RETURN = 12;
  const MAX_GORDON_GROWTH = 5;
  const PRIVATE_SAFETY_MARGIN = 15;
  const STATE_SAFETY_MARGIN = 20;
  const DEFAULT_FII_REQUIRED_RETURN = 10;

  function validRate(value) {
    return Number.isFinite(value) && value >= 1 && value <= 30;
  }

  function clampPercent(value) {
    return Number.isFinite(value) ? Math.max(0, value) : null;
  }

  function clamp(value, min, max) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
  }

  function numberFromText(value) {
    const text = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function fiiKind(asset) {
    const text = `${asset.fundamentals?.segment || ''} ${asset.fundamentals?.fundType || ''} ${asset.profile?.sectorGroup || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (/CRI|PAPEL|RECEBIV/.test(text)) return 'paper';
    if (/FOF|FUNDO DE FUNDOS/.test(text)) return 'fof';
    return 'brick';
  }

  function fiiClassification(discount, qualityScore) {
    if (!Number.isFinite(discount)) return 'Sem dados suficientes';
    if (discount > 0 && qualityScore >= 7) return 'Possivelmente descontado e de boa qualidade';
    if (Math.abs(discount) <= 5) return 'Preço próximo do justo';
    if (discount > 0) return 'Barato, mas com riscos relevantes';
    return 'Possivelmente caro';
  }

  function fiiQuality(asset, pvp, normalizedDy) {
    const f = asset.fundamentals || {};
    const risks = [];
    const kind = fiiKind(asset);
    let score = 7;
    const samples = asset.dividends?.normalizedSamples || 0;
    const volatility = asset.dividends?.normalizedStdDev;
    if (samples >= 10) score += 0.8;
    else if (samples >= 6) score += 0.2;
    else { score -= 1.4; risks.push('poucas distribuições mensais limpas'); }
    if (Number.isFinite(volatility)) {
      if (volatility <= 0.12) score += 0.6;
      else if (volatility > 0.35) { score -= 1; risks.push('renda mensal pouco estável'); }
    }
    if (kind === 'brick') {
      if (Number.isFinite(f.vacancy)) {
        if (f.vacancy <= 5) score += 0.8;
        else if (f.vacancy <= 12) score += 0.2;
        else if (f.vacancy <= 20) { score -= 0.8; risks.push('vacância acima do ideal'); }
        else { score -= 1.8; risks.push('vacância elevada'); }
      } else { score -= 0.4; risks.push('vacância não capturada'); }
    } else if (kind === 'paper') {
      risks.push('validar CRIs, garantias, LTV e indexadores fora da tela');
      if (Number.isFinite(normalizedDy) && normalizedDy > 14) {
        score -= 0.8;
        risks.push('DY pode refletir juros/inflação temporariamente altos');
      }
    }
    const shareholders = numberFromText(f.shareholders);
    if (Number.isFinite(shareholders)) {
      if (shareholders >= 50000) score += 0.5;
      else if (shareholders < 5000) { score -= 0.4; risks.push('base de cotistas menor'); }
    }
    if (!f.managementType) { score -= 0.2; risks.push('tipo de gestão indisponível'); }
    if (Number.isFinite(pvp)) {
      if (pvp > 1.1) { score -= 0.4; risks.push('negocia com prêmio sobre o VPA'); }
      if (pvp < 0.65) { score -= 0.5; risks.push('desconto patrimonial muito alto pode sinalizar risco'); }
    } else {
      score -= 1;
      risks.push('VPA indisponível');
    }
    if (!risks.length) risks.push('sem risco crítico capturado nos dados públicos');
    return { score: clamp(score, 0, 10), risks, kind };
  }

  function evaluateFii(asset, options) {
    const requiredReturn = validRate(options.requiredReturn) ? options.requiredReturn : DEFAULT_FII_REQUIRED_RETURN;
    const kind = fiiKind(asset);
    const incomeWeight = Number.isFinite(options.incomeWeight)
      ? options.incomeWeight
      : kind === 'paper' ? 0.85 : 0.7;
    const equityWeight = 1 - incomeWeight;
    const normalizedMonthlyDividend = positive(asset.dividends?.normalizedMonthly)
      ? asset.dividends.normalizedMonthly
      : positive(asset.dividends?.average) ? asset.dividends.average / 12 : null;
    const normalizedAnnualDividend = positive(normalizedMonthlyDividend) ? normalizedMonthlyDividend * 12 : null;
    const incomePrice = positive(normalizedAnnualDividend) ? normalizedAnnualDividend / (requiredReturn / 100) : null;
    const vpa = positive(asset.vpa) ? asset.vpa : positive(asset.fundamentals?.equityValuePerShare) ? asset.fundamentals.equityValuePerShare : null;
    const pvp = positive(asset.currentPrice) && positive(vpa) ? asset.currentPrice / vpa : null;
    const referenceValue = positive(incomePrice) && positive(vpa)
      ? incomeWeight * incomePrice + equityWeight * vpa
      : positive(incomePrice) ? incomePrice
        : positive(vpa) ? vpa : null;
    const margin = positive(referenceValue) && positive(asset.currentPrice) && !asset.error
      ? (referenceValue / asset.currentPrice - 1) * 100 : null;
    const normalizedDy = positive(normalizedAnnualDividend) && positive(asset.currentPrice)
      ? normalizedAnnualDividend / asset.currentPrice * 100 : null;
    const quality = fiiQuality(asset, pvp, normalizedDy);
    return {
      bazin: incomePrice,
      graham: null,
      gordon: null,
      fairAverage: null,
      safetyMargin: null,
      buyPrice: null,
      selected: referenceValue,
      selectedMethod: 'fiiReference',
      margin,
      fii: {
        requiredReturn,
        normalizedMonthlyDividend,
        normalizedAnnualDividend,
        normalizedDy,
        vpa,
        pvp,
        incomePrice,
        referenceValue,
        discount: margin,
        qualityScore: quality.score,
        qualityLabel: `${quality.score.toFixed(1)}/10`,
        risks: quality.risks,
        kind: quality.kind,
        incomeWeight,
        equityWeight,
        classification: fiiClassification(margin, quality.score),
      },
      assumptions: {
        bazinYield: requiredReturn,
        gordonReturn: null,
        gordonGrowth: null,
        gordonDividendBase: null,
        gordonNextDividend: null,
      },
    };
  }

  function dividendCagr(dividends) {
    const annual = dividends?.annualTotals || [];
    if (annual.length < 2) return null;
    const first = annual[0]?.total;
    const last = annual[annual.length - 1]?.total;
    if (!positive(first) || !positive(last)) return null;
    return (Math.pow(last / first, 1 / (annual.length - 1)) - 1) * 100;
  }

  function sustainableGrowth(fundamentals) {
    const roe = fundamentals?.roe;
    const payout = fundamentals?.payout;
    if (!Number.isFinite(roe) || !Number.isFinite(payout)) return null;
    const retention = Math.max(0, Math.min(1, 1 - payout / 100));
    return Math.max(0, roe * retention);
  }

  function gordonGrowth(asset) {
    const cagr = clampPercent(dividendCagr(asset.dividends));
    const sustainable = clampPercent(sustainableGrowth(asset.fundamentals));
    const candidates = [MAX_GORDON_GROWTH];
    if (cagr !== null) candidates.push(cagr);
    if (sustainable !== null) candidates.push(sustainable);
    return { selected: Math.min(...candidates), dividendCagr: cagr, sustainableGrowth: sustainable, cap: MAX_GORDON_GROWTH };
  }

  function evaluate(asset, config = {}, legacyMethod) {
    const legacyYield = typeof config === 'number' ? config : null;
    const options = typeof config === 'object' && config !== null ? config : {};
    const bazinYield = validRate(options.bazinYield) ? options.bazinYield : validRate(legacyYield) ? legacyYield : DEFAULT_BAZIN_YIELD;
    const gordonReturn = validRate(options.gordonReturn) ? options.gordonReturn : DEFAULT_GORDON_RETURN;
    const method = options.method || legacyMethod || (asset.type === 'stock' ? 'buy' : 'bazin');
    if (asset.type === 'fii') return evaluateFii(asset, options);
    const bazin = asset.dividends?.complete && positive(asset.dividends.average)
      ? asset.dividends.average / (bazinYield / 100) : null;
    const graham = asset.type === 'stock' && positive(asset.lpa) && positive(asset.vpa)
      ? Math.sqrt(22.5 * asset.lpa * asset.vpa) : null;
    const growth = asset.type === 'stock' && asset.dividends?.complete && positive(asset.dividends.average)
      ? gordonGrowth(asset) : null;
    const gordonSpread = growth ? gordonReturn - growth.selected : null;
    const gordon = asset.type === 'stock' && growth && gordonSpread >= 2
      ? asset.dividends.average * (1 + growth.selected / 100) / (gordonSpread / 100) : null;
    const validPrices = [bazin, graham, gordon].filter((value) => positive(value));
    const fairAverage = asset.type === 'stock' && validPrices.length
      ? validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length : null;
    const safetyMargin = asset.type === 'stock'
      ? asset.profile?.controlType === 'state' ? STATE_SAFETY_MARGIN : PRIVATE_SAFETY_MARGIN : null;
    const buyPrice = positive(fairAverage) ? fairAverage * (1 - safetyMargin / 100) : null;
    let selectedMethod = asset.type === 'stock' ? 'buy' : 'bazin';
    let selected = asset.type === 'stock' ? buyPrice : bazin;
    if (asset.type === 'stock' && method === 'bazin') {
      selectedMethod = 'bazin';
      selected = bazin;
    } else if (asset.type === 'stock' && method === 'graham') {
      selectedMethod = 'graham';
      selected = graham;
    } else if (asset.type === 'stock' && method === 'gordon') {
      selectedMethod = 'gordon';
      selected = gordon;
    } else if (asset.type === 'stock' && method === 'best') {
      const candidates = [
        ['bazin', bazin],
        ['graham', graham],
        ['gordon', gordon],
      ].filter(([, value]) => positive(value)).sort((a, b) => b[1] - a[1]);
      if (candidates.length) {
        selectedMethod = candidates[0][0];
        selected = candidates[0][1];
      }
    }
    const margin = positive(selected) && positive(asset.currentPrice) && !asset.error
      ? (1 - asset.currentPrice / selected) * 100 : null;
    return {
      bazin, graham, gordon, fairAverage, safetyMargin, buyPrice, selected, selectedMethod, margin,
      assumptions: {
        bazinYield,
        gordonReturn,
        gordonGrowth: growth,
        gordonDividendBase: asset.dividends?.average ?? null,
        gordonNextDividend: growth && positive(asset.dividends?.average) ? asset.dividends.average * (1 + growth.selected / 100) : null,
      },
    };
  }

  function rank(assets, config = {}) {
    return assets.map((asset) => ({ ...asset, valuation: evaluate(asset, config) }))
      .sort((a, b) => (b.valuation.margin ?? -Infinity) - (a.valuation.margin ?? -Infinity) || a.ticker.localeCompare(b.ticker));
  }

  return { evaluate, rank };
});
