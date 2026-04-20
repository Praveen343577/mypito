import fs   from 'fs';
import path from 'path';
import { getLogDir, ensureDir } from './folders.js';

/**
 * Append a success entry to @downloadedLinks.txt.
 * @param {string}   platform
 * @param {string}   url
 * @param {string[]} fileNames  — base names without extension, e.g. ['user v1', 'user p1']
 */
export function logSuccess(platform, url, fileNames) {
  const logDir = getLogDir(platform);
  ensureDir(logDir);

  let block = `${url}\n`;
  for (const name of fileNames) block += `${name}\n`;
  block += '\n';

  fs.appendFileSync(path.join(logDir, '@downloadedLinks.txt'), block, 'utf8');
}

/**
 * Append a failure entry to @failedLinks.txt.
 * @param {string} platform
 * @param {string} url
 * @param {string} reason
 */
export function logFailure(platform, url, reason) {
  const logDir = getLogDir(platform);
  ensureDir(logDir);

  const block = `${url}\n${reason}\n\n`;
  fs.appendFileSync(path.join(logDir, '@failedLinks.txt'), block, 'utf8');
}