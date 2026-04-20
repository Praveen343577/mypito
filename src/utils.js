// ── Random helpers ─────────────────────────────────────────────────────────
export function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
  
export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
  
  // ── String helpers ─────────────────────────────────────────────────────────
  
  /** Truncate str to maxLen, never cutting mid-word */
export function truncateAtWordBoundary(str, maxLen) {
  if (!str || str.length <= maxLen) return str ?? '';
  const cut = str.slice(0, maxLen); 
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}
  
/** Strip characters illegal in filenames on Windows/Linux/macOS */
export function sanitizeFilename(name) {
  return (name ?? 'Unknown')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown';
}
  
// ── File-type detection ────────────────────────────────────────────────────
const VIDEO_EXTS = new Set(['mp4','mkv','webm','avi','mov','flv','m4v','ts','wmv','3gp']);
const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','tiff','avif','heic']);

export function isVideo(ext) { return VIDEO_EXTS.has((ext ?? '').toLowerCase()); }
export function isImage(ext) { return IMAGE_EXTS.has((ext ?? '').toLowerCase()); }

// ── Time formatting ────────────────────────────────────────────────────────
export function formatMs(ms) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}sec`;
  const mins = ms / 60_000;
  return `${mins.toFixed(1)}min`;
}

// ── Date string ────────────────────────────────────────────────────────────
export function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}_${m}_${day}`;
}