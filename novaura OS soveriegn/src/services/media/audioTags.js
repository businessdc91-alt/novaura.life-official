// audioTags.js — Read title, artist, album and cover art from an audio file's
// ID3v2 tag (MP3). Pure: takes the file's first bytes, no DOM.

const TEXT_FRAMES = {
  TIT2: 'title', TT2: 'title',
  TPE1: 'artist', TP1: 'artist',
  TPE2: 'albumArtist', TP2: 'albumArtist',
  TALB: 'album', TAL: 'album',
  TCON: 'genre', TCO: 'genre',
  TYER: 'year', TDRC: 'year', TYE: 'year',
  TRCK: 'track', TRK: 'track',
};

// Bytes to read from the start of a file: enough for any tag with cover art.
export const TAG_READ_BYTES = 2 * 1024 * 1024;

const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const uint32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

// Undo ID3 unsynchronisation: every 0xFF 0x00 pair was written for a 0xFF.
function resync(bytes) {
  const out = new Uint8Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[n++] = bytes[i];
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

function decodeText(bytes, encoding) {
  if (!bytes.length) return '';
  let label = 'latin1';
  if (encoding === 1) label = 'utf-16'; // with a byte order mark
  else if (encoding === 2) label = 'utf-16be';
  else if (encoding === 3) label = 'utf-8';
  try {
    return new TextDecoder(label).decode(bytes).replace(/\0+$/g, '').split('\0')[0].trim();
  } catch {
    return '';
  }
}

// Where an encoded, null-terminated string ends (UTF-16 ends on a 2-byte null).
function textEnd(bytes, start, encoding) {
  const wide = encoding === 1 || encoding === 2;
  for (let i = start; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i;
  }
  return bytes.length;
}

function readPicture(body, version) {
  const encoding = body[0];
  let p = 1;
  let mime;
  if (version === 2) {
    // v2.2 PIC: a 3-letter image format instead of a MIME type.
    const fmt = String.fromCharCode(body[1], body[2], body[3]).toLowerCase();
    mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    p = 4;
  } else {
    const end = textEnd(body, p, 0);
    mime = decodeText(body.subarray(p, end), 0).toLowerCase() || 'image/jpeg';
    if (!mime.includes('/')) mime = `image/${mime === 'jpg' ? 'jpeg' : mime}`;
    p = end + 1;
  }
  const type = body[p];
  p += 1;
  const descEnd = textEnd(body, p, encoding);
  p = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
  if (p >= body.length) return null;
  return { mime, type, data: body.slice(p) };
}

/**
 * Parse an ID3v2 tag. `bytes` is the start of the file (a Uint8Array).
 * Returns { title, artist, album, albumArtist, genre, year, track, picture } with
 * missing fields left out, or null when the file has no ID3v2 tag.
 */
export function readId3(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null; // "ID3"
  const version = bytes[3];
  if (version < 2 || version > 4) return null;
  const flags = bytes[5];
  const tagSize = syncsafe(bytes, 6);
  let tag = bytes.subarray(10, Math.min(bytes.length, 10 + tagSize));
  if (flags & 0x80 && version < 4) tag = resync(tag);

  let p = 0;
  if (flags & 0x40 && version >= 3) {
    // Skip the extended header.
    const extSize = version === 4 ? syncsafe(tag, 0) : uint32(tag, 0) + 4;
    p = extSize;
  }

  const out = {};
  let bestPicture = null;
  const idLen = version === 2 ? 3 : 4;
  const headLen = version === 2 ? 6 : 10;
  while (p + headLen <= tag.length) {
    const frameId = String.fromCharCode(...tag.subarray(p, p + idLen));
    if (!/^[A-Z0-9]+$/.test(frameId)) break; // padding
    let size;
    if (version === 2) size = (tag[p + 3] << 16) | (tag[p + 4] << 8) | tag[p + 5];
    else if (version === 4) size = syncsafe(tag, p + 4);
    else size = uint32(tag, p + 4);
    const frameFlags = version === 2 ? 0 : tag[p + 9];
    const start = p + headLen;
    p = start + size;
    if (size <= 0 || p > tag.length) break;
    let body = tag.subarray(start, p);
    // v2.4 frames can be unsynchronised on their own, and carry a length prefix.
    if (version === 4 && frameFlags & 0x01) body = body.subarray(4);
    if (version === 4 && frameFlags & 0x02) body = resync(body);
    if (version >= 3 && frameFlags & 0x0c) continue; // compressed or encrypted: skip

    const field = TEXT_FRAMES[frameId];
    if (field && !out[field]) {
      const text = decodeText(body.subarray(1), body[0]);
      if (text) out[field] = text;
    } else if (frameId === 'APIC' || frameId === 'PIC') {
      const pic = readPicture(body, version);
      // Prefer the front cover (type 3), else the first picture.
      if (pic && pic.data.length && (!bestPicture || (pic.type === 3 && bestPicture.type !== 3))) bestPicture = pic;
    }
  }

  if (out.genre) out.genre = out.genre.replace(/^\((\d+)\)$/, '').replace(/^\(\d+\)/, '') || undefined;
  if (!out.genre) delete out.genre;
  if (out.year) out.year = out.year.slice(0, 4);
  if (out.track) out.track = parseInt(out.track, 10) || undefined;
  if (!out.track) delete out.track;
  if (bestPicture) out.picture = { mime: bestPicture.mime, data: bestPicture.data };
  return out;
}

// MPEG audio frame tables: kbps by [MPEG-1 or not][layer number], and sample rates.
const BITRATES = {
  v1: { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448] },
  v2: { 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256] },
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/**
 * Length in seconds of an MP3, found by walking its frames (exact for CBR and
 * VBR). `bytes` is the whole file. Returns 0 when it is not MPEG audio.
 */
export function mp3Duration(bytes) {
  if (!(bytes instanceof Uint8Array)) return 0;
  let p = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) p = 10 + syncsafe(bytes, 6) + (bytes[5] & 0x10 ? 10 : 0);
  let samples = 0;
  let rate = 0;
  let frames = 0;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff || (bytes[p + 1] & 0xe0) !== 0xe0) {
      // Lost sync (junk or a trailing tag): look for the next frame header.
      if (frames > 0 && bytes[p] === 0x54 && bytes[p + 1] === 0x41 && bytes[p + 2] === 0x47) break; // ID3v1 "TAG"
      p++;
      continue;
    }
    const version = (bytes[p + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const layer = 4 - ((bytes[p + 1] >> 1) & 3); // 1, 2 or 3
    const bitrateIdx = bytes[p + 2] >> 4;
    const rateIdx = (bytes[p + 2] >> 2) & 3;
    if (version === 1 || layer === 4 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) { p++; continue; }
    const kbps = BITRATES[version === 3 ? 'v1' : 'v2'][layer][bitrateIdx];
    const sr = RATES[version][rateIdx];
    const padding = (bytes[p + 2] >> 1) & 1;
    const perFrame = layer === 1 ? 384 : layer === 3 && version !== 3 ? 576 : 1152;
    const length = layer === 1 ? (Math.floor((12 * kbps * 1000) / sr) + padding) * 4 : Math.floor(((perFrame / 8) * kbps * 1000) / sr) + padding;
    if (length < 4) { p++; continue; }
    samples += perFrame;
    rate = sr;
    frames++;
    p += length;
  }
  return frames > 0 && rate ? samples / rate : 0;
}

/** "03 - Neon_Petals-Riot (final).mp3" -> "Neon Petals Riot (final)" */
export function titleFromFileName(name) {
  return String(name || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/^\d{1,3}\s*[-.]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}
