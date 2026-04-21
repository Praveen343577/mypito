import { spawn }  from 'child_process';
import fs         from 'fs';
import path       from 'path';
import os         from 'os';

import config                           from '../config.js';
import { isVideo, isImage, sanitizeFilename } from '../utils.js';
import { setupDirs }                    from '../folders.js';
import { setCurrentDownload, updateProgress } from '../stats.js';
import { platformLabel }                from './detector.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public entry-point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a URL using gallery-dl.
 * Handles: Instagram, Twitter, Pinterest, Others
 *
 * @returns {{ success: boolean, files: string[], reason?: string }}
 */
export async function download(url, platform) {
  const label  = platformLabel(platform);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'galdl-'));

  const { outputDir, metaDir } = setupDirs(platform);

  setCurrentDownload({ platform: label, url });

  let runResult;
  try {
    runResult = await runGalleryDl(url, tmpDir);
  } catch (err) {
    cleanup(tmpDir);
    return { success: false, reason: err.message };
  }

  // Even if exit code was non-zero, if files landed in tmpDir treat as partial success
  const files = getAllFiles(tmpDir);
  if (files.length === 0) {
    cleanup(tmpDir);
    return { success: false, reason: runResult.reason ?? 'gallery-dl produced no files' };
  }

  // Show 100% now that we have confirmed files
  updateProgress({ progress: 100 });

  // Rename and move files to their permanent location
  const renamedNames = postProcess(tmpDir, files, outputDir, metaDir, url);

  cleanup(tmpDir);
  return { success: true, files: renamedNames };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn gallery-dl
// ─────────────────────────────────────────────────────────────────────────────

function runGalleryDl(url, tmpDir) {
  return new Promise((resolve) => {
    const args = [
      '--cookies',              config.COOKIES_FILE,
      '-D',                     tmpDir,        // exact output directory (no sub-folders)
      '--write-metadata',                       // create .json alongside each file
      '--no-download-archive',                  // never skip based on archive
      url,
    ];

    const proc = spawn('gallery-dl', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr     = '';
    let mediaCount = 0;

    // stdout: gallery-dl prints each downloaded file path on its own line
    proc.stdout.on('data', (d) => {
      const lines = d.toString().split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        // gallery-dl prints the path to every downloaded file on stdout
        if (!line.endsWith('.json') && (isKnownMediaLine(line) || fs.existsSync(line))) {
          mediaCount++;
          // Do NOT pass mediaTotal: 0 — that would overwrite any real value with zero
          updateProgress({ mediaIndex: mediaCount });
        }
      }
    });

    // stderr: progress / errors
    proc.stderr.on('data', (d) => {
      const text = d.toString();
      stderr += text;

      // Parse each \r-delimited chunk (gallery-dl uses \r for progress bars)
      const chunks = text.split(/[\r\n]/).filter(Boolean);
      for (const chunk of chunks) {
        parseGalleryDlProgress(chunk);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        const reason = stderr.split('\n').find((l) => /error/i.test(l))?.trim()
                    ?? 'gallery-dl exited with non-zero status';
        resolve({ success: false, reason });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, reason: `gallery-dl not found or failed to start: ${err.message}` });
    });
  });
}

/** Parse known gallery-dl stderr progress formats */
function parseGalleryDlProgress(line) {
  // Format A: "  1.23 MiB /  5.67 MiB  2.34 MiB/s [#####   ] ETA 0:00:01"
  const fmtA = line.match(
    /([\d.]+\s*\w+)\s*\/\s*([\d.]+\s*\w+)\s+([\d.]+\s*[\w/]+)/i
  );
  if (fmtA) {
    const dlNum  = parseSize(fmtA[1]);
    const totNum = parseSize(fmtA[2]);
    const pct    = totNum > 0 ? (dlNum / totNum) * 100 : 0;
    updateProgress({ size: fmtA[2].trim(), speed: fmtA[3].trim(), progress: pct });
    return;
  }

  // Format B: "[downloader]  4.00 MiB  2.34 MiB/s"  (no total)
  const fmtB = line.match(/\[downloader\]\s+([\d.]+\s*\w+)\s+([\d.]+\s*[\w/]+)/i);
  if (fmtB) {
    updateProgress({ size: fmtB[1].trim(), speed: fmtB[2].trim() });
    return;
  }

  // Format C: tqdm style "100%|████| 4.00M/4.00M [00:03<00:00, 1.00MiB/s]"
  const fmtC = line.match(/(\d+)%.*?([\d.]+\s*[\w/]+)\]/i);
  if (fmtC) {
    updateProgress({ progress: parseInt(fmtC[1], 10), speed: fmtC[2].trim() });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing: rename files and move to permanent location
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads all files from tmpDir, renames them using the username v/p convention,
 * moves media to outputDir and metadata JSONs to metaDir.
 * @returns {string[]} base names (no extension) of renamed media files
 */
function postProcess(tmpDir, allFiles, outputDir, metaDir, url) {
  const metaFiles  = allFiles.filter((f) => f.endsWith('.json'));
  const mediaFiles = allFiles.filter((f) => !f.endsWith('.json'));

  // Attempt to extract username from metadata JSONs
  const username = extractUsername(metaFiles, url);

  // Sort for stable ordering
  mediaFiles.sort();

  // Separate by type
  const videos = mediaFiles.filter((f) => isVideo(path.extname(f).slice(1)));
  const images = mediaFiles.filter((f) => isImage(path.extname(f).slice(1)));
  const others = mediaFiles.filter(
    (f) => !isVideo(path.extname(f).slice(1)) && !isImage(path.extname(f).slice(1))
  );

  const renamedNames = [];

  // ── Videos → username v1, username v2, …
  videos.forEach((filePath, i) => {
    const ext      = path.extname(filePath);
    const baseName = `${username} v${i + 1}`;
    safeMove(filePath, path.join(outputDir, `${baseName}${ext}`));
    renamedNames.push(baseName);
    moveMatchingMeta(filePath, metaFiles, metaDir, baseName);
  });

  // ── Images → username p1, username p2, …
  images.forEach((filePath, i) => {
    const ext      = path.extname(filePath);
    const baseName = `${username} p${i + 1}`;
    safeMove(filePath, path.join(outputDir, `${baseName}${ext}`));
    renamedNames.push(baseName);
    moveMatchingMeta(filePath, metaFiles, metaDir, baseName);
  });

  // ── Unknown files — move as-is
  others.forEach((filePath) => {
    const name = path.basename(filePath);
    safeMove(filePath, path.join(outputDir, name));
    renamedNames.push(path.basename(name, path.extname(name)));
  });

  // ── Remaining metadata JSONs that weren't matched above
  for (const mf of metaFiles) {
    if (fs.existsSync(mf)) {
      safeMove(mf, path.join(metaDir, path.basename(mf)));
    }
  }

  return renamedNames;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * gallery-dl writes metadata as <media_file_full_path>.json
 * Find and move it, renaming to <baseName>.json
 */
function moveMatchingMeta(mediaPath, metaFiles, metaDir, baseName) {
  const expected = mediaPath + '.json';
  const idx      = metaFiles.indexOf(expected);
  if (idx !== -1 && fs.existsSync(expected)) {
    safeMove(expected, path.join(metaDir, `${baseName}.json`));
    metaFiles.splice(idx, 1);   // mark as handled
  }
}

/** Extract username from metadata JSONs; fall back to URL parsing */
function extractUsername(metaFiles, url) {
  for (const mf of metaFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(mf, 'utf8'));
      const name =
        data?.owner?.username  ??
        data?.user?.username   ??
        data?.author?.name     ??
        data?.author?.username ??
        data?.user?.name       ??
        data?.username         ??
        null;
      if (name) return sanitizeFilename(String(name));
    } catch { /* skip unreadable JSON */ }
  }

  // Fall back: try to extract handle from URL path
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    // Common patterns: /username/...  or  /@username/...
    const handle = parts.find((p) => p.startsWith('@'))?.slice(1)
                ?? (parts[0] && !['p','reel','status','i','pin','pins'].includes(parts[0])
                    ? parts[0]
                    : null);
    if (handle) return sanitizeFilename(handle);
  } catch { /* ignore bad URLs */ }

  return 'unknown';
}

/** Recursively collect all file paths under dir */
function getAllFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) getAllFiles(full, result);
    else result.push(full);
  }
  return result;
}

function safeMove(src, dest) {
  try { fs.renameSync(src, dest); } catch { /* already moved or missing */ }
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/** Quick heuristic: does this stdout line look like a media file path? */
function isKnownMediaLine(line) {
  return /\.(jpg|jpeg|png|gif|webp|mp4|mkv|webm|mov|flv|m4v|avif)$/i.test(line);
}

function parseSize(s) {
  const m = (s ?? '').match(/([\d.]+)\s*(\w+)/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  const table = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, kib: 1024, mib: 1_048_576, gib: 1_073_741_824 };
  return v * (table[u] ?? 1);
}