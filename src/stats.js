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

let _lastRender = 0;

function remaining() {
  return S.total - S.success - S.failed;
}

// ── Exports ───────────────────────────────────────────────────────────────

export function init(total) {
  S.total = total;
  render(true);
}

/** Call when a new URL starts downloading. Resets per-item fields. */
export function setCurrentDownload({ platform, url, ext = '', resolution = '', mediaIndex = 0, mediaTotal = 0 }) {
  S.platform    = platform;
  S.url         = url;
  S.ext         = ext;
  S.resolution  = resolution;
  S.mediaIndex  = mediaIndex;
  S.mediaTotal  = mediaTotal;
  S.size        = '';
  S.speed       = '';
  S.progress    = 0;
  S.statusLine  = '';
  render(true);
}

/** Call repeatedly during download with current progress data. Throttled to ~10 fps. */
export function updateProgress({ size, speed, progress, mediaIndex, mediaTotal } = {}) {
  if (size        !== undefined) S.size        = size;
  if (speed       !== undefined) S.speed       = speed;
  if (progress    !== undefined) S.progress    = Math.min(100, Math.max(0, Math.floor(progress)));
  if (mediaIndex  !== undefined) S.mediaIndex  = mediaIndex;
  if (mediaTotal  !== undefined) S.mediaTotal  = mediaTotal;
  render(false);   // throttled
}

export function markSuccess() { S.success++; render(true); }
export function markFailed()  { S.failed++;  render(true); }

export function setStatus(msg)  { S.statusLine = msg;  render(true); }
export function clearStatus()   { S.statusLine = '';   render(true); }

export function printSummary() {
  process.stdout.write('\x1B[2J\x1B[H');
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
  if (!force && now - _lastRender < 100) return;   // throttle to 10 fps
  _lastRender = now;

  process.stdout.write('\x1B[2J\x1B[H');

  // ── Header row ──────────────────────────────────────────────────────────
  process.stdout.write(
    chalk.bold.white(`Total: ${S.total}`) +
    chalk.gray('   |   ') +
    chalk.bold.green(`success: ${S.success}`) +
    chalk.gray('   |   ') +
    chalk.bold.red(`failed: ${S.failed}`) +
    chalk.gray('   |   ') +
    chalk.bold.yellow(`remaining: ${remaining()}`) +
    '\n'
  );
  process.stdout.write(chalk.gray('─'.repeat(63)) + '\n\n');

  if (!S.url) return;

  // ── Current item ────────────────────────────────────────────────────────
  const counter = S.mediaTotal > 0
    ? chalk.yellow(`[${S.mediaIndex}/${S.mediaTotal}]`)
    : chalk.yellow('[?/?]');

  process.stdout.write(
    chalk.bold.cyan(`[${S.platform}]`) + '  ' +
    chalk.white(`[${S.url}]`) + '  ' + counter + '\n'
  );

  // ── Progress bar ────────────────────────────────────────────────────────
  process.stdout.write(progressBar(S.progress) + '\n');

  // ── Stats row ───────────────────────────────────────────────────────────
  process.stdout.write(
    `size: ${chalk.bold(S.size || '—')}` +
    chalk.gray('   |   ') +
    `speed: ${chalk.bold(S.speed || '—')}` +
    chalk.gray('   |   ') +
    `progress: ${chalk.bold(S.progress + '%')}` +
    chalk.gray('   |   ') +
    `extension: ${chalk.bold(S.ext || '—')}` +
    chalk.gray('   |   ') +
    `resolution: ${chalk.bold(S.resolution || '—')}` +
    '\n\n'
  );

  if (S.statusLine) {
    process.stdout.write(chalk.dim(S.statusLine) + '\n');
  }
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