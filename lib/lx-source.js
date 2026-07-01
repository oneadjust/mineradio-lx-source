const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const path = require('path');
const vm = require('vm');

const DEFAULT_SOURCE_FILE = process.env.MINERADIO_LX_SOURCE_FILE || path.join(__dirname, '..', '.lx-source.js');
const REQUEST_TIMEOUT = 15000;
const LX_QUALITY_MAP = {
  standard: '128k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jymaster: 'flac24bit',
};

function normalizeQuality(value) {
  value = String(value || '').toLowerCase();
  return LX_QUALITY_MAP[value] || value || '320k';
}

function normalizeSupportedQuality(sourceInfo, quality) {
  const requested = normalizeQuality(quality);
  const list = sourceInfo && (sourceInfo.qualitys || sourceInfo.qualities || sourceInfo.quality) || [];
  const supported = Array.isArray(list) ? list.map(q => String(q || '').toLowerCase()).filter(Boolean) : [];
  if (!supported.length || supported.includes(requested)) return requested;
  const preferred = ['flac24bit', 'flac', '320k', '128k'];
  for (const item of preferred) {
    if (supported.includes(item)) return item;
  }
  return supported[0] || requested;
}

function providerToLxSource(song) {
  const provider = String(song && (song.provider || song.source || song.type) || '').toLowerCase();
  if (provider === 'lx') return providerToLxSource({ provider: song && (song.lxSource || song.source || song.type) });
  if (provider === 'netease' || provider === 'wy' || provider === '163') return 'wy';
  if (provider === 'qq' || provider === 'tx') return 'tx';
  if (provider === 'kuwo' || provider === 'kw') return 'kw';
  if (provider === 'kugou' || provider === 'kg') return 'kg';
  if (provider === 'migu' || provider === 'mg') return 'mg';
  return provider || 'wy';
}

function formatInterval(song) {
  let seconds = Number(song && (song.duration || song.interval || song.dt)) || 0;
  if (seconds > 10000) seconds = Math.round(seconds / 1000);
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.round(seconds - m * 60));
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toOldMusicInfo(song, overrideSource) {
  song = song || {};
  const source = overrideSource || providerToLxSource(song);
  const mid = song.songmid || song.mid || song.mediaMid || song.media_mid || song.id || song.qqId || '';
  return {
    name: song.name || song.title || '',
    singer: song.artist || song.singer || song.artists || '',
    source,
    songmid: String(mid || ''),
    albumName: song.album || song.albumName || '',
    interval: typeof song.interval === 'string' ? song.interval : formatInterval(song),
    img: song.cover || song.picUrl || song.img || song.albumCover || '',
    lrc: null,
    otherSource: null,
    types: [],
    _types: {},
    typeUrl: {},
  };
}

function requestText(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = /^https:/i.test(targetUrl);
    const client = isHttps ? https : http;
    const req = client.request(targetUrl, {
      method: options.method || 'GET',
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      }, options.headers || {}),
      timeout: options.timeout || REQUEST_TIMEOUT,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString(options.encoding || 'utf8'),
        raw: Buffer.concat(chunks),
      }));
    });
    req.on('timeout', () => {
      req.destroy(new Error('LX_REQUEST_TIMEOUT'));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function lxRequest(targetUrl, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  const promise = requestText(targetUrl, options).then(resp => {
    let body = resp.body;
    if (options.format !== 'text') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    const result = {
      statusCode: resp.statusCode,
      headers: resp.headers,
      body,
      raw: resp.raw,
    };
    if (typeof callback === 'function') callback(null, result, body);
    return result;
  }).catch(err => {
    if (typeof callback === 'function') callback(err);
    throw err;
  });
  return {
    promise,
    cancelHttp() {},
  };
}

function md5(value) {
  return crypto.createHash('md5').update(String(value || '')).digest('hex');
}

function safeSetTimeout(fn, delay, ...args) {
  return setTimeout(() => {
    try {
      if (typeof fn === 'function') fn(...args);
    } catch (err) {
      console.warn('[LXSourceTimer]', err && err.message || err);
    }
  }, delay);
}

function similarity(a, b) {
  a = String(a || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
  b = String(b || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 70;
  let score = 0;
  for (const ch of new Set(a)) if (b.includes(ch)) score++;
  return Math.round(score / Math.max(a.length, b.length) * 60);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeKuwoImageUrl(value, kind = 'album') {
  value = decodeHtml(value).trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
  value = value.replace(/^\/+/, '');
  if (!value) return '';
  if (value.includes('/')) {
    const base = kind === 'artist'
      ? 'https://img1.kuwo.cn/star/starheads/'
      : (kind === 'mv' ? 'https://img1.kuwo.cn/wmvpic/' : 'https://img1.kuwo.cn/star/albumcover/');
    return base + value;
  }
  return '';
}

function mapKuwoResult(info) {
  const songId = String(info.MUSICRID || '').replace('MUSIC_', '') || String(info.DC_TARGETID || info.SONGID || '');
  const types = [];
  const _types = {};
  String(info.N_MINFO || '').split(';').forEach(part => {
    const m = part.match(/level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/);
    if (!m) return;
    const byRate = { 4000: 'flac24bit', 2000: 'flac', 320: '320k', 128: '128k' }[m[2]];
    if (!byRate) return;
    types.push({ type: byRate, size: String(m[4] || '').toUpperCase() });
    _types[byRate] = { size: String(m[4] || '').toUpperCase() };
  });
  const duration = Number(info.DURATION) || 0;
  const interval = duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '';
  const cover = normalizeKuwoImageUrl(info.web_albumpic_short || info.HTS_ALBUMPIC || info.hts_ALBUMPIC || '', 'album');
  const artistPic = normalizeKuwoImageUrl(info.web_artistpic_short || '', 'artist');
  const mvPic = normalizeKuwoImageUrl(info.hts_MVPIC || info.MVPIC || '', 'mv');
  return {
    name: decodeHtml(info.SONGNAME),
    singer: decodeHtml(info.ARTIST),
    artist: decodeHtml(info.ARTIST),
    source: 'kw',
    provider: 'lx',
    songmid: songId,
    id: songId,
    albumName: decodeHtml(info.ALBUM || ''),
    album: decodeHtml(info.ALBUM || ''),
    cover,
    picUrl: cover,
    img: cover,
    artistPic,
    mvPic,
    interval,
    duration,
    types,
    _types,
    raw: info,
  };
}

async function searchKuwo(keywords, limit = 20) {
  const u = new URL('http://search.kuwo.cn/r.s');
  u.searchParams.set('client', 'kt');
  u.searchParams.set('all', keywords);
  u.searchParams.set('pn', '0');
  u.searchParams.set('rn', String(Math.max(1, Math.min(60, Number(limit) || 20))));
  u.searchParams.set('uid', '794762570');
  u.searchParams.set('ver', 'kwplayer_ar_9.2.2.1');
  u.searchParams.set('vipver', '1');
  u.searchParams.set('show_copyright_off', '1');
  u.searchParams.set('newver', '1');
  u.searchParams.set('ft', 'music');
  u.searchParams.set('cluster', '0');
  u.searchParams.set('strategy', '2012');
  u.searchParams.set('encoding', 'utf8');
  u.searchParams.set('rformat', 'json');
  u.searchParams.set('vermerge', '1');
  u.searchParams.set('mobi', '1');
  u.searchParams.set('issubtitle', '1');
  const resp = await requestText(u.toString(), { timeout: REQUEST_TIMEOUT });
  let body = {};
  try { body = JSON.parse(resp.body); } catch (e) {
    throw new Error('LX_KW_SEARCH_INVALID_JSON');
  }
  const list = Array.isArray(body.abslist) ? body.abslist.map(mapKuwoResult).filter(s => s.name && s.songmid) : [];
  return {
    source: 'kw',
    list,
    total: Number(body.TOTAL) || list.length,
    allPage: Math.max(1, Math.ceil((Number(body.TOTAL) || list.length) / Math.max(1, Number(limit) || 20))),
    limit,
  };
}

class LxSourceManager {
  constructor(filePath = DEFAULT_SOURCE_FILE) {
    this.filePath = filePath;
    this.scriptText = '';
    this.handlers = new Map();
    this.sources = {};
    this.status = false;
    this.error = '';
    this.loadedAt = 0;
    this.loadFromDisk();
  }

  loadFromDisk() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      this.loadScript(fs.readFileSync(this.filePath, 'utf8'), { persist: false });
    } catch (err) {
      this.error = err.message || String(err);
      this.status = false;
    }
  }

  loadScript(scriptText, opts = {}) {
    this.clear({ persist: false });
    this.scriptText = String(scriptText || '');
    if (!this.scriptText.trim()) throw new Error('LX_SOURCE_EMPTY');

    const handlers = this.handlers;
    const manager = this;
    const lx = {
      version: '2.0.0',
      env: 'desktop',
      currentScriptInfo: {
        name: 'Mineradio LX Source',
        version: '1',
        tag: 'mineradio',
        rawScript: this.scriptText,
      },
      utils: {
        crypto: {
          md5,
        },
        buffer: {
          from: Buffer.from.bind(Buffer),
          bufToString(buf, encoding) {
            return Buffer.from(buf).toString(encoding || 'utf8');
          },
          stringToBuf(str, encoding) {
            return Buffer.from(String(str || ''), encoding || 'utf8');
          },
        },
      },
      EVENT_NAMES: {
        inited: 'inited',
        request: 'request',
        updateAlert: 'updateAlert',
      },
      request: lxRequest,
      on(name, handler) {
        if (typeof handler !== 'function') return;
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(handler);
      },
      send(name, data) {
        if (name === 'inited') {
          manager.status = !!(data && (data.status !== false) && data.sources);
          manager.sources = data && data.sources || {};
          manager.error = manager.status ? '' : (data && data.error || 'LX_SOURCE_INIT_FAILED');
          manager.loadedAt = Date.now();
        }
      },
    };
    const sandbox = {
      window: { lx },
      lx,
      console,
      Buffer,
      setTimeout: safeSetTimeout,
      clearTimeout,
      Promise,
      URL,
      URLSearchParams,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(this.scriptText, sandbox, { timeout: 5000, filename: 'lx-user-source.js' });
    if (!this.status && !handlers.has('request')) {
      throw new Error(this.error || 'LX_SOURCE_NOT_INITED');
    }
    if (opts.persist !== false) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, this.scriptText, 'utf8');
    }
    return this.getStatus();
  }

  waitForInit(timeoutMs = 8000) {
    if (this.status && this.handlers.has('request')) return Promise.resolve(this.getStatus());
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if ((this.status && this.handlers.has('request')) || Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve(this.getStatus());
        }
      }, 120);
    });
  }

  clear(opts = {}) {
    this.handlers.clear();
    this.sources = {};
    this.status = false;
    this.error = '';
    this.loadedAt = 0;
    if (opts.persist !== false && this.filePath && fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  getStatus() {
    return {
      ok: true,
      hasCustomSource: !!this.scriptText && this.status && this.handlers.has('request'),
      status: this.status,
      sources: this.sources,
      supportedSources: Object.keys(this.sources || {}),
      sourceFile: this.filePath,
      loadedAt: this.loadedAt,
      error: this.error,
    };
  }

  async requestMusicUrl(source, musicInfo, quality) {
    const requestHandlers = this.handlers.get('request') || [];
    if (!this.status || !requestHandlers.length) throw new Error('LX_SOURCE_NOT_READY');
    const sourceInfo = this.sources && this.sources[source];
    const info = {
      type: normalizeSupportedQuality(sourceInfo, quality),
      musicInfo,
    };
    let lastError = null;
    for (const handler of requestHandlers) {
      try {
        const result = await Promise.race([
          Promise.resolve(handler({ source, action: 'musicUrl', info })),
          new Promise((_, reject) => setTimeout(() => reject(new Error('LX_SOURCE_TIMEOUT')), REQUEST_TIMEOUT)),
        ]);
        const url = typeof result === 'string' ? result : (result && (result.url || result.data && result.data.url));
        if (url) return {
          url,
          type: result && (result.type || result.quality) || info.type,
          raw: result,
        };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('LX_SOURCE_EMPTY_URL');
  }
}

function scoreCandidate(target, candidate) {
  const targetName = target.name || target.title || '';
  const targetArtist = target.artist || target.singer || '';
  const targetAlbum = target.album || target.albumName || '';
  let score = similarity(targetName, candidate.name) + similarity(targetArtist, candidate.artist || candidate.singer);
  if (targetAlbum && candidate.albumName) score += Math.round(similarity(targetAlbum, candidate.albumName) / 3);
  const normalizeDuration = value => {
    const n = Number(value) || 0;
    return n > 10000 ? Math.round(n / 1000) : Math.round(n);
  };
  const a = normalizeDuration(target.duration);
  const b = normalizeDuration(candidate.duration);
  if (a && b && Math.abs(a - b) <= 5) score += 30;
  return score;
}

async function resolveWithLx(manager, song, quality) {
  const directSource = providerToLxSource(song);
  const directInfo = toOldMusicInfo(song, directSource);
  const errors = [];
  const restrictedByOriginalProvider = Number(song && song.fee) > 0 ||
    !!(song && (song.trial || song.restriction || song.reason === 'trial_only' || song.reason === 'vip_required'));
  if (!restrictedByOriginalProvider) {
    try {
      const direct = await manager.requestMusicUrl(directSource, directInfo, quality);
      return {
        ok: true,
        url: direct.url,
        playSource: 'lx',
        matchedSource: directSource,
        quality: direct.type,
        lxDirect: true,
        lxMatchedSong: directInfo,
      };
    } catch (err) {
      errors.push({ stage: 'direct', source: directSource, error: err.message || String(err) });
    }
  } else {
    errors.push({ stage: 'direct', source: directSource, error: 'SKIPPED_RESTRICTED_ORIGINAL_SOURCE' });
  }

  const keywords = `${song.name || song.title || ''} ${song.artist || song.singer || ''}`.trim();
  if (!keywords) throw new Error('LX_MATCH_MISSING_KEYWORDS');
  const search = await searchKuwo(keywords, 12);
  const candidates = search.list
    .map(item => ({ item, score: scoreCandidate(song, item) }))
    .filter(x => x.score >= 60)
    .sort((a, b) => b.score - a.score);
  for (const candidate of candidates.slice(0, 4)) {
    const info = toOldMusicInfo(candidate.item, 'kw');
    try {
      const resolved = await manager.requestMusicUrl('kw', info, quality);
      return {
        ok: true,
        url: resolved.url,
        playSource: 'lx',
        matchedSource: 'kw',
        quality: resolved.type,
        lxDirect: false,
        lxMatchScore: candidate.score,
        lxMatchedSong: info,
      };
    } catch (err) {
      errors.push({ stage: 'matched', source: 'kw', score: candidate.score, error: err.message || String(err) });
    }
  }
  const detail = errors.map(e => `${e.stage}:${e.source}:${e.error}`).join('; ');
  const error = new Error(detail || 'LX_SOURCE_EMPTY_URL');
  error.code = 'LX_RESOLVE_FAILED';
  throw error;
}

module.exports = {
  LxSourceManager,
  resolveWithLx,
  searchKuwo,
  toOldMusicInfo,
  normalizeQuality,
};
