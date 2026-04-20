import fs      from 'fs';
import chalk   from 'chalk';
import config  from './config.js';
import { runDownloader } from './downloader.js';

async function main() {
  console.clear();
  console.log(chalk.bold.cyan('\n  Batch Media Downloader\n'));

  // ── Validate inputs ────────────────────────────────────────────────────────
  let hasError = false;

  if (!fs.existsSync(config.LINKS_FILE)) {
    console.error(chalk.red(`  ✗  Links.txt not found at: ${config.LINKS_FILE}`));
    hasError = true;
  }

  if (!fs.existsSync(config.COOKIES_FILE)) {
    console.error(chalk.red(`  ✗  cookies.txt not found at: ${config.COOKIES_FILE}`));
    hasError = true;
  }

  if (hasError) {
    console.error(chalk.dim('\n  Place Links.txt and cookies.txt in the project root.\n'));
    process.exit(1);
  }

  // ── Read links ─────────────────────────────────────────────────────────────
  const raw = fs.readFileSync(config.LINKS_FILE, 'utf8');
  const links = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (links.length === 0) {
    console.error(chalk.red('  ✗  Links.txt is empty or contains only comments.'));
    process.exit(1);
  }

  console.log(chalk.green(`  ✓  ${links.length} link(s) found in Links.txt`));
  console.log(chalk.green(`  ✓  Session size : ${config.SESSION_SIZE} links`));
  console.log(chalk.green(`  ✓  Delay        : ${config.DELAY_MIN / 1000}s – ${config.DELAY_MAX / 1000}s between links`));
  console.log(chalk.green(`  ✓  Cooldown     : ${config.COOLDOWN_MIN / 60000}min – ${config.COOLDOWN_MAX / 60000}min between sessions`));
  console.log(chalk.green(`  ✓  Downloads    : ${config.DOWNLOAD_DIR}\n`));

  // Brief pause so the user can read the summary
  await new Promise((r) => setTimeout(r, 2_000));

  await runDownloader(links);
}

main().catch((err) => {
  console.error(chalk.red('\n  Fatal error:'), err);
  process.exit(1);
});