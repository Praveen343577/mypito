import fs   from 'fs';
import path from 'path';
import config           from './config.js';
import { todayString }  from './utils.js';

const PLATFORM_DIR = {
  YouTube:      'Youtube',
  YouTubeMusic: 'Youtube music',
  Instagram:    'Instagram',
  Twitter:      'Twitter',
  Pinterest:    'Pinterest',
  Others:       'Others',
};

/** Root output folder for a platform (and optional channel sub-folder for YouTube). */
export function getOutputDir(platform, channelName = null) {
  const dir = PLATFORM_DIR[platform] ?? 'Others';

  // YouTube uses channel sub-folder instead of a date folder
  if (platform === 'YouTube') {
    return path.join(config.DOWNLOAD_DIR, dir, channelName ?? 'Unknown_Channel');
  }

  return path.join(config.DOWNLOAD_DIR, dir, todayString());
}

/** metadata/ sub-folder inside the output folder */
export function getMetaDir(platform, channelName = null) {
  return path.join(getOutputDir(platform, channelName), 'metadata');
}

/**
 * Where @downloadedLinks.txt / @failedLinks.txt live.
 * YouTube → Downloads/Youtube/          (flat, shared across channels)
 * Others  → Downloads/<Platform>/<date>/
 */
export function getLogDir(platform) {
  const dir = PLATFORM_DIR[platform] ?? 'Others';
  if (platform === 'YouTube') {
    return path.join(config.DOWNLOAD_DIR, dir);
  }
  return path.join(config.DOWNLOAD_DIR, dir, todayString());
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/** Create all necessary folders for a platform and return their paths. */
export function setupDirs(platform, channelName = null) {
  const outputDir = getOutputDir(platform, channelName);
  const metaDir   = getMetaDir(platform, channelName);
  const logDir    = getLogDir(platform);

  ensureDir(outputDir);
  ensureDir(metaDir);
  ensureDir(logDir);

  return { outputDir, metaDir, logDir };
}