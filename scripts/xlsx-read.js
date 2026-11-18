const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function columnIndex(cellRef) {
  const letters = String(cellRef || '').replace(/[0-9]/g, '');
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index;
}

function rowNumber(cellRef) {
  return Number(String(cellRef || '').replace(/[A-Z]/gi, '')) || 0;
}

function textOf(node) {
  const parts = [];
  const walk = (current) => {
    if (!current) return;
    if (current.name === 't' && current.text) parts.push(current.text);
    (current.children || []).forEach(walk);
  };
  // xml2js-free: use regex extraction below instead
  return parts.join('');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml) {
  const strings = [];
  const items = xml.split(/<si[\s>]/).slice(1);
  for (const item of items) {
    const chunk = item.split('</si>')[0];
    const texts = [];
    const pattern = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let match;
    while ((match = pattern.exec(chunk))) texts.push(decodeXml(match[1]));
    strings.push(texts.join(''));
  }
  return strings;
}

function parseSheet(xml, strings) {
  const rows = new Map();
  // Self-closing cells must be matched first. Otherwise `/>` is treated as `>` and the
  // next real `</c>` swallows the following cells.
  const cellPattern = /<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let match;
  while ((match = cellPattern.exec(xml))) {
    const attrs = match[1] || match[2] || '';
    const body = match[3] || '';
    const ref = (attrs.match(/\br="([^"]+)"/) || [])[1];
    if (!ref) continue;
    const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
    const row = rowNumber(ref);
    const col = columnIndex(ref);
    let value = '';
    if (type === 'inlineStr') {
      const texts = [];
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let inlineMatch;
      while ((inlineMatch = inline.exec(body))) texts.push(decodeXml(inlineMatch[1]));
      value = texts.join('');
    } else {
      const raw = (body.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
      if (raw == null) value = '';
      else if (type === 's') value = strings[Number(raw)] || '';
      else value = decodeXml(raw);
    }
    if (!rows.has(row)) rows.set(row, {});
    rows.get(row)[col] = value;
  }
  return rows;
}

function readXlsx(filePath) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'xlsx-'));
  execFileSync('unzip', ['-qo', filePath, '-d', dir], { stdio: 'ignore' });
  const sharedPath = path.join(dir, 'xl', 'sharedStrings.xml');
  const strings = fs.existsSync(sharedPath) ? parseSharedStrings(fs.readFileSync(sharedPath, 'utf8')) : [];
  const sheetPath = path.join(dir, 'xl', 'worksheets', 'sheet1.xml');
  const rows = parseSheet(fs.readFileSync(sheetPath, 'utf8'), strings);
  fs.rmSync(dir, { recursive: true, force: true });
  return rows;
}

module.exports = { readXlsx, textOf };
