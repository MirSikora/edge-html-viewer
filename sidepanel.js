const outputEl = document.getElementById('code');
const statusEl = document.getElementById('status');
const autoEl = document.getElementById('auto');

let currentTabId = null;
let currentTabTitle = '';
let currentTabUrl = '';

function setStatus(text) {
  statusEl.textContent = text;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractPageHtml() {
  const doctype = document.doctype
    ? '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') +
      '>'
    : '';

  let html = document.documentElement.outerHTML;
  const headEnd = html.search(/<\/head>/i);
  const headSlice = headEnd === -1 ? html : html.slice(0, headEnd);
  if (!/<base[\s>]/i.test(headSlice)) {
    const baseHref = document.baseURI.replace(/"/g, '&quot;');
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
  }

  return doctype + '\n' + html;
}

async function loadHtmlForTab(tab) {
  if (!tab || !tab.id) {
    outputEl.textContent = '';
    setStatus('Žádná aktivní záložka.');
    return;
  }

  currentTabId = tab.id;
  currentTabTitle = tab.title || '';
  currentTabUrl = tab.url || '';
  setStatus(tab.url || '');

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageHtml
    });
    const html = result && result.result ? result.result : '';
    outputEl.innerHTML = formatAndHighlightHtml(html);
  } catch (err) {
    outputEl.textContent = '';
    setStatus('Na této stránce nelze zdroj zobrazit (interní stránka prohlížeče nebo chráněná stránka).');
  }
}

async function refresh() {
  const tab = await getActiveTab();
  await loadHtmlForTab(tab);
}

document.getElementById('refresh').addEventListener('click', refresh);

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputEl.textContent);
    setStatus('Zkopírováno do schránky.');
  } catch {
    setStatus('Kopírování se nepodařilo.');
  }
});

function suggestFilename() {
  const title = currentTabTitle.trim();
  if (title) {
    const base = title.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100);
    if (base) return base + '.html';
  }
  try {
    const u = new URL(currentTabUrl);
    return (u.hostname || 'stranka').replace(/[^a-z0-9.-]/gi, '_') + '.html';
  } catch {
    return 'stranka.html';
  }
}

document.getElementById('save').addEventListener('click', () => {
  const html = outputEl.textContent;
  if (!html) {
    setStatus('Nic k uložení.');
    return;
  }
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    { url, filename: suggestFilename(), saveAs: true },
    () => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError) {
        setStatus('Uložení se nepodařilo.');
      } else {
        setStatus('Uloženo.');
      }
    }
  );
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (autoEl.checked) {
    chrome.tabs.get(tabId).then(loadHtmlForTab).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (autoEl.checked && changeInfo.status === 'complete' && tabId === currentTabId) {
    loadHtmlForTab(tab);
  }
});

refresh();
