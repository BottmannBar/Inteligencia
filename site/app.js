'use strict';

const $ = (id) => document.getElementById(id);
const formatNumber = new Intl.NumberFormat('pt-BR');
let news = [];

function safeURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function showText(id, value) { $(id).textContent = String(value); }
function setBanner(message, type) {
  const el = $('alert');
  el.textContent = message;
  el.className = `alert ${type}`;
}
function renderPopulations(data) {
  const cities = data.populacao?.municipios || {};
  const c = cities['4106902'];
  const s = cities['4125506'];
  const cv = Number(c?.valor);
  const sv = Number(s?.valor);
  if (Number.isFinite(cv) && cv > 0) {
    showText('population-curitiba', formatNumber.format(cv));
    showText('bar-value-curitiba', formatNumber.format(cv));
    showText('year-curitiba', `IBGE · estimativa ${c.ano}`);
  }
  if (Number.isFinite(sv) && sv > 0) {
    showText('population-sjp', formatNumber.format(sv));
    showText('bar-value-sjp', formatNumber.format(sv));
    showText('year-sjp', `IBGE · estimativa ${s.ano}`);
  }
  const max = Math.max(cv || 0, sv || 0);
  if (max > 0) {
    $('bar-curitiba').style.width = `${Math.max(0, (cv || 0) / max * 100).toFixed(1)}%`;
    $('bar-sjp').style.width = `${Math.max(0, (sv || 0) / max * 100).toFixed(1)}%`;
  }
  if (cv > 0 && sv > 0) {
    showText('population-insight', `Curitiba tem aproximadamente ${(cv/sv).toFixed(1).replace('.', ',')} vezes a população estimada de São José dos Pinhais (${c.ano}). Isso descreve o tamanho populacional, não o volume de vendas nem a renda.`);
  }
}
function renderNews(items) {
  news = Array.isArray(items) ? items : [];
  showText('news-count', news.length);
  const sources = [...new Set(news.map(n => n.fonte).filter(Boolean))].sort();
  const sourceFilter = $('news-filter');
  sources.forEach(source => {
    const option = document.createElement('option');
    option.value = source;
    option.textContent = source;
    sourceFilter.append(option);
  });
  updateNewsList();
}
function updateNewsList() {
  const query = $('news-search').value.trim().toLocaleLowerCase('pt-BR');
  const filter = $('news-filter').value;
  const filtered = news.filter(item => (!filter || item.fonte === filter) && (!query || `${item.titulo} ${item.fonte}`.toLocaleLowerCase('pt-BR').includes(query)));
  const list = $('news-list');
  list.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = news.length ? 'Nenhuma manchete corresponde aos filtros.' : 'Nenhuma notícia disponível na última coleta.';
    list.append(empty);
  }
  filtered.forEach(item => {
    const a = document.createElement('a');
    a.className = 'news-item';
    const url = safeURL(item.url);
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    else { a.removeAttribute('href'); }
    const source = document.createElement('span'); source.className = 'news-tag'; source.textContent = (item.fonte || 'RSS').toLocaleUpperCase('pt-BR');
    const title = document.createElement('h3'); title.textContent = item.titulo || 'Sem título';
    const meta = document.createElement('div'); meta.className = 'news-meta';
    meta.textContent = [item.data_publicacao || 'Data não informada', 'Abrir fonte ↗'].join('  ·  ');
    a.append(source, title, meta); list.append(a);
  });
  showText('news-shown', `${filtered.length} manchete(s) exibida(s)`);
}
$('news-search').addEventListener('input', updateNewsList);
$('news-filter').addEventListener('change', updateNewsList);

async function init() {
  try {
    // Lê primeiro o JSON do branch main, para ter dados atualizados mesmo antes
    // de uma nova publicação do GitHub Pages. Sem chave nem credenciais.
    let payload;
    try {
      const remoteURL = 'https://api.github.com/repos/BottmannBar/Inteligencia/contents/site/data/painel.json?ref=main';
      const remote = await fetch(remoteURL, {cache:'no-store', headers:{Accept:'application/vnd.github+json'}});
      if (!remote.ok) throw new Error('API GitHub HTTP ' + remote.status);
      const file = await remote.json();
      if (file.encoding !== 'base64' || !file.content) throw new Error('Formato de dados inválido');
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), letter => letter.charCodeAt(0));
      payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (remoteError) {
      // Fallback: usa o JSON publicado na mesma pasta do site.
      const scriptURL = document.querySelector('script[src*="app.js"]')?.src || document.baseURI;
      const dataURL = new URL('./data/painel.json', scriptURL);
      dataURL.searchParams.set('v', String(Date.now()));
      const response = await fetch(dataURL.toString(), {cache:'no-store'});
      if (!response.ok) throw new Error('Arquivo local HTTP ' + response.status);
      payload = await response.json();
    }
    if (payload.coletado_em) {
      const date = new Date(payload.coletado_em);
      showText('updated-at', Number.isNaN(date.getTime()) ? payload.coletado_em : date.toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo', dateStyle:'short',timeStyle:'short'}));
    }
    renderPopulations(payload);
    renderNews(payload.noticias);
    const available = Number(Boolean(payload.populacao?.municipios && Object.keys(payload.populacao.municipios).length)) + Number(Boolean(payload.noticias?.length));
    showText('sources-count', available);
    const problems = payload.erros || [];
    const status = problems.length ? 'warn' : (available === 2 ? 'ok' : 'warn');
    const message = problems.length
      ? `Dados disponíveis com avisos: ${problems.join(' / ')}.`
      : (available === 2
        ? 'Fontes carregadas. Confira os períodos e a origem de cada indicador.'
        : `Dados parciais: ${available}/2 grupos com resultados. Execute a coleta pelo GitHub Actions.`);
    setBanner(message, status);
    showText('source-status', problems.length ? 'Há fontes indisponíveis' : (available ? 'Dados disponíveis' : 'Aguardando primeira execução'));
  } catch (err) {
    setBanner('Não foi possível carregar data/painel.json. Verifique a publicação do GitHub Pages e a execução do workflow.', 'warn');
    showText('source-status', 'Falha no carregamento');
  }
}
init();
