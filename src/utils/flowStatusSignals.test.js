/**
 * Flow Status signals — scenario tests.
 * Run in browser dev tools (with app loaded): 
 *   import('/src/utils/flowStatusSignals.test.js').then(m => m.run())
 * Or from Node (from frontend dir): node src/utils/flowStatusSignals.test.js
 */

import { computeFlowStatus, FLOW_CONFIG } from './flowStatusSignals'

const RED = '#ff4d4f'
const BLUE = '#3b82f6'
const WHITE = '#ffffff'

function assert(condition, msg) {
  if (!condition) throw new Error(`Assert failed: ${msg}`)
}

// ——— 1. Oversizing Negative Edge in >$10K bucket ———
function testOversizingNegativeEdge() {
  const analytics = {
    position_size_buckets: [
      { bucket: '< $1K', trades: 2, win_rate: 50, avg_win_percent: 20, avg_loss_percent: -15, ev_percent: 2.5, total_pnl: 100 },
      { bucket: '> $10K', trades: 6, win_rate: 33, avg_win_percent: 10, avg_loss_percent: -40, ev_percent: -20, total_pnl: -5000 },
    ],
    trade_type_stats: [],
    equity_curve: [{ date: '2026-02-01', cumulative_pnl: -1000 }],
  }
  const trades = Array(8).fill(null).map((_, i) => ({
    date: `2026-02-${String(i + 1).padStart(2, '0')}`,
    pnl: i < 6 ? -800 : 200,
    return_percent: i < 6 ? -40 : 10,
    entry_amount: i < 6 ? 15000 : 5000,
  }))
  const out = computeFlowStatus(analytics, trades)
  assert(out.color === RED, 'Oversizing: expect RED')
  assert(out.line1.includes('Oversizing') && out.line1.includes('negative edge'), 'Oversizing: headline')
  assert(out.line2.includes('> $10K') || out.line2.includes('$10K'), 'Oversizing: bucket label')
  console.log('OK testOversizingNegativeEdge')
}

// ——— 2. Type Leak in AI ———
function testTypeLeak() {
  const analytics = {
    position_size_buckets: [
      { bucket: '$1K-$5K', trades: 10, win_rate: 50, avg_win_percent: 15, avg_loss_percent: -10, ev_percent: 2.5, total_pnl: 200 },
    ],
    trade_type_stats: [
      { trade_type: 'AI', trades: 6, win_rate: 33, avg_win_percent: 5, avg_loss_percent: -30, ev_percent: -12, total_pnl: -2000 },
      { trade_type: 'Tech', trades: 4, win_rate: 50, avg_win_percent: 20, avg_loss_percent: -10, ev_percent: 5, total_pnl: 500 },
    ],
    equity_curve: [{ date: '2026-02-01', cumulative_pnl: -500 }],
  }
  const trades = Array(10).fill(null).map((_, i) => ({
    date: '2026-02-01',
    created_at: `2026-02-01T${String(i).padStart(2, '0')}:00:00`,
    pnl: i < 6 ? -350 : 100,
    return_percent: i < 6 ? -30 : 5,
    trade_type: i < 6 ? 'AI' : 'Tech',
  }))
  const out = computeFlowStatus(analytics, trades)
  assert(out.color === RED, 'Type Leak: expect RED')
  assert(out.line1.includes('Leaking') && out.line2.includes('AI'), 'Type Leak: AI')
  console.log('OK testTypeLeak')
}

// ——— 3. Winrate trap (no single bucket/type with 5+ trades and negative edge, so D triggers) ———
function testWinrateTrap() {
  const analytics = {
    position_size_buckets: [
      { bucket: '$1K-$5K', trades: 3, win_rate: 50, avg_win_percent: 8, avg_loss_percent: -25, ev_percent: -8.5, total_pnl: -100 },
      { bucket: '$5K-$10K', trades: 4, win_rate: 50, avg_win_percent: 8, avg_loss_percent: -25, ev_percent: -8.5, total_pnl: -150 },
    ],
    trade_type_stats: [
      { trade_type: 'Viral', trades: 4, win_rate: 50, avg_win_percent: 8, avg_loss_percent: -25, ev_percent: -8.5, total_pnl: -150 },
    ],
    equity_curve: [{ date: '2026-02-01', cumulative_pnl: -400 }],
  }
  const trades = Array(12).fill(null).map((_, i) => ({
    date: `2026-02-${String((i % 5) + 1).padStart(2, '0')}`,
    pnl: i % 2 === 0 ? 80 : -200,
    return_percent: i % 2 === 0 ? 8 : -25,
    entry_amount: i < 6 ? 3000 : 7000,
  }))
  const out = computeFlowStatus(analytics, trades)
  assert(out.color === RED, 'Winrate trap: expect RED')
  assert(out.line1.includes('Winrate trap') || (out.line2.includes('Win') && out.line2.includes('EV')), 'Winrate trap: message')
  console.log('OK testWinrateTrap')
}

// ——— 4. Edge confirmed in Tech ———
function testEdgeConfirmed() {
  const analytics = {
    position_size_buckets: [
      { bucket: '$5K-$10K', trades: 6, win_rate: 55, avg_win_percent: 25, avg_loss_percent: -12, ev_percent: 9, total_pnl: 1200 },
    ],
    trade_type_stats: [
      { trade_type: 'Tech', trades: 6, win_rate: 55, avg_win_percent: 25, avg_loss_percent: -12, ev_percent: 9, total_pnl: 1200 },
    ],
    equity_curve: [
      { date: '2026-02-01', cumulative_pnl: 200 },
      { date: '2026-02-02', cumulative_pnl: 500 },
      { date: '2026-02-03', cumulative_pnl: 1200 },
    ],
    kelly_percent: 4,
  }
  const trades = Array(6).fill(null).map((_, i) => ({
    date: `2026-02-${String(i + 1).padStart(2, '0')}`,
    pnl: i < 4 ? 250 : -100,
    return_percent: i < 4 ? 25 : -12,
    trade_type: 'Tech',
    entry_amount: 7000,
  }))
  const out = computeFlowStatus(analytics, trades)
  assert(out.color === BLUE, 'Edge confirmed: expect BLUE')
  assert(out.line1.includes('Edge confirmed') && (out.line2.includes('Tech') || out.line2.includes('Kelly')), 'Edge confirmed: Tech')
  console.log('OK testEdgeConfirmed')
}

// ——— 5. Insufficient data (<10 trades) ———
function testInsufficientData() {
  const analytics = {
    position_size_buckets: [
      { bucket: '$1K-$5K', trades: 4, win_rate: 50, avg_win_percent: 10, avg_loss_percent: -10, ev_percent: 0, total_pnl: 0 },
    ],
    trade_type_stats: [],
    equity_curve: [{ date: '2026-02-01', cumulative_pnl: 0 }],
  }
  const trades = Array(4).fill(null).map((_, i) => ({
    date: `2026-02-${i + 1}`,
    pnl: i % 2 ? 50 : -50,
    return_percent: i % 2 ? 10 : -10,
  }))
  const out = computeFlowStatus(analytics, trades)
  assert(out.color === WHITE, 'Insufficient: expect WHITE')
  assert(out.line1.includes('No reliable edge') || out.line2.includes('Sample too small'), 'Insufficient: message')
  assert(out.line2.includes('n=4') || out.line2.includes('n='), 'Insufficient: n=4')
  console.log('OK testInsufficientData')
}

// Run all if executed directly (Node with ESM or dynamic import)
function run() {
  testOversizingNegativeEdge()
  testTypeLeak()
  testWinrateTrap()
  testEdgeConfirmed()
  testInsufficientData()
  console.log('All 5 flow status scenario tests passed.')
}

export { testOversizingNegativeEdge, testTypeLeak, testWinrateTrap, testEdgeConfirmed, testInsufficientData, run }

// For Node runner: npm install might not have ESM; use a simple runner file or run in browser.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('flowStatusSignals.test.js')) {
  run()
}
