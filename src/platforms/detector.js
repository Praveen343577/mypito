// Ordered rules — music.youtube.com MUST come before youtube.com
const RULES = [
  { test: (u) => /music\.youtube\.com/i.test(u),       platform: 'YouTubeMusic' },
  { test: (u) => /youtube\.com|youtu\.be/i.test(u),    platform: 'YouTube'      },
  { test: (u) => /twitter\.com|x\.com/i.test(u),       platform: 'Twitter'      },
  { test: (u) => /instagram\.com/i.test(u),             platform: 'Instagram'    },
  { test: (u) => /pinterest\.com|pin\.it/i.test(u),    platform: 'Pinterest'    },
];
 
export function detectPlatform(url) {
  for (const rule of RULES) {
    if (rule.test(url)) return rule.platform;
  }
  return 'Others';
}
 
export function platformLabel(platform) {
  return {
    YouTube:      'YOUTUBE',
    YouTubeMusic: 'YOUTUBE MUSIC',
    Twitter:      'TWITTER',
    Instagram:    'INSTAGRAM',
    Pinterest:    'PINTEREST',
    Others:       'OTHERS',
  }[platform] ?? 'OTHERS';
}
 
/**
 * Which CLI tool handles this platform.
 * YouTube + YouTubeMusic → yt-dlp
 * Everything else        → gallery-dl
 */
export function getTool(platform) {
  return (platform === 'YouTube' || platform === 'YouTubeMusic') ? 'ytdlp' : 'gallerydl';
}