/*
 * Lítill CSV-þáttari (RFC 4180): gæsalappir, skiltákn og línuskil innan reits.
 * Engin utanaðkomandi pakki; nóg fyrir Staðfangaskrá (um 40 MB).
 */
'use strict';

/* Ágiskar skiltákn út frá fyrstu línu: það sem kemur oftast fyrir utan gæsalappa */
function detectDelimiter(text) {
  var end = text.indexOf('\n');
  var first = end === -1 ? text : text.slice(0, end);
  var best = ',', bestCount = -1;
  [',', ';', '|', '\t'].forEach(function (d) {
    var n = first.split(d).length - 1;
    if (n > bestCount) { best = d; bestCount = n; }
  });
  return best;
}

/* Skilar fylki af línum (hver lína fylki af reitum). Tómar lokalínur eru sleppt. */
function parseCsv(text, delimiter) {
  var rows = [], row = [], field = '', i = 0, n = text.length, inQuotes = false;
  var d = delimiter || detectDelimiter(text);
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < n; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === d) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
  }
  return rows;
}

/* Afkóðar bæti: UTF-8 (með eða án BOM), annars windows-1252 */
function decode(buffer) {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'utf-8' };
  } catch (e) {
    return { text: new TextDecoder('windows-1252').decode(buffer), encoding: 'windows-1252' };
  }
}

module.exports = { parseCsv: parseCsv, detectDelimiter: detectDelimiter, decode: decode };
