// Jednoduché naformátování a zvýraznění HTML bez závislostí (žádné CDN, žádné knihovny).

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function tokenizeHtml(html) {
  const tokens = [];
  const n = html.length;
  let i = 0;

  while (i < n) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ type: 'comment', text: html.slice(i, stop) });
      i = stop;
    } else if (html[i] === '<') {
      const end = html.indexOf('>', i);
      const stop = end === -1 ? n : end + 1;
      const tagText = html.slice(i, stop);
      tokens.push({ type: 'tag', text: tagText });
      i = stop;

      const m = /^<\s*(script|style)\b[^>]*>$/i.exec(tagText);
      if (m) {
        const closeTag = '</' + m[1].toLowerCase();
        const closeIdx = html.toLowerCase().indexOf(closeTag, i);
        const rawEnd = closeIdx === -1 ? n : closeIdx;
        if (rawEnd > i) {
          tokens.push({ type: 'text', text: html.slice(i, rawEnd) });
          i = rawEnd;
        }
      }
    } else {
      const next = html.indexOf('<', i);
      const stop = next === -1 ? n : next;
      tokens.push({ type: 'text', text: html.slice(i, stop) });
      i = stop;
    }
  }

  return tokens;
}

function indentHtml(html) {
  const tokens = tokenizeHtml(html);
  const lines = [];
  let indent = 0;
  const pad = () => '  '.repeat(indent);

  for (const tok of tokens) {
    if (tok.type === 'comment') {
      lines.push(pad() + tok.text.trim());
      continue;
    }
    if (tok.type === 'text') {
      const trimmed = tok.text.trim();
      if (trimmed) lines.push(pad() + trimmed);
      continue;
    }

    const t = tok.text;
    const isClosing = /^<\//.test(t);
    const isDoctype = /^<!DOCTYPE/i.test(t);
    const selfClosing = /\/>\s*$/.test(t);
    const nameMatch = /^<\/?\s*([a-zA-Z0-9:-]+)/.exec(t);
    const tagName = nameMatch ? nameMatch[1].toLowerCase() : '';

    if (isClosing) {
      indent = Math.max(0, indent - 1);
      lines.push(pad() + t);
    } else {
      lines.push(pad() + t);
      if (!isDoctype && !selfClosing && !VOID_ELEMENTS.has(tagName)) {
        indent++;
      }
    }
  }

  return lines.join('\n');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(line) {
  const indentMatch = /^(\s*)/.exec(line);
  const indent = indentMatch[1];
  const content = line.slice(indent.length);

  if (content.startsWith('<!--')) {
    return indent + `<span class="cm">${escapeHtml(content)}</span>`;
  }
  if (/^<!DOCTYPE/i.test(content)) {
    return indent + `<span class="doctype">${escapeHtml(content)}</span>`;
  }
  if (content.startsWith('<')) {
    const m = /^(<\/?)([a-zA-Z0-9:-]+)([\s\S]*?)(\/?>)$/.exec(content);
    if (m) {
      const [, open, name, rest, close] = m;
      const restHtml = escapeHtml(rest).replace(
        /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(=)("[^"]*"|'[^']*')/g,
        '<span class="attr">$1</span><span class="punct">$2</span><span class="val">$3</span>'
      );
      return `${indent}<span class="punct">${escapeHtml(open)}</span><span class="tag">${escapeHtml(name)}</span>${restHtml}<span class="punct">${escapeHtml(close)}</span>`;
    }
    return indent + escapeHtml(content);
  }
  return indent + `<span class="text">${escapeHtml(content)}</span>`;
}

function formatAndHighlightHtml(html) {
  const indented = indentHtml(html);
  return indented.split('\n').map(highlightLine).join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { tokenizeHtml, indentHtml, escapeHtml, highlightLine, formatAndHighlightHtml };
}
