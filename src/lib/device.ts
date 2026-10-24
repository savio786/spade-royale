// What device and browser is this, and how do you put Spade Haven on its home screen / desktop?
// Used by the install page (/install) and the "Add to home screen" banner, so both always agree.
//
// What each browser can do (this is why the steps differ):
//  · Chrome, Edge, Opera, Samsung Internet (Android + computers): one-tap "Install" through the browser's install prompt.
//  · Safari on iPhone / iPad: no prompt, only Share → Add to Home Screen. Chrome / Edge / Firefox on iPhone can do the same from iOS 16.4.
//  · Safari on Mac (macOS 14+): File → Add to Dock.
//  · Firefox on a computer: can't install web apps (a bookmark is the best it can do).
//  · Facebook / Messenger / Instagram… browsers: can't install anything, so the link has to be opened in the real browser.

export type Platform = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'other';
export type Browser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'duckduckgo' | 'other';

export interface Device { platform: Platform; browser: Browser; iosVersion: number | null; inApp: boolean; mobile: boolean }

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|Snapchat|TikTok|MicroMessenger|Twitter|LinkedInApp|Pinterest|GSA\//i;

/** Works from the browser's own description of itself (passed in, so it can be tested for any device). */
export function detectDevice(ua: string, platform = '', touchPoints = 0): Device {
  const ipadOs = platform === 'MacIntel' && touchPoints > 1;   // iPads say they are Macs
  let p: Platform = 'other';
  if (/iPhone|iPad|iPod/.test(ua) || ipadOs) p = 'ios';
  else if (/Android/i.test(ua)) p = 'android';
  else if (/CrOS/.test(ua)) p = 'chromeos';
  else if (/Windows/i.test(ua)) p = 'windows';
  else if (/Macintosh|Mac OS X/.test(ua)) p = 'mac';
  else if (/Linux|X11/.test(ua)) p = 'linux';

  let b: Browser = 'other';
  if (/EdgiOS|EdgA|Edg\//.test(ua)) b = 'edge';
  else if (/OPiOS|OPR\/|Opera/.test(ua)) b = 'opera';
  else if (/SamsungBrowser/.test(ua)) b = 'samsung';
  else if (/FxiOS|Firefox\//.test(ua)) b = 'firefox';
  else if (/DuckDuckGo/.test(ua)) b = 'duckduckgo';
  else if (/CriOS|Chrome\//.test(ua)) b = 'chrome';
  else if (/Safari\//.test(ua) || /Version\/[\d.]+.*Safari/.test(ua)) b = 'safari';

  const m = ua.match(/OS (\d+)[_.](\d+)/);
  const iosVersion = p === 'ios' && m ? Number(m[1]) + Number(m[2]) / 100 : null;   // 16.4 → 16.04 (compare with ≥ 16.04)
  return { platform: p, browser: b, iosVersion, inApp: IN_APP.test(ua), mobile: p === 'ios' || p === 'android' };
}

export const thisDevice = (): Device => detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
export const alreadyInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const PLATFORM_NAME: Record<Platform, string> = { ios: 'iPhone / iPad', android: 'Android', windows: 'Windows', mac: 'Mac', linux: 'Linux', chromeos: 'Chromebook', other: 'this device' };
export const BROWSER_NAME: Record<Browser, string> = { safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', samsung: 'Samsung Internet', opera: 'Opera', duckduckgo: 'DuckDuckGo', other: 'your browser' };

export interface Guide {
  /** can this device install it at all, in this browser? */
  supported: boolean;
  /** the steps, in words. `{share}` is the iPhone Share icon, **bold** marks what to tap. */
  steps: string[];
  /** a line under the steps (what to do if it isn't there) */
  note?: string;
  /** one short sentence for the banner */
  short: string;
  /** a browser that CAN install, to open this page in instead (when this one can't) */
  switchTo?: string;
}

const SHARE_ADD = ['Tap the **Share** button {share} (at the bottom of the screen on iPhone, at the top on iPad).', 'Scroll down and tap **Add to Home Screen**.', 'Tap **Add**. Spade Haven appears on your home screen.'];

/** The right instructions for this device + browser. `canPrompt` = the browser has already offered its one-tap install. */
export function installGuide(d: Device, canPrompt = false): Guide {
  const { platform: p, browser: b } = d;
  // ----- iPhone / iPad: every browser here is Safari underneath; only Safari (and, from iOS 16.4, Chrome/Edge/Firefox…) can add to the home screen
  if (p === 'ios') {
    if (b === 'safari') return { supported: true, steps: SHARE_ADD, short: 'Tap Share, then Add to Home Screen.', note: 'Can’t find Add to Home Screen? Scroll down in the Share menu, it’s below the app icons.' };
    const newEnough = d.iosVersion !== null && d.iosVersion >= 16.04;
    if (['chrome', 'edge', 'firefox', 'opera'].includes(b) && newEnough) {
      return { supported: true, steps: ['Tap the **Share** button {share} next to the address bar (or open the **⋯** menu).', 'Tap **Add to Home Screen**.', 'Tap **Add**. Spade Haven appears on your home screen.'], short: 'Tap Share, then Add to Home Screen.', note: 'Not in the menu? Open this page in Safari and use Share → Add to Home Screen.' };
    }
    return { supported: false, switchTo: 'Safari', steps: ['Open this page in **Safari** (copy the link and paste it into Safari).', ...SHARE_ADD], short: 'Open the game in Safari to add it.', note: 'Your iPhone only lets Safari add web apps to the home screen.' };
  }
  // ----- Android
  if (p === 'android') {
    if (b === 'samsung') return { supported: true, steps: ['Tap the **≡** menu at the bottom right.', 'Tap **Add page to** and choose **Home screen** (or **Install app** if you see it).', 'Tap **Add**.'], short: 'Tap ≡ then Add page to → Home screen.' };
    if (b === 'edge') return { supported: true, steps: ['Tap the **≡** menu at the bottom.', 'Tap **Add to phone** (or **Install app**).', 'Tap **Install** / **Add**.'], short: 'Tap ≡ then Add to phone.' };
    if (b === 'firefox') return { supported: true, steps: ['Tap the **⋮** menu.', 'Tap **Install** (or **Add to Home screen**).', 'Tap **Add**.'], short: 'Tap ⋮ then Install.' };
    if (b === 'opera') return { supported: true, steps: ['Tap the **⋮** menu.', 'Tap **Home screen** (or **Add to Home screen**).', 'Tap **Add**.'], short: 'Tap ⋮ then Home screen.' };
    if (b === 'duckduckgo') return { supported: false, switchTo: 'Chrome', steps: ['Open this page in **Chrome** (copy the link and paste it in Chrome).', 'Tap the **⋮** menu, then **Install app**.'], short: 'Open the game in Chrome to add it.' };
    return { supported: true, steps: canPrompt ? ['Tap **Install the app** above, then **Install** again in the box that pops up.'] : ['Tap the **⋮** menu at the top right.', 'Tap **Install app** (or **Add to Home screen**).', 'Tap **Install**. Spade Haven appears on your home screen.'], short: 'Tap ⋮ then Install app.' };
  }
  // ----- computers
  const computer = p === 'windows' || p === 'mac' || p === 'linux' || p === 'chromeos' || p === 'other';
  if (computer) {
    if (b === 'safari' && p === 'mac') return { supported: true, steps: ['In the menu bar at the top of the screen, click **File**.', 'Click **Add to Dock…**.', 'Click **Add**. Spade Haven appears in your Dock.'], short: 'File → Add to Dock.', note: 'Needs macOS Sonoma (14) or newer with Safari 17.' };
    if (b === 'firefox') return { supported: false, switchTo: 'Chrome or Edge', steps: ['Firefox can’t install web apps on computers. Open this page in **Chrome** or **Edge** and use the install icon in the address bar.', 'Or press **Ctrl + D** (**⌘ + D** on Mac) to bookmark the game for quick access.'], short: 'Open the game in Chrome or Edge to install it.' };
    if (b === 'edge') return { supported: true, steps: ['Click the **Install** icon at the right end of the address bar (a window with a plus), then **Install**.', 'Or open the **⋯** menu → **Apps** → **Install this site as an app**.'], short: 'Click the install icon in the address bar.' };
    if (b === 'chrome' || b === 'opera') return { supported: true, steps: ['Click the **Install** icon at the right end of the address bar (a screen with a down arrow), then **Install**.', `Or open the **⋮** menu → **${b === 'chrome' ? 'Cast, save and share → Install page as app' : 'Install Spade Haven'}**.`], short: 'Click the install icon in the address bar.' };
    if (b === 'safari') return { supported: false, switchTo: 'Chrome or Edge', steps: ['Open this page in **Chrome** or **Edge** and use the install icon in the address bar.'], short: 'Open the game in Chrome or Edge to install it.' };
  }
  return { supported: false, switchTo: 'Chrome or Edge', steps: ['Open this page in **Chrome** or **Edge**, then use the install option in the browser’s menu.'], short: 'Open the game in Chrome or Edge to install it.' };
}

/** A line per kind of device, for the "other devices" list on the install page (one link works for everybody). */
export const OTHER_DEVICES: { name: string; how: string }[] = [
  { name: 'iPhone & iPad', how: 'Safari → Share → Add to Home Screen' },
  { name: 'Android', how: 'Chrome → ⋮ menu → Install app' },
  { name: 'Windows & Chromebook', how: 'Chrome or Edge → install icon in the address bar' },
  { name: 'Mac', how: 'Chrome / Edge → install icon, or Safari → File → Add to Dock' },
];
