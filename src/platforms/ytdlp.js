import { spawn }  from 'child_process';
import fs         from 'fs';
import path       from 'path';

import config                         from '../config.js';
import { truncateAtWordBoundary, sanitizeFilename, todayString } from '../utils.js';
import { setupDirs }                  from '../folders.js';
import { setCurrentDownload, updateProgress } from '../stats.js';
import { platformLabel }              from './detector.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public entry-point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a URL using yt-dlp.
 * Handles: YouTube, YouTubeMusic, Others
 *
 * @returns {{ success: boolean, files: string[], channelName: string, reason?: string }}
 */
export async function download(url, platform) {
  // 1 ── Fetch metadata so we know title / uploader before downloading
  const meta = await fetchMeta(url, platform);

  // 2 ── Determine output structure
  const isMusic  = platform === 'YouTubeMusic';
  const isYT     = platform === 'YouTube';
  const channel  = isYT ? sanitizeFilename(meta.uploader || 'Unknown_Channel') : null;

  const { outputDir, metaDir } = setupDirs(platform, channel);

  // 3 ── Seed the stats display for this URL
  setCurrentDownload({
    platform:   platformLabel(platform),
    url,
    ext:        isMusic ? config.YTDLP_AUDIO_CODEC : config.YTDLP_MERGE_FORMAT,
    resolution: isMusic ? 'audio only' : meta.resolution,
  });

  // 4 ── Build command and run
  const args = buildArgs(url, platform, meta, outputDir, metaDir);
  return run(args, channel);
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata pre-fetch
// ─────────────────────────────────────────────────────────────────────────────

function fetchMeta(url, platform) {
  return new Promise((resolve) => {
    const format = platform === 'YouTubeMusic' ? config.YTDLP_AUDIO_FORMAT : config.YTDLP_VIDEO_FORMAT;
    const args = [
      '--no-download',
      '--playlist-items', '1',         // for playlists only fetch item 1's meta
      '-f', format,
      '--print', '%(uploader)s|%(title)s|%(width)s|%(height)s',
      url,
    ];

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';

    proc.stdout.on('data', (d) => { out += d.toString(); });

    proc.on('close', () => {
      // yt-dlp may print one line per playlist item; take the first
      const firstLine = out.split('\n').find((l) => l.trim()) ?? '';
      const [uploader = '', title = '', width = '', height = ''] = firstLine.split('|');

      const hasRes = width && height && width !== 'NA' && height !== 'NA';
      resolve({
        uploader:   uploader.trim()  || 'Unknown_Channel',
        title:      title.trim()     || 'Unknown_Title',
        resolution: hasRes ? `${width.trim()}x${height.trim()}` : '?x?',
      });
    });

    proc.on('error', () => resolve({
      uploader: 'Unknown_Channel', title: 'Unknown_Title', resolution: '?x?',
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build yt-dlp argument list
// ─────────────────────────────────────────────────────────────────────────────

function buildArgs(url, platform, meta, outputDir, metaDir) {
  const isMusic = platform === 'YouTubeMusic';

  const safeTitle = sanitizeFilename(
    truncateAtWordBoundary(meta.title, config.TITLE_MAX_LEN)
  );

  // For YouTube Music: check for duplicate titles and suffix with a number
  let finalTitle = safeTitle;
  if (isMusic) {
    finalTitle = uniqueTitle(safeTitle, outputDir, config.YTDLP_AUDIO_CODEC);
  }

  const outputTemplate = path.join(outputDir, `${finalTitle}.%(ext)s`);

  const args = [
    '--output',           outputTemplate,
    '--paths',            `infojson:${metaDir}`,
    '--paths',            `thumbnail:${metaDir}`,
    '--write-info-json',
    '--write-thumbnail',
    '--convert-thumbnails', 'webp',
    '--newline',                          // force one progress line per \n (easier to parse)
    '--no-colors',
  ];

  if (isMusic) {
    // ── Audio only (FLAC) ─────────────────────────────────────────────────
    args.push('--format',        config.YTDLP_AUDIO_FORMAT);
    args.push('--extract-audio');
    args.push('--audio-format',  config.YTDLP_AUDIO_CODEC);
    args.push('--audio-quality', '0');
  } else {
    // ── Video (MKV, up to 4K) ──────────────────────────────────────────────
    args.push('--format',              config.YTDLP_VIDEO_FORMAT);
    args.push('--merge-output-format', config.YTDLP_MERGE_FORMAT);
  }

  args.push(url);
  return args;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn yt-dlp and parse output
// ─────────────────────────────────────────────────────────────────────────────

function run(args, channelName) {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr         = '';
    const downloadedFiles = [];
    let mediaIndex     = 0;
    let mediaTotal     = 0;

    function parseLine(line) {
      // Playlist counter: "Downloading item 3 of 10"
      const playlist = line.match(/Downloading item (\d+) of (\d+)/i);
      if (playlist) {
        mediaIndex = parseInt(playlist[1], 10);
        mediaTotal = parseInt(playlist[2], 10);
      }

      // Download progress: "[download]  88.5% of   25.70MiB at    4.60MiB/s ETA 00:03"
      //                    "[download]  88.5% of ~  25.70MiB at    4.60MiB/s ETA 00:03"
      const dl = line.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+\/s)/i
      );
      if (dl) {
        updateProgress({
          progress:   parseFloat(dl[1]),
          size:       dl[2].trim(),
          speed:      dl[3].trim(),
          mediaIndex,
          mediaTotal,
        });
      }

      // Destination file (before merging)
      const dest = line.match(/\[download\] Destination:\s+(.+)/i);
      if (dest) {
        const name = path.basename(dest[1].trim());
        if (!downloadedFiles.includes(name)) downloadedFiles.push(name);
      }

      // Merged output file
      const merge = line.match(/\[Merger\] Merging formats into "(.+)"/i);
      if (merge) {
        const name = path.basename(merge[1].replace(/^"/, '').replace(/"$/, '').trim());
        if (!downloadedFiles.includes(name)) downloadedFiles.push(name);
      }

      // ExtractAudio output
      const audio = line.match(/\[ExtractAudio\] Destination:\s+(.+)/i);
      if (audio) {
        const name = path.basename(audio[1].trim());
        if (!downloadedFiles.includes(name)) downloadedFiles.push(name);
      }
    }

    proc.stdout.on('data', (d) => d.toString().split('\n').forEach(parseLine));
    proc.stderr.on('data', (d) => {
      const text = d.toString();
      text.split('\n').forEach(parseLine);
      stderr += text;
    });

    proc.on('close', (code) => {
      // Return base names (no extension) for the log file
      const baseNames = downloadedFiles.map((f) => path.basename(f, path.extname(f)));

      if (code === 0) {
        resolve({ success: true, files: baseNames, channelName });
      } else {
        resolve({ success: false, reason: extractError(stderr), channelName });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, reason: `yt-dlp error: ${err.message}`, channelName });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a title that doesn't collide with existing files in outputDir */
function uniqueTitle(baseTitle, outputDir, ext) {
  if (!fs.existsSync(path.join(outputDir, `${baseTitle}.${ext}`))) {
    return baseTitle;
  }
  let counter = 2;
  while (fs.existsSync(path.join(outputDir, `${baseTitle} ${counter}.${ext}`))) {
    counter++;
  }
  return `${baseTitle} ${counter}`;
}

function extractError(stderr) {
  const line = stderr.split('\n').find((l) => /ERROR:/i.test(l));
  return line ? line.replace(/^.*?ERROR:\s*/i, '').trim() : 'Unknown yt-dlp error';
}