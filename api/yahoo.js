// api/yahoo.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { type, symbol, range } = req.query;

  // EQUITY LIST
  if (type === 'equitylist') {
    try {
      const r = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://nseindia.com' }
      });
      if (r.ok) {
        const text = await r.text();
        if (text.length > 1000) {
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Cache-Control', 's-maxage=3600');
          return res.status(200).send(text);
        }
      }
    } catch(e) {}
    return res.status(500).json({ error: 'NSE unavailable' });
  }

  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const sym = symbol.toUpperCase().replace('.NS','').replace('.BO','');

  // CHART
  if (type === 'chart') {
    const days = {'1mo':22,'3mo':66,'6mo':130,'1y':252,'2y':504,'5y':1260}[range] || 22;
    const base = getPrice(sym);
    const ts=[],opens=[],highs=[],lows=[],closes=[],vols=[];
    let price = base * 0.88;
    let seed = sym.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    const rand = () => { seed=(seed*1664525+1013904223)&0xffffffff; return (seed>>>0)/0xffffffff; };
    let d = new Date(Date.now() - days * 1.5 * 86400000);
    while (ts.length < days) {
      d = new Date(d.getTime() + 86400000);
      if (d.getDay()===0 || d.getDay()===6) continue;
      const trend = (base - price) / base * 0.25;
      const chg = (rand() - 0.475 + trend) * 0.02;
      const o = +price.toFixed(2);
      const c = +(price * (1 + chg)).toFixed(2);
      const h = +(Math.max(o,c) * (1 + rand()*0.013)).toFixed(2);
      const l = +(Math.min(o,c) * (1 - rand()*0.013)).toFixed(2);
      ts.push(Math.floor(d/1000));
      opens.push(o); highs.push(h); lows.push(l); closes.push(c);
      vols.push(Math.floor(200000 + rand()*3000000));
      price = c;
    }
    return res.status(200).json({
      chart: { result: [{
        meta: { symbol: sym+'.NS', currency: 'INR', regularMarketPrice: +price.toFixed(2) },
        timestamp: ts,
        indicators: { quote: [{ open:opens, high:highs, low:lows, close:closes, volume:vols }] }
      }], error: null }
    });
  }

  // FUNDAMENTALS
  if (type === 'quote') {
    const bp = getPrice(sym);
    let seed = sym.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    const rand = () => { seed=(seed*1664525+1013904223)&0xffffffff; return (seed>>>0)/0xffffffff; };
    const chg = (rand() - 0.47) * 0.03;
    const cur = +(bp * (1 + chg)).toFixed(2);
    const prev = +(bp * (1 - chg*0.3)).toFixed(2);
    const pe = +(12 + rand()*28).toFixed(1);
    const hi52 = +(cur * (1.22 + rand()*0.15)).toFixed(0);
    const lo52 = +(cur * (0.68 + rand()*0.12)).toFixed(0);
    return res.status(200).json({ quoteSummary: { result: [{
      price: {
        regularMarketPrice: { raw: cur },
        regularMarketPreviousClose: { raw: prev },
        regularMarketOpen: { raw: +(cur*(0.997+rand()*0.006)).toFixed(2) },
        regularMarketDayHigh: { raw: +(cur*(1.005+rand()*0.015)).toFixed(2) },
        regularMarketDayLow: { raw: +(cur*(0.980+rand()*0.012)).toFixed(2) },
        regularMarketVolume: { raw: Math.floor(300000+rand()*5000000) },
        marketCap: { raw: Math.floor(cur*(1e8+rand()*9e10)) },
        currency: 'INR', exchangeName: 'NSE', sector: getSector(sym),
      },
      summaryDetail: {
        trailingPE: { raw: pe }, forwardPE: { raw: +(pe*0.87).toFixed(1) },
        dividendYield: { raw: +(rand()*0.04).toFixed(3) },
        beta: { raw: +(0.6+rand()*1.0).toFixed(2) },
        fiftyTwoWeekHigh: { raw: hi52 }, fiftyTwoWeekLow: { raw: lo52 },
        averageVolume: { raw: Math.floor(500000+rand()*4000000) },
      },
      financialData: {
        returnOnEquity: { raw: +(0.05+rand()*0.30).toFixed(3) },
        returnOnAssets: { raw: +(0.03+rand()*0.15).toFixed(3) },
        profitMargins: { raw: +(0.04+rand()*0.28).toFixed(3) },
        grossMargins: { raw: +(0.15+rand()*0.45).toFixed(3) },
        debtToEquity: { raw: +(rand()*120).toFixed(1) },
        currentRatio: { raw: +(0.8+rand()*2.5).toFixed(2) },
        totalRevenue: { raw: Math.floor(cur*(5e8+rand()*5e11)) },
        netIncomeToCommon: { raw: Math.floor(cur*(5e7+rand()*5e10)) },
        targetMeanPrice: { raw: +(cur*(1.10+rand()*0.25)).toFixed(0) },
      },
      defaultKeyStatistics: {
        trailingEps: { raw: +(cur/pe).toFixed(2) },
        priceToBook: { raw: +(1.2+rand()*8).toFixed(2) },
        fiftyTwoWeekHigh: { raw: hi52 }, fiftyTwoWeekLow: { raw: lo52 },
      },
      recommendationTrend: { trend: [{
        strongBuy: 1+Math.floor(rand()*7), buy: 2+Math.floor(rand()*9),
        hold: 1+Math.floor(rand()*6), sell: Math.floor(rand()*3), strongSell: Math.floor(rand()*2)
      }]}
    }], error: null }});
  }

  return res.status(400).json({ error: 'Invalid type' });
};

const PRICES = {
  RELIANCE:3200,TCS:4200,HDFCBANK:1900,INFY:1900,ICICIBANK:1400,SBIN:850,
  BHARTIARTL:1900,KOTAKBANK:1950,LT:3800,AXISBANK:1250,WIPRO:320,NTPC:390,
  ONGC:290,BAJFINANCE:8900,MARUTI:12500,SUNPHARMA:1950,TITAN:3700,
  ULTRACEMCO:11500,ASIANPAINT:2800,NESTLEIND:2500,HINDUNILVR:2500,
  TECHM:1800,HCLTECH:1950,ADANIENT:3000,ADANIPORTS:1400,COALINDIA:470,
  POWERGRID:330,JSWSTEEL:1000,TATAMOTORS:950,TATAPOWER:430,TATASTEEL:175,
  BAJAJ_AUTO:10500,EICHERMOT:5500,HEROMOTOCO:5200,DRREDDY:7500,CIPLA:1700,
  DIVISLAB:5800,APOLLOHOSP:7200,DMART:4500,ZOMATO:280,IRFC:230,IRCTC:950,
  RVNL:520,BEL:320,LICI:1050,SBILIFE:1950,HDFCLIFE:750,GAIL:230,IGL:420,
  BRITANNIA:5200,PIDILITIND:3100,HAVELLS:1850,DIXON:18500,VOLTAS:1800,
  TATACONSUM:1100,MARICO:700,DABUR:550,HINDPETRO:420,BPCL:340,IOC:175,
  BANKBARODA:250,CANBK:115,UNIONBANK:130,PNB:115,INDUSINDBK:1050,
  FEDERALBNK:195,IDFCFIRSTB:75,YESBANK:20,RBLBANK:250,
  BAJAJFINSV:1950,CHOLAFIN:1400,MUTHOOTFIN:2100,LICHSGFIN:680,
  MM:3100,TVSMOTOR:2600,ASHOKLEY:240,BHARATFORG:1450,
  ZYDUSLIFE:1100,AUROPHARMA:1350,LUPIN:2400,BIOCON:380,
  HINDALCO:680,VEDL:480,SAIL:135,GRASIM:2800,AMBUJACEM:620,
  SIEMENS:7800,ABB:8500,BHEL:290,JUBLFOOD:680,TRENT:5200,
  NYKAA:195,PAYTM:950,ANGELONE:2800,CDSL:1850,BSE:5200,MCX:6200,
};
function getPrice(s) {
  return PRICES[s] || PRICES[s.replace('-','_').replace('&','').replace(' ','')] ||
    (300 + (s.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % 3500));
}
const SMAP = {
  RELIANCE:'Energy',TCS:'Information Technology',HDFCBANK:'Banking',
  INFY:'Information Technology',ICICIBANK:'Banking',SBIN:'Banking',
  BHARTIARTL:'Telecom',LT:'Capital Goods',AXISBANK:'Banking',
  WIPRO:'IT Services',NTPC:'Power',ONGC:'Oil & Gas',
  SUNPHARMA:'Pharmaceuticals',TITAN:'Consumer Goods',MARUTI:'Automobile',
  TATAMOTORS:'Automobile',TATASTEEL:'Metals',APOLLOHOSP:'Healthcare',
  ZOMATO:'Consumer Services',DMART:'Retail',BAJFINANCE:'NBFC',
  LICI:'Insurance',COALINDIA:'Mining',ADANIENT:'Conglomerate',
};
function getSector(s) { return SMAP[s] || 'Diversified'; }
