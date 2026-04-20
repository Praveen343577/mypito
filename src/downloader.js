import { detectPlatform, getTool }         from './platforms/detector.js';
import { download as ytdlpDownload }       from './platforms/ytdlp.js';
import { download as gallerydlDownload }   from './platforms/gallerydl.js';
import { logSuccess, logFailure }          from './logger.js';
import {
  init       as statsInit,
  markSuccess, markFailed,
  setStatus,  clearStatus,
  printSummary,
} from './stats.js';
import config                              from './config.js';
import { randomBetween, sleep, formatMs }  from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────

export async function runDownloader(links) {
  statsInit(links.length);

  const sessions = chunk(links, config.SESSION_SIZE);

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];

    for (let li = 0; li < session.length; li++) {
      const url      = session[li].trim();
      const platform = detectPlatform(url);
      const tool     = getTool(platform);

      // ── Download ──────────────────────────────────────────────────────────
      let result;
      try {
        result = tool === 'ytdlp'
          ? await ytdlpDownload(url, platform)
          : await gallerydlDownload(url, platform);
      } catch (err) {
        result = { success: false, reason: err.message };
      }

      // ── Record result ─────────────────────────────────────────────────────
      if (result.success) {
        markSuccess();
        logSuccess(platform, url, result.files ?? []);
      } else {
        markFailed();
        logFailure(platform, url, result.reason ?? 'Unknown error');
      }

      // ── Decide what pause comes next ──────────────────────────────────────
      const isLastLinkInSession  = li === session.length - 1;
      const isLastSession        = si === sessions.length - 1;

      if (isLastLinkInSession && isLastSession) {
        // Very last link — no pause needed
        break;
      }

      if (!isLastLinkInSession) {
        // Normal inter-link delay
        const delay = randomBetween(config.DELAY_MIN, config.DELAY_MAX);
        setStatus(`waiting ${formatMs(delay)} before downloading next link`);
        await sleep(delay);
        clearStatus();
      }
    }

    // ── Session cooldown (between sessions only) ───────────────────────────
    const isLastSession = si === sessions.length - 1;
    if (!isLastSession) {
      const cooldown = randomBetween(config.COOLDOWN_MIN, config.COOLDOWN_MAX);
      await countdown(cooldown);
    }
  }

  printSummary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown during cooldown — updates every second so user sees time remaining
// ─────────────────────────────────────────────────────────────────────────────

async function countdown(totalMs) {
  const endAt = Date.now() + totalMs;

  while (Date.now() < endAt) {
    const left = endAt - Date.now();
    setStatus(`⏳  Session cooldown — next session starts in ${formatMs(left)}`);
    await sleep(Math.min(1_000, left));
  }

  clearStatus();
}

// ─────────────────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}