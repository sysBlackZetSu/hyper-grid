// ============================================================
// Example: Real-time Trading Table (Binance/TradingView style)
// Demonstrates 100–1000 updates/second with 60fps rendering
// ============================================================

import { createRealtimeEngine, createFPSMonitor } from '../src';
import type { RealtimeEngine, FrameStats } from '../src';

// ---- Data Model ----

interface TickerData {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  bid: number;
  ask: number;
  lastUpdate: number;
}

// ---- Field Definitions ----

const fields = [
  { id: 'symbol', accessor: 'symbol' },
  { id: 'price', accessor: 'price' },
  { id: 'change', accessor: 'change' },
  { id: 'changePct', accessor: 'changePct' },
  { id: 'volume', accessor: 'volume' },
  { id: 'high', accessor: 'high' },
  { id: 'low', accessor: 'low' },
  { id: 'bid', accessor: 'bid' },
  { id: 'ask', accessor: 'ask' },
] as const;

// ---- Formatters ----

function getFieldValue(data: TickerData, fieldId: string): string {
  switch (fieldId) {
    case 'symbol':
      return data.symbol;
    case 'price':
      return data.price.toFixed(2);
    case 'change':
      return (data.change >= 0 ? '+' : '') + data.change.toFixed(2);
    case 'changePct':
      return (data.changePct >= 0 ? '+' : '') + data.changePct.toFixed(2) + '%';
    case 'volume':
      return formatVolume(data.volume);
    case 'high':
      return data.high.toFixed(2);
    case 'low':
      return data.low.toFixed(2);
    case 'bid':
      return data.bid.toFixed(2);
    case 'ask':
      return data.ask.toFixed(2);
    default:
      return '';
  }
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return String(vol);
}

// ---- Simulation ----

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'FIL/USDT', 'APT/USDT',
  'NEAR/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'PEPE/USDT',
  'LTC/USDT', 'TRX/USDT', 'BCH/USDT', 'ETC/USDT', 'AAVE/USDT',
  'MKR/USDT', 'CRV/USDT', 'SAND/USDT', 'MANA/USDT', 'IMX/USDT',
];

const BASE_PRICES: Record<string, number> = {
  'BTC/USDT': 67000, 'ETH/USDT': 3500, 'BNB/USDT': 580, 'SOL/USDT': 145,
  'XRP/USDT': 0.52, 'ADA/USDT': 0.45, 'DOGE/USDT': 0.15, 'DOT/USDT': 7.2,
  'AVAX/USDT': 35, 'MATIC/USDT': 0.71, 'LINK/USDT': 14, 'UNI/USDT': 7.5,
  'ATOM/USDT': 9.2, 'FIL/USDT': 5.8, 'APT/USDT': 8.5, 'NEAR/USDT': 6.1,
  'ARB/USDT': 1.1, 'OP/USDT': 2.3, 'SUI/USDT': 1.3, 'PEPE/USDT': 0.000008,
  'LTC/USDT': 82, 'TRX/USDT': 0.11, 'BCH/USDT': 480, 'ETC/USDT': 26,
  'AAVE/USDT': 95, 'MKR/USDT': 2800, 'CRV/USDT': 0.52, 'SAND/USDT': 0.45,
  'MANA/USDT': 0.42, 'IMX/USDT': 2.1,
};

function generateInitialData(): Map<string, TickerData> {
  const data = new Map<string, TickerData>();
  for (const symbol of SYMBOLS) {
    const price = BASE_PRICES[symbol] || 10;
    data.set(symbol, {
      symbol,
      price,
      change: 0,
      changePct: 0,
      volume: Math.floor(Math.random() * 100_000_000),
      high: price * 1.02,
      low: price * 0.98,
      bid: price * 0.999,
      ask: price * 1.001,
      lastUpdate: Date.now(),
    });
  }
  return data;
}

function simulateUpdate(current: TickerData): TickerData {
  const volatility = 0.001;
  const priceChange = current.price * (Math.random() - 0.5) * 2 * volatility;
  const newPrice = Math.max(0.000001, current.price + priceChange);
  const change = newPrice - (BASE_PRICES[current.symbol] || 10);
  const changePct = (change / (BASE_PRICES[current.symbol] || 10)) * 100;

  return {
    symbol: current.symbol,
    price: newPrice,
    change,
    changePct,
    volume: current.volume + Math.floor(Math.random() * 10000),
    high: Math.max(current.high, newPrice),
    low: Math.min(current.low, newPrice),
    bid: newPrice * (1 - Math.random() * 0.002),
    ask: newPrice * (1 + Math.random() * 0.002),
    lastUpdate: Date.now(),
  };
}

// ---- Main Demo ----

function runDemo(): void {
  console.log('=== HyperGrid Real-Time Trading Demo ===\n');

  const fpsMonitor = createFPSMonitor();

  // Create real-time engine
  const engine: RealtimeEngine<TickerData> = createRealtimeEngine({
    fields: fields as unknown as Array<{ id: string; accessor: string | ((row: TickerData) => unknown) }>,
    getFieldValue,
    getRowId: (data: TickerData) => data.symbol,
    flashClass: 'hg-cell-flash',
    autoStart: false,
    onFrame: (stats: FrameStats) => {
      if (stats.patchCount > 0) {
        console.log(
          `Frame: ${stats.patchCount} patches, ${stats.cellsPatched} cells patched, ` +
          `${stats.deferredCount} deferred, animating: ${stats.isAnimating}`
        );
      }
    },
  });

  // Initialize data
  const initialData = generateInitialData();
  initialData.forEach((data, id) => {
    engine.push(id, data);
  });

  // Mark first 10 rows as visible
  const visibleIds = new Set<string>();
  let count = 0;
  for (const symbol of SYMBOLS) {
    if (count >= 10) break;
    visibleIds.add(symbol);
    count++;
  }
  engine.setVisibleRows(visibleIds);

  // Start engine
  engine.start();
  fpsMonitor.start();

  // Simulate 500 updates/second
  const UPDATES_PER_SECOND = 500;
  const INTERVAL_MS = 1000 / UPDATES_PER_SECOND;
  let updateCount = 0;

  const currentData = new Map(initialData);

  const interval = setInterval(() => {
    // Pick random symbol and update
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const current = currentData.get(symbol);
    if (current) {
      const updated = simulateUpdate(current);
      currentData.set(symbol, updated);
      engine.push(symbol, updated);
      updateCount++;
    }
  }, INTERVAL_MS);

  // Report stats every 2 seconds
  const statsInterval = setInterval(() => {
    const fps = fpsMonitor.getMetrics();
    console.log(`\n--- Stats ---`);
    console.log(`FPS: ${fps.fps} | Frame time: ${fps.frameTime}ms | Dropped: ${fps.droppedFrames}`);
    console.log(`Updates pushed: ${updateCount} | Buffer size: ${engine.buffer.size()}`);
    console.log(`Data map size: ${engine.getDataMap().size}`);
    console.log(`DOM cells registered: ${engine.domPatcher.cellCount()}`);
    updateCount = 0;
    fpsMonitor.reset();
  }, 2000);

  // Stop after 10 seconds
  setTimeout(() => {
    clearInterval(interval);
    clearInterval(statsInterval);
    engine.stop();
    fpsMonitor.stop();
    engine.destroy();
    console.log('\n=== Demo Complete ===');
  }, 10000);
}

runDemo();
