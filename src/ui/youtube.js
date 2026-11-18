/** YouTube embed helpers (no three.js dependency, safe to load eagerly). */

export function youtubeEmbedUrl(id, start = 0) {
  const p = new URLSearchParams({
    autoplay: '1', mute: '1', loop: '1', playlist: id, controls: '0', playsinline: '1',
    rel: '0', modestbranding: '1', iv_load_policy: '3', disablekb: '1', fs: '0',
    ...(start ? { start: String(start) } : {}),
    enablejsapi: '1',
    cc_load_policy: '0',
    origin: window.location.origin,
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}

/**
 * Follows a muted preview player's live state via the IFrame API's
 * postMessage protocol (no extra script). `onChange(true)` fires shortly after
 * the video is really playing; `onChange(false)` when it stops playing for more
 * than a moment (ended before looping, buffering, paused by the browser), so
 * the caller can show the thumbnail instead of YouTube's own UI.
 * If the player reports "paused" or "ended", it is nudged to play again.
 */
export function watchYouTube(iframe, onChange) {
  let stopped = false;
  let heard = false;
  let playing = false;
  let pingTimer = 0;
  let flipTimer = 0;
  const send = (func) => iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [], id: 1, channel: 'widget' }), '*');
  const set = (v, delay) => {
    clearTimeout(flipTimer);
    if (v === playing) return;
    flipTimer = setTimeout(() => {
      playing = v;
      onChange(v);
    }, delay);
  };
  const onMsg = (e) => {
    if (stopped || e.source !== iframe.contentWindow) return;
    heard = true;
    let d;
    try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    const state = d?.info?.playerState ?? (d?.event === 'onStateChange' ? d.info : undefined);
    if (state === undefined) return;
    // Reveal ~1.2s after playback (re)starts: YouTube flashes its own controls overlay
    // on (re)start even with controls=0, and it has faded out by then.
    if (state === 1) set(true, 1200);
    else {
      set(false, 350); // brief buffering blips don't flicker
      if (state === 0 || state === 2) send('playVideo');
    }
  };
  window.addEventListener('message', onMsg);
  iframe.addEventListener('load', () => {
    // The player only answers once it's ready: keep saying "listening" until it does.
    let tries = 0;
    const ping = () => {
      if (heard || stopped || tries++ > 20) return;
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
      pingTimer = setTimeout(ping, 400);
    };
    ping();
  });
  return () => {
    stopped = true;
    clearTimeout(pingTimer);
    clearTimeout(flipTimer);
    window.removeEventListener('message', onMsg);
  };
}

/** Back-compat: `cb` once, the first time the player is really playing. */
export function onYouTubePlaying(iframe, cb) {
  let fired = false;
  return watchYouTube(iframe, (p) => {
    if (p && !fired) { fired = true; cb(); }
  });
}
