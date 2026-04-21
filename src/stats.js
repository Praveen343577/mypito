import chalk from 'chalk';

// ── Shared state ──────────────────────────────────────────────────────────
const S = {
  total:       0,
  success:     0,
  failed:      0,
  platform:    '',
  url:         '',
  mediaIndex:  0,
  mediaTotal:  0,
  size:        '',
  speed:       '',
  progress:    0,
  ext:         '',
  resolution:  '',
  statusLine:  '',
};

let _lastRender   = 0;
let _linesWritten = 0;   // tracks how many lines the last render produced

function remaining() {
  return S.total - S.success - S.failed;
}

// ── Exports ───────────────────────────────────────────────────────────────

export function init(total) {
  S.total       = total;
  _linesWritten = 0;   // nothing rendered yet — don't try to move cursor up
  render(true);
}

/** Call when a new URL starts downloading. Resets per-item fields. */
export function setCurrentDownload({ platform, url, ext = '', resolution = '', mediaIndex = 0, mediaTotal = 0 }) {
  S.platform   = platform;
  S.url        = url;
  S.ext        = ext;
  S.resolution = resolution;
  S.mediaIndex = mediaIndex;
  S.mediaTotal = mediaTotal;
  S.size       = '';
  S.speed      = '';
  S.progress   = 0;
  S.statusLine = '';
  render(true);
}

/** Call repeatedly during download with current progress data. Throttled to ~10 fps. */
export function updateProgress({ size, speed, progress, mediaIndex, mediaTotal } = {}) {
  if (size       !== undefined) S.size       = size;
  if (speed      !== undefined) S.speed      = speed;
  if (progress   !== undefined) S.progress   = Math.min(100, Math.max(0, Math.floor(progress)));
  if (mediaIndex !== undefined) S.mediaIndex = mediaIndex;
  if (mediaTotal !== undefined) S.mediaTotal = mediaTotal;
  render(false);   // throttled
}

/** Mark a download finished — clears the active-item display. */
export function markSuccess() {
  S.success++;
  _clearItem();
  render(true);
}

export function markFailed() {
  S.failed++;
  _clearItem();
  render(true);
}

export function setStatus(msg) { S.statusLine = msg; render(true); }
export function clearStatus()  { S.statusLine = '';  render(true); }

export function printSummary() {
  _eraseLastRender();
  console.log('');
  console.log(chalk.bold.green('  ✔  All downloads complete!'));
  console.log('');
  console.log(
    '  ' +
    chalk.bold(`Total: ${S.total}`) +
    chalk.gray('   |   ') +
    chalk.green(`Success: ${S.success}`) +
    chalk.gray('   |   ') +
    chalk.red(`Failed: ${S.failed}`)
  );
  console.log('');
}

// ── Rendering ─────────────────────────────────────────────────────────────

function render(force = false) {
  const now = Date.now();
  if (!force && now - _lastRender < 100) return;   // throttle to ~10 fps
  _lastRender = now;

  // ── Erase previous render in-place (no full screen clear) ──────────────
  _eraseLastRender();

  // ── Build output lines ──────────────────────────────────────────────────
  const lines = [];

  lines.push(
    chalk.bold.white(`Total: ${S.total}`) +
    chalk.gray('   |   ') +
    chalk.bold.green(`success: ${S.success}`) +
    chalk.gray('   |   ') +
    chalk.bold.red(`failed: ${S.failed}`) +
    chalk.gray('   |   ') +
    chalk.bold.yellow(`remaining: ${remaining()}`)
  );
  lines.push(chalk.gray('─'.repeat(63)));

  if (S.url) {
    lines.push('');   // blank spacer

    const counter = S.mediaTotal > 0
      ? chalk.yellow(`[${S.mediaIndex}/${S.mediaTotal}]`)
      : chalk.yellow('[?/?]');

    lines.push(
      chalk.bold.cyan(`[${S.platform}]`) + '  ' +
      chalk.white(`[${S.url}]`) + '  ' + counter
    );

    lines.push(progressBar(S.progress));

    lines.push(
      `size: ${chalk.bold(S.size || '—')}` +
      chalk.gray('   |   ') +
      `speed: ${chalk.bold(S.speed || '—')}` +
      chalk.gray('   |   ') +
      `progress: ${chalk.bold(S.progress + '%')}` +
      chalk.gray('   |   ') +
      `extension: ${chalk.bold(S.ext || '—')}` +
      chalk.gray('   |   ') +
      `resolution: ${chalk.bold(S.resolution || '—')}`
    );

    lines.push('');   // blank spacer
  }

  if (S.statusLine) {
    lines.push(chalk.dim(S.statusLine));
  }

  process.stdout.write(lines.join('\n') + '\n');
  _linesWritten = lines.length;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Move the cursor up exactly as many lines as the last render wrote,
 * then clear from the cursor to the end of the screen.
 * This overwrites the previous block in-place instead of appending below it.
 */
function _eraseLastRender() {
  if (_linesWritten > 0 && process.stdout.isTTY) {
    process.stdout.write(`\x1B[${_linesWritten}A\x1B[0J`);
  }
  _linesWritten = 0;
}

/** Reset per-item state after a download finishes. */
function _clearItem() {
  S.url        = '';
  S.platform   = '';
  S.progress   = 0;
  S.size       = '';
  S.speed      = '';
  S.ext        = '';
  S.resolution = '';
  S.mediaIndex = 0;
  S.mediaTotal = 0;
  S.statusLine = '';
}

function progressBar(pct) {
  const W      = 50;
  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 100 * W);
  const empty  = W - filled;
  return (
    '[' +
    chalk.green('█'.repeat(filled)) +
    chalk.gray('░'.repeat(empty)) +
    `] ${pct}%`
  );
}