const path = require('node:path').posix;
function remotePath(value = '/') {
  if (typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new Error('Invalid remote path');
  return path.resolve('/', value);
}
function rangeFor(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) throw new Error('Invalid range');
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) throw new Error('Invalid range');
  return { start, end, partial: true };
}
function toVtt(text) { return text.replace(/^\uFEFF/, '').startsWith('WEBVTT') ? text : 'WEBVTT\n\n' + text.replace(/^\uFEFF/, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); }
module.exports = { remotePath, rangeFor, toVtt };
