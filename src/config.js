import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  // ── Input files (place these at the project root) ─────────────────────
  LINKS_FILE:   path.join(ROOT, 'Links.txt'),
  // COOKIES_FILE: path.join(ROOT, 'cookies.txt'),

  // ── Where all media lands ──────────────────────────────────────────────
  DOWNLOAD_DIR: path.join(ROOT, 'Downloads'),

  // ── Session control ────────────────────────────────────────────────────
  SESSION_SIZE:  25,          // links per session

  DELAY_MIN:     1_000,       // ms — min pause between individual links
  DELAY_MAX:     4_000,       // ms — max pause between individual links

  COOLDOWN_MIN:  10 * 60 * 1000,   // ms — min cooldown between sessions (10 min)
  COOLDOWN_MAX:  15 * 60 * 1000,   // ms — max cooldown between sessions (15 min)

  // ── yt-dlp formats ────────────────────────────────────────────────────
  // Best video up to 4K (2160p) merged into MKV
  // YTDLP_VIDEO_FORMAT:
  //   'bestvideo[height<=2160][ext=mkv]+bestaudio[ext=m4a]/' +
  //   'bestvideo[height<=2160]+bestaudio/' +
  //   'best[height<=2160]',

  YTDLP_VIDEO_FORMAT: 'bestvideo+bestaudio/best',
  YTDLP_MERGE_FORMAT: 'mkv',

  // Best audio → FLAC
  YTDLP_AUDIO_FORMAT: 'bestaudio/best',
  YTDLP_AUDIO_CODEC:  'flac',

  // ── Naming ────────────────────────────────────────────────────────────
  TITLE_MAX_LEN: 100,
};

export default config;