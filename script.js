'use strict';

/* ==========================================================
   9ja Ludo – script.js
   Full game logic: board, tokens, dice, movement, capture,
   safe zones, win detection, Web Audio API sounds.
   ========================================================== */

// ── Token Paths ────────────────────────────────────────────
// Each path = 51 outer cells (idx 0–50) + 6 home-stretch cells
// (idx 51–56) + 1 center cell (idx 57). Total 58 positions.
// pos = -1 means token is still in home base.

const RED_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],
  [13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],
  [8,3],[8,2],[8,1],[8,0],[7,0],
  [7,1],[7,2],[7,3],[7,4],[7,5],[7,6],
  [7,7]
];

const BLUE_PATH = [
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],
  [13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],
  [8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
  [1,7],[2,7],[3,7],[4,7],[5,7],[6,7],
  [7,7]
];

const GREEN_PATH = [
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],
  [8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],
  [2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],
  [6,11],[6,12],[6,13],[6,14],[7,14],
  [7,13],[7,12],[7,11],[7,10],[7,9],[7,8],
  [7,7]
];

const YELLOW_PATH = [
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],
  [0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],
  [6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],
  [11,8],[12,8],[13,8],[14,8],[14,7],
  [13,7],[12,7],[11,7],[10,7],[9,7],[8,7],
  [7,7]
];

const PATHS = { red: RED_PATH, blue: BLUE_PATH, green: GREEN_PATH, yellow: YELLOW_PATH };

// Number of outer-track positions (indices 0–50); also the start of home-stretch
const OUTER_COUNT = 51;
// Position index of the finished/center cell
const FINISH_POS = 57;

// ── Safe cells (key = "row,col") ───────────────────────────
// Star squares + each player's own start square
const SAFE_CELL_SET = new Set([
  '6,2','2,6','0,8','6,12','8,12','12,8','14,6','8,2',
  '6,1',   // Red   start
  '1,8',   // Blue  start
  '8,13',  // Green start
  '13,6'   // Yellow start
]);

function isSafeCell(row, col) {
  return SAFE_CELL_SET.has(row + ',' + col);
}

// ── Player definitions ─────────────────────────────────────
const PLAYERS = ['red', 'blue', 'green', 'yellow'];
const PLAYER_NAMES = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

// Home-base slot positions [row, col] for each token when pos = -1
const HOME_SLOTS = {
  red:    [[1,1],[1,3],[3,1],[3,3]],
  blue:   [[1,10],[1,12],[3,10],[3,12]],
  green:  [[10,10],[10,12],[12,10],[12,12]],
  yellow: [[10,1],[10,3],[12,1],[12,3]]
};

// Home-nest cell coordinates (marked with class home-nest)
const HOME_NEST_COORDS = new Set([
  '1,1','1,3','3,1','3,3',
  '1,10','1,12','3,10','3,12',
  '10,10','10,12','12,10','12,12',
  '10,1','10,3','12,1','12,3'
]);

// ── Board cell classification ──────────────────────────────
function classifyCell(row, col) {
  // Center
  if (row === 7 && col === 7) return 'center';

  // Home base corners (rows/cols strictly in 0–5 or 9–14)
  if (row <= 5 && col <= 5) return 'home-base home-red';
  if (row <= 5 && col >= 9) return 'home-base home-blue';
  if (row >= 9 && col >= 9) return 'home-base home-green';
  if (row >= 9 && col <= 5) return 'home-base home-yellow';

  // Home stretch (inside cross, coloured approach to centre)
  if (row === 7 && col >= 1 && col <= 6)  return 'path home-stretch-red';
  if (col === 7 && row >= 1 && row <= 6)  return 'path home-stretch-blue';
  if (row === 7 && col >= 8 && col <= 13) return 'path home-stretch-green';
  if (col === 7 && row >= 8 && row <= 13) return 'path home-stretch-yellow';

  // Regular path cells (the cross arms, outside the corners)
  // Horizontal arms: rows 6 and 8, cols 0–5 and 9–14
  if ((row === 6 || row === 8) && (col <= 5 || col >= 9)) {
    return isSafeCell(row, col) ? 'path safe' : 'path';
  }
  // Vertical arms: cols 6 and 8, rows 0–5 and 9–14
  if ((col === 6 || col === 8) && (row <= 5 || row >= 9)) {
    return isSafeCell(row, col) ? 'path safe' : 'path';
  }
  // Outer edge of the middle row/col (row 7 col 0/14, col 7 row 0/14)
  if (row === 7 && (col === 0 || col === 14)) return 'path';
  if (col === 7 && (row === 0 || row === 14)) return 'path';

  // Everything else (crossing squares like [6,6], [8,8] etc.) is inactive
  return 'inactive';
}

// ── Build board DOM ────────────────────────────────────────
function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + classifyCell(r, c);
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Safe-zone star
      if (cell.classList.contains('safe')) {
        const s = document.createElement('span');
        s.className = 'safe-star';
        s.textContent = '⭐';
        cell.appendChild(s);
      }

      // Centre star
      if (cell.classList.contains('center')) {
        const s = document.createElement('span');
        s.className = 'center-star';
        s.textContent = '⭐';
        cell.appendChild(s);
      }

      // Home nest marking
      if (HOME_NEST_COORDS.has(r + ',' + c)) {
        cell.classList.add('home-nest');
        // Derive player colour from the home-base class already on the cell
        if (r <= 5 && c <= 5)  cell.classList.add('nest-red');
        if (r <= 5 && c >= 9)  cell.classList.add('nest-blue');
        if (r >= 9 && c >= 9)  cell.classList.add('nest-green');
        if (r >= 9 && c <= 5)  cell.classList.add('nest-yellow');
      }

      board.appendChild(cell);
    }
  }
}

function getCellEl(row, col) {
  return document.querySelector('#board [data-row="' + row + '"][data-col="' + col + '"]');
}

// ── Game State ─────────────────────────────────────────────
let gs = {}; // game state

function newTokens(player) {
  return [0,1,2,3].map(id => ({ id, pos: -1, player }));
}

function initState() {
  gs = {
    tokens: {
      red:    newTokens('red'),
      blue:   newTokens('blue'),
      green:  newTokens('green'),
      yellow: newTokens('yellow')
    },
    currentPlayer: 'red',
    // WAITING_TO_ROLL | DICE_ROLLED | TOKEN_MOVING | GAME_OVER
    phase: 'WAITING_TO_ROLL',
    diceValue: 0,
    consecutiveSixes: 0,
    selectableIds: [],
    animating: false,
    winner: null
  };
}

// ── Token helpers ──────────────────────────────────────────
function getToken(player, id) {
  return gs.tokens[player].find(t => t.id === id);
}

function getSelectableTokens(player, dice) {
  return gs.tokens[player].filter(t => {
    if (t.pos === FINISH_POS) return false;            // already home
    if (t.pos === -1) return dice === 6;               // need 6 to exit
    const next = t.pos + dice;
    return next <= FINISH_POS;                         // can't overshoot
  });
}

// ── Capture logic ──────────────────────────────────────────
function checkCapture(player, token) {
  // Captures only possible on outer track (pos 0–50)
  if (token.pos < 0 || token.pos >= OUTER_COUNT) return;

  const [row, col] = PATHS[player][token.pos];
  if (isSafeCell(row, col)) return; // safe zone

  for (const other of PLAYERS) {
    if (other === player) continue;
    for (const ot of gs.tokens[other]) {
      if (ot.pos < 0 || ot.pos >= OUTER_COUNT) continue;
      const [or, oc] = PATHS[other][ot.pos];
      if (or === row && oc === col) {
        ot.pos = -1;
        playCaptureSound();
        addLog(PLAYER_NAMES[player] + ' captured ' + PLAYER_NAMES[other] + '\'s token ' + (ot.id + 1) + '!');
      }
    }
  }
}

// ── Win detection ──────────────────────────────────────────
function checkWin(player) {
  if (gs.tokens[player].every(t => t.pos === FINISH_POS)) {
    gs.winner = player;
    gs.phase = 'GAME_OVER';
    addLog('🎉 ' + PLAYER_NAMES[player] + ' wins!');
    playWinSound();
    setTimeout(() => showWinOverlay(player), 600);
  }
}

// ── Turn management ────────────────────────────────────────
function nextPlayer() {
  const idx = PLAYERS.indexOf(gs.currentPlayer);
  gs.currentPlayer = PLAYERS[(idx + 1) % 4];
  gs.consecutiveSixes = 0;
  gs.phase = 'WAITING_TO_ROLL';
  gs.diceValue = 0;
  gs.selectableIds = [];
  updateTurnUI();
  renderBoard();
  enableRollBtn();
}

// ── Dice ───────────────────────────────────────────────────
// Pip positions [gridRow, gridCol] in a 3×3 grid (1-indexed)
const PIP_LAYOUT = {
  1: [[2,2]],
  2: [[1,3],[3,1]],
  3: [[1,3],[2,2],[3,1]],
  4: [[1,1],[1,3],[3,1],[3,3]],
  5: [[1,1],[1,3],[2,2],[3,1],[3,3]],
  6: [[1,1],[2,1],[3,1],[1,3],[2,3],[3,3]]
};

function renderDice(value) {
  const die = document.getElementById('dice');
  die.innerHTML = '';
  for (const [r, c] of PIP_LAYOUT[value]) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.style.gridRow = r;
    pip.style.gridColumn = c;
    die.appendChild(pip);
  }
}

function animateDice(finalValue) {
  return new Promise(resolve => {
    const die = document.getElementById('dice');
    die.classList.add('rolling');
    playDiceRollSound();
    let tick = 0;
    const id = setInterval(() => {
      renderDice(Math.ceil(Math.random() * 6));
      if (++tick >= 10) {
        clearInterval(id);
        renderDice(finalValue);
        die.classList.remove('rolling');
        resolve();
      }
    }, 60);
  });
}

// ── Roll handler ───────────────────────────────────────────
async function handleRoll() {
  if (gs.phase !== 'WAITING_TO_ROLL' || gs.animating) return;

  disableRollBtn();
  gs.animating = true;

  const value = Math.ceil(Math.random() * 6);
  await animateDice(value);

  gs.animating = false;
  gs.diceValue = value;

  addLog(PLAYER_NAMES[gs.currentPlayer] + ' rolled ' + value + '.');

  // Track consecutive sixes
  if (value === 6) {
    gs.consecutiveSixes++;
    playSixSound();
  } else {
    gs.consecutiveSixes = 0;
  }

  // Three sixes in a row → forfeit turn
  if (gs.consecutiveSixes >= 3) {
    addLog('Three 6s in a row! ' + PLAYER_NAMES[gs.currentPlayer] + '\'s turn is forfeited.');
    await sleep(700);
    nextPlayer();
    return;
  }

  const selectable = getSelectableTokens(gs.currentPlayer, value);

  if (selectable.length === 0) {
    addLog('No valid moves for ' + PLAYER_NAMES[gs.currentPlayer] + '. Skipping.');
    await sleep(800);
    nextPlayer();
    return;
  }

  gs.phase = 'DICE_ROLLED';
  gs.selectableIds = selectable.map(t => t.id);
  renderBoard(); // shows pulse on selectable tokens
  // Roll button stays disabled until a token is moved
}

// ── Move handler ───────────────────────────────────────────
async function handleTokenClick(player, tokenId) {
  if (gs.phase !== 'DICE_ROLLED' || gs.animating) return;
  if (player !== gs.currentPlayer) return;
  if (!gs.selectableIds.includes(tokenId)) return;

  gs.phase = 'TOKEN_MOVING';
  gs.animating = true;
  gs.selectableIds = [];
  renderBoard(); // remove pulse highlights

  const token = getToken(player, tokenId);
  const steps = gs.diceValue;

  if (token.pos === -1) {
    // Exit from home base → start square (pos 0)
    token.pos = 0;
    renderBoard();
    playMoveSound();
    await sleep(300);
  } else {
    // Move step-by-step
    for (let s = 0; s < steps; s++) {
      token.pos++;
      renderBoard();
      playMoveSound();
      await sleep(150);
    }
  }

  // Capture check (outer track only)
  checkCapture(player, token);
  renderBoard();

  // Win check
  if (token.pos === FINISH_POS) {
    checkWin(player);
  }

  gs.animating = false;

  if (gs.phase === 'GAME_OVER') return;

  // Extra turn on a 6; otherwise advance turn
  if (gs.diceValue === 6) {
    gs.phase = 'WAITING_TO_ROLL';
    addLog(PLAYER_NAMES[player] + ' rolled 6 — extra turn!');
    updateTurnUI();
    enableRollBtn();
  } else {
    nextPlayer();
  }
}

// ── Rendering ──────────────────────────────────────────────
function renderBoard() {
  // Remove all existing token elements
  document.querySelectorAll('.token').forEach(el => el.remove());

  // Count tokens per board cell (for stacking layout)
  const countMap = {};
  for (const p of PLAYERS) {
    for (const t of gs.tokens[p]) {
      const [r, c] = tokenCoords(p, t);
      const key = r + ',' + c;
      countMap[key] = (countMap[key] || 0) + 1;
    }
  }

  const placedMap = {};

  for (const p of PLAYERS) {
    for (const t of gs.tokens[p]) {
      const [r, c] = tokenCoords(p, t);
      const key = r + ',' + c;
      const total = countMap[key];
      const idx   = placedMap[key] || 0;
      placedMap[key] = idx + 1;

      const el = createTokenEl(p, t.id, idx, total);

      const isSelectable = gs.phase === 'DICE_ROLLED' &&
                           p === gs.currentPlayer &&
                           gs.selectableIds.includes(t.id);
      if (isSelectable) el.classList.add('selectable');

      const cell = getCellEl(r, c);
      if (cell) cell.appendChild(el);
    }
  }
}

function tokenCoords(player, token) {
  if (token.pos === -1) return HOME_SLOTS[player][token.id];
  return PATHS[player][token.pos];
}

function createTokenEl(player, id, stackIdx, stackTotal) {
  const el = document.createElement('div');
  el.className = 'token token-' + player;
  el.dataset.player = player;
  el.dataset.id = id;
  el.textContent = id + 1;

  // Position & size based on how many tokens share this cell
  if (stackTotal === 1) {
    el.style.cssText = 'width:80%;height:80%;left:10%;top:10%';
  } else {
    // 2×2 arrangement; each token takes ~46% of cell
    const positions = [
      [2, 2], [52, 2],
      [2, 52], [52, 52]
    ];
    const [l, t] = positions[Math.min(stackIdx, 3)];
    el.style.cssText = 'width:46%;height:46%;left:' + l + '%;top:' + t + '%';
  }

  return el;
}

// ── UI helpers ─────────────────────────────────────────────
const PLAYER_COLORS_CSS = {
  red:    'var(--red)',
  blue:   'var(--blue)',
  green:  'var(--green)',
  yellow: 'var(--yellow)'
};

function updateTurnUI() {
  const p = gs.currentPlayer;
  document.getElementById('turn-color-dot').style.background = PLAYER_COLORS_CSS[p];
  document.getElementById('turn-text').textContent = PLAYER_NAMES[p] + '\'s Turn';
}

function enableRollBtn() {
  const btn = document.getElementById('roll-btn');
  btn.disabled = false;
}

function disableRollBtn() {
  document.getElementById('roll-btn').disabled = true;
}

function addLog(msg) {
  const log = document.getElementById('game-log');
  const entry = document.createElement('p');
  entry.className = 'log-entry';
  entry.textContent = msg;
  log.appendChild(entry);
  // Keep at most 8 entries
  while (log.childElementCount > 8) log.removeChild(log.firstElementChild);
  log.scrollTop = log.scrollHeight;
}

function showWinOverlay(player) {
  const overlay = document.getElementById('win-overlay');
  document.getElementById('win-message').textContent = PLAYER_NAMES[player] + ' Wins! 🎉';
  document.getElementById('win-message').style.color = PLAYER_COLORS_CSS[player];
  overlay.classList.remove('hidden');
}

function hideWinOverlay() {
  document.getElementById('win-overlay').classList.add('hidden');
}

// ── Game init / restart ────────────────────────────────────
function startNewGame() {
  hideWinOverlay();
  initState();
  renderDice(1); // show face-1 at start
  updateTurnUI();
  renderBoard();
  enableRollBtn();
  // Clear log
  const log = document.getElementById('game-log');
  log.innerHTML = '';
  addLog('Welcome to 9ja Ludo! Red goes first.');
}

// ── Utility ────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Sound Effects (Web Audio API) ──────────────────────────
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (some browsers require user gesture first)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playDiceRollSound() {
  try {
    const ctx = getCtx();
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (e) { /* Audio not available */ }
}

function playMoveSound() {
  try {
    const ctx  = getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) { /* */ }
}

function playCaptureSound() {
  try {
    const ctx  = getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* */ }
}

function playSixSound() {
  try {
    const ctx  = getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) { /* */ }
}

function playWinSound() {
  try {
    const ctx = getCtx();
    // Ascending C-E-G-C fanfare
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.3, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  } catch (e) { /* */ }
}

// ── Event listeners ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  initState();
  renderDice(1);
  updateTurnUI();
  renderBoard();

  // Roll button
  document.getElementById('roll-btn').addEventListener('click', handleRoll);

  // Token clicks (delegated to board)
  document.getElementById('board').addEventListener('click', e => {
    const el = e.target.closest('.token');
    if (!el) return;
    handleTokenClick(el.dataset.player, parseInt(el.dataset.id, 10));
  });

  // New game / Play again
  document.getElementById('new-game-btn').addEventListener('click', startNewGame);
  document.getElementById('play-again-btn').addEventListener('click', startNewGame);
});
