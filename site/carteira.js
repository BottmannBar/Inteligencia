'use strict';
/* Tech-nigma / Minha Carteira.
   Dados pessoais exclusivamente no localStorage do navegador.
   Consulta externa opcional de preços: apenas o ticker (nunca quantidade/preço pago).
*/
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'tech-nigma.carteira.local.v1';
const SANDBOX = new Set(['PETR4','VALE3','ITUB4','MGLU3']);
const TYPES = {acao:'Ação',fii:'FII',etf:'ETF',bdr:'BDR',outros:'Outro'};
const MONEY = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
const NUMBER = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:6});
const PCT = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
let wallet={version:1,trades:[],quotes:{}};
let inMemoryOnly=false;

function note(message, warning=false) {
  const el=$('wallet-notice');
  el.textContent=message;
  el.className='wallet-notice'+(warning?' alert':'');
}
function money(value){return MONEY.format(value)}
function amount(value){return NUMBER.format(value)}
function brNumber(input){
  let s=String(input??'').trim().replace(/\s/g,'');
  if(!s)return NaN;
  // "1.234,56" e "1234,56" são aceitos; sem vírgula o ponto é decimal.
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^[+]?(?:\d+\.?\d*|\.\d+)$/.test(s))return NaN;
  return Number(s);
}
function localDate(){
  const d=new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function validDate(s){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return false;
  const d=new Date(s+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().startsWith(s);
}
function safeTrade(data){
  if(!data||typeof data!=='object')throw Error('Registro de operação inválido.');
  const ticker=String(data.ticker||'').trim().toUpperCase();
  const type=String(data.type||'');
  const kind=String(data.kind||'');
  const qty=Number(data.qty),price=Number(data.price),fee=Number(data.fee);
  const date=String(data.date||'');
  if(!/^[A-Z0-9]{3,14}$/.test(ticker))throw Error('Ticker inválido: use letras e números (ex.: MXRF11).');
  if(!(type in TYPES))throw Error('Tipo de ativo inválido para '+ticker+'.');
  if(!['compra','venda'].includes(kind))throw Error('Tipo de operação inválido.');
  if(!Number.isFinite(qty)||qty<=0||qty>1e10)throw Error('Quantidade inválida.');
  if(!Number.isFinite(price)||price<=0||price>1e10)throw Error('Preço unitário inválido.');
  if(!Number.isFinite(fee)||fee<0||fee>1e9)throw Error('Taxas inválidas.');
  if(!validDate(date))throw Error('Data inválida.');
  return {
    id:typeof data.id==='string'&&data.id.length<90&&data.id.length>0?data.id:createId(),
    ticker,type,kind,qty,price,fee,date,
    created:Number.isFinite(Number(data.created))?Number(data.created):Date.now()
  };
}
function safeQuote(data) {
  if(!data||typeof data!=='object')return null;
  const price=Number(data.price);
  if(!Number.isFinite(price)||price<=0||price>1e12)return null;
  return {
    price,
    source:data.source==='brapi'?'brapi':'manual',
    updated:typeof data.updated==='string'&&!Number.isNaN(Date.parse(data.updated))?data.updated:new Date().toISOString()
  };
}
function createId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return String(Date.now())+'-'+Math.random().toString(36).slice(2);
}
function normalizeWallet(data){
  if(!data||typeof data!=='object')throw Error('O arquivo não contém uma carteira.');
  if(!Array.isArray(data.trades)||data.trades.length>5000)throw Error('Lista de operações inválida.');
  const trades=data.trades.map(safeTrade);
  if(new Set(trades.map(t=>t.id)).size!==trades.length)throw Error('Operações repetidas no backup.');
  calculate(trades); // verifica se alguma venda ultrapassa a posição na data.
  const quotes={};
  if(data.quotes&&typeof data.quotes==='object'&&!Array.isArray(data.quotes)){
    for(const [ticker,raw] of Object.entries(data.quotes)){
      if(/^[A-Z0-9]{3,14}$/.test(ticker)){
        const q=safeQuote(raw);
        if(q)quotes[ticker]=q;
      }
    }
  }
  return {version:1,trades,quotes};
}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)wallet=normalizeWallet(JSON.parse(raw));
  }catch(err){
    inMemoryOnly=true;
    note('Não foi possível ler ou gravar o armazenamento deste navegador. Os dados desta sessão podem se perder. Use Exportar backup.',true);
    console.warn('Armazenamento local indisponível:',err);
  }
}
function save(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(wallet));
    if(!inMemoryOnly)$('save-state').textContent='Salvo no navegador';
    return true;
  }catch(err){
    inMemoryOnly=true;
    $('save-state').textContent='Apenas nesta sessão';
    note('O navegador bloqueou ou esgotou o armazenamento local. Exporte um backup antes de fechar esta página.',true);
    return false;
  }
}
function calculate(trades=wallet.trades){
  const positions=new Map();
  let realized=0;
  const ordered=[...trades].sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created||a.id.localeCompare(b.id));
  for(const t of ordered){
    let p=positions.get(t.ticker);
    if(!p){p={ticker:t.ticker,type:t.type,qty:0,cost:0};positions.set(t.ticker,p)}
    if(p.type!==t.type)throw Error(t.ticker+' foi cadastrado em mais de uma categoria.');
    if(t.kind==='compra'){
      p.cost+=t.qty*t.price+t.fee;
      p.qty+=t.qty;
    }else{
      if(t.qty>p.qty+1e-7)throw Error('Venda de '+t.ticker+' ('+t.date+') maior que a quantidade disponível nesta data.');
      const avg=p.qty?p.cost/p.qty:0;
      realized+=t.qty*t.price-t.fee-t.qty*avg;
      p.qty-=t.qty;
      p.cost-=t.qty*avg;
      if(Math.abs(p.qty)<1e-7){p.qty=0;p.cost=0}
    }
  }
  return {
    positions:[...positions.values()].filter(p=>p.qty>1e-7).sort((a,b)=>a.ticker.localeCompare(b.ticker)),
    realized
  };
}
function node(tag,textContent,cls){
  const el=document.createElement(tag);
  if(textContent!==undefined&&textContent!==null)el.textContent=String(textContent);
  if(cls)el.className=cls;
  return el;
}
function td(content,cls){return node('td',content,cls)}
function addColor(el,value){
  if(value>1e-8)el.classList.add('wallet-gain');
  if(value< -1e-8)el.classList.add('wallet-loss');
}
function dateLabel(s){
  if(!validDate(s))return s;
  const [y,m,d]=s.split('-');return d+'/'+m+'/'+y;
}
function quoteLabel(q){
  if(!q)return 'Não informada';
  let label=q.source==='brapi'?'brapi · atraso ~30 min':'Manual';
  const date=new Date(q.updated);
  if(!Number.isNaN(date.getTime())){
    label+=' · '+date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  return label;
}
function render(){
  const data=calculate();
  renderOverview(data);
  renderPositions(data.positions);
  renderAllocation(data.positions);
  renderHistory();
  refreshPickers(data.positions);
}
function renderOverview({positions,realized}){
  const cost=positions.reduce((sum,p)=>sum+p.cost,0);
  const available=positions.filter(p=>Boolean(wallet.quotes[p.ticker]));
  const allPrices=available.length===positions.length;
  const markedValue=available.reduce((sum,p)=>sum+p.qty*wallet.quotes[p.ticker].price,0);
  const markedCost=available.reduce((sum,p)=>sum+p.cost,0);
  $('total-cost').textContent=money(cost);
  $('realized-pnl').textContent=money(realized);
  addOrRemoveColor($('realized-pnl'),realized);
  $('asset-count').textContent=positions.length+' ativo(s)';
  $('coverage').textContent=available.length+' de '+positions.length+' ativos com cotação';
  if(!positions.length){
    $('total-market').textContent=money(0);
    $('total-pnl').textContent=money(0);
    $('total-return').textContent='Sem posições em aberto';
    return;
  }
  if(allPrices){
    const result=markedValue-cost;
    $('total-market').textContent=money(markedValue);
    $('total-pnl').textContent=money(result);
    $('total-return').textContent=(cost>0?PCT.format(result/cost*100)+'%':'0,00%')+' sobre o custo atual';
    addOrRemoveColor($('total-pnl'),result);
  }else{
    $('total-market').textContent='—';
    $('total-pnl').textContent='—';
    $('total-return').textContent='Faltam '+(positions.length-available.length)+' cotação(ões); sem total parcial enganoso';
    $('total-pnl').classList.remove('wallet-gain','wallet-loss');
  }
}
function addOrRemoveColor(el,value){
  el.classList.remove('wallet-gain','wallet-loss');
  addColor(el,value);
}
function renderPositions(positions){
  const body=$('positions-body');body.replaceChildren();
  if(!positions.length){
    const row=node('tr');const cell=td('Você ainda não cadastrou ativos.','wallet-empty');cell.colSpan=8;row.append(cell);body.append(row);return;
  }
  for(const p of positions){
    const row=node('tr');
    const asset=td('');
    const title=node('div',null,'wallet-asset');
    title.append(node('strong',p.ticker),node('small',TYPES[p.type]));
    asset.append(title);
    row.append(asset,td(amount(p.qty)),td(money(p.cost/p.qty)),td(money(p.cost)));
    const quote=wallet.quotes[p.ticker]||null;
    const col=td('');
    col.append(node('strong',quote?money(quote.price):'—'));
    col.append(node('small',quoteLabel(quote),'wallet-sub'));
    row.append(col);
    const current=quote?p.qty*quote.price:null;
    row.append(td(current===null?'—':money(current)));
    const gain=quote?current-p.cost:null;
    const gainCol=td(gain===null?'—':money(gain));
    if(gain!==null){
      addColor(gainCol,gain);
      gainCol.append(node('small',PCT.format(gain/p.cost*100)+'%','wallet-sub'));
    }
    row.append(gainCol);
    const graph=td('');
    const link=node('a','Gráfico ↗','wallet-mini-link');
    link.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BMFBOVESPA:'+p.ticker);
    link.target='_blank';link.rel='noopener noreferrer';
    graph.append(link);row.append(graph);
    body.append(row);
  }
}
function renderAllocation(positions){
  const root=$('allocation');root.replaceChildren();
  const total=positions.reduce((sum,p)=>sum+p.cost,0);
  if(!positions.length||total<=0){root.append(node('p','Adicione um ativo para visualizar a distribuição.','muted'));return}
  for(const p of [...positions].sort((a,b)=>b.cost-a.cost)){
    const pct=p.cost/total*100;
    const el=node('div',null,'wallet-alloc-row');
    const label=node('div',null,'wallet-alloc-title');
    label.append(node('strong',p.ticker),node('span',PCT.format(pct)+'% · '+money(p.cost)));
    const track=node('div',null,'wallet-alloc-track');
    const fill=node('div',null,'wallet-alloc-fill');
    fill.style.width=Math.min(100,Math.max(0,pct)).toFixed(2)+'%';
    track.append(fill);el.append(label,track);root.append(el);
  }
}
function renderHistory(){
  const body=$('history-body');body.replaceChildren();
  if(!wallet.trades.length){
    const row=node('tr');const cell=td('Nenhuma operação registrada.','wallet-empty');cell.colSpan=8;row.append(cell);body.append(row);return;
  }
  const sorted=[...wallet.trades].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
  for(const t of sorted){
    const row=node('tr');
    row.append(td(dateLabel(t.date)));
    const type=td('');
    type.append(node('span',t.kind==='compra'?'Compra':'Venda','wallet-badge '+(t.kind==='compra'?'buy':'sell')));
    row.append(type,td(t.ticker),td(amount(t.qty)),td(money(t.price)),td(money(t.fee)));
    row.append(td(money(t.qty*t.price+(t.kind==='compra'?t.fee:-t.fee))));
    const del=td('');
    const button=node('button','Excluir','wallet-delete');
    button.type='button';
    button.addEventListener('click',()=>deleteTrade(t.id));
    del.append(button);row.append(del);body.append(row);
  }
}
function refreshPickers(positions){
  const current=$('manual-ticker').value;
  const select=$('manual-ticker');select.replaceChildren();
  const placeholder=node('option','Selecione um ativo');placeholder.value='';select.append(placeholder);
  for(const p of positions){
    const opt=node('option',p.ticker+' · '+TYPES[p.type]);
    opt.value=p.ticker;select.append(opt);
  }
  if(positions.some(p=>p.ticker===current))select.value=current;
  const list=$('ticker-suggestions');list.replaceChildren();
  for(const p of positions){
    const option=node('option');option.value=p.ticker;list.append(option);
  }
}
function addTrade(event){
  event.preventDefault();
  const ticker=$('trade-ticker').value.trim().toUpperCase();
  const trade={
    ticker,
    type:$('trade-type').value,
    kind:$('trade-kind').value,
    qty:brNumber($('trade-qty').value),
    price:brNumber($('trade-price').value),
    fee:brNumber($('trade-fee').value||'0'),
    date:$('trade-date').value,
    created:Date.now(),id:createId()
  };
  try{
    const safe=safeTrade(trade);
    const next=[...wallet.trades,safe];
    calculate(next);
    wallet.trades=next;
    save();render();
    $('trade-ticker').value='';$('trade-qty').value='';$('trade-price').value='';
    $('trade-fee').value='0';
    note('Operação de '+safe.kind+' de '+safe.ticker+' registrada. Posição e preço médio recalculados.');
    if(SANDBOX.has(safe.ticker))refreshPrices(false);
  }catch(err){note(err.message,true)}
}
function deleteTrade(id){
  if(!confirm('Excluir esta operação? O histórico e o preço médio serão recalculados.'))return;
  const next=wallet.trades.filter(t=>t.id!==id);
  try{
    calculate(next);
    wallet.trades=next;
    save();render();note('Operação excluída e carteira recalculada.');
  }catch(err){note('Não é possível excluir esta operação isoladamente: '+err.message,true)}
}
function manualQuote(event){
  event.preventDefault();
  const ticker=$('manual-ticker').value;
  const price=brNumber($('manual-price').value);
  if(!ticker||!calculate().positions.some(p=>p.ticker===ticker)){note('Selecione um ativo existente.',true);return}
  if(!Number.isFinite(price)||price<=0||price>1e12){note('Informe uma cotação positiva válida.',true);return}
  wallet.quotes[ticker]={price,source:'manual',updated:new Date().toISOString()};
  save();render();
  $('manual-ticker').value=ticker;$('manual-price').value='';
  note('Preço de referência manual registrado para '+ticker+'. Ele não é uma cotação em tempo real.');
}
async function fetchSandboxQuote(ticker){
  const url='https://brapi.dev/api/v2/stocks/quote?symbols='+encodeURIComponent(ticker);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8500);
  try{
    const r=await fetch(url,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();
    const result=(data.results||[]).find(x=>x.symbol===ticker||x.requestedSymbol===ticker);
    const price=Number(result?.data?.regularMarketPrice);
    if(!(price>0)||!Number.isFinite(price))throw Error('Cotação não disponível');
    if(result?.data?.currency && result.data.currency!=='BRL')throw Error('Moeda diferente de BRL');
    return {price,source:'brapi',updated:typeof data.requestedAt==='string'?data.requestedAt:new Date().toISOString()};
  }finally{clearTimeout(timeout)}
}
let loadingQuotes=false;
async function refreshPrices(announce=true){
  if(loadingQuotes)return;
  const symbols=calculate().positions.map(p=>p.ticker).filter(t=>SANDBOX.has(t));
  const button=$('refresh-prices');
  if(!symbols.length){
    if(announce)note('Não há ativos com cotação pública automática nesta carteira. Informe o preço de referência manualmente para os tickers cadastrados.');
    return;
  }
  loadingQuotes=true;button.disabled=true;button.textContent='Consultando…';
  const result=await Promise.allSettled(symbols.map(fetchSandboxQuote));
  let count=0;const failed=[];
  for(let i=0;i<symbols.length;i++){
    if(result[i].status==='fulfilled'){wallet.quotes[symbols[i]]=result[i].value;count++}
    else failed.push(symbols[i]);
  }
  loadingQuotes=false;button.disabled=false;button.textContent='↻ Atualizar cotações';
  save();render();
  $('quote-status').textContent='Última consulta: '+new Date().toLocaleString('pt-BR')+'. Atualizadas: '+count+'/'+symbols.length+'. '+(failed.length?'Sem retorno para '+failed.join(', ')+'. ':'')+'A fonte gratuita pode apresentar atraso de cerca de 30 minutos. Outros tickers: preço informado manualmente.';
  if(announce||failed.length)note(count+' cotação(ões) atualizada(s).'+(failed.length?' Não foi possível consultar: '+failed.join(', ')+'. Confira sua conexão e a API da brapi.':'')+(symbols.length<calculate().positions.length?' Alguns ativos precisam de preço manual.':''),Boolean(failed.length));
}
function exportBackup(){
  const exported={schema:'tech-nigma-carteira',version:1,exportedAt:new Date().toISOString(),trades:wallet.trades,quotes:wallet.quotes};
  const blob=new Blob([JSON.stringify(exported,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='tech-nigma-carteira-'+localDate()+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
  note('Backup gerado. Guarde o arquivo em local privado; ele contém suas operações.');
}
async function importBackup(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  if(file.size>3*1024*1024){note('Backup muito grande (limite 3 MB).',true);return}
  try{
    const parsed=JSON.parse(await file.text());
    if(parsed.schema!=='tech-nigma-carteira'||parsed.version!==1)throw Error('Este arquivo não é um backup da Carteira Tech-nigma versão 1.');
    const next=normalizeWallet(parsed);
    if(!confirm('Importar '+next.trades.length+' operações? Isso SUBSTITUIRÁ a carteira existente neste navegador.'))return;
    wallet=next;
    save();render();
    note('Backup importado: '+next.trades.length+' operações. Confira os totais antes de continuar.');
  }catch(err){note('Não foi possível importar o backup: '+err.message,true)}
}
function init(){
  $('trade-date').value=localDate();
  $('trade-form').addEventListener('submit',addTrade);
  $('manual-form').addEventListener('submit',manualQuote);
  $('refresh-prices').addEventListener('click',()=>refreshPrices(true));
  $('export-data').addEventListener('click',exportBackup);
  $('import-data').addEventListener('change',importBackup);
  $('trade-ticker').addEventListener('change',()=>{
    const id=$('trade-ticker').value.trim().toUpperCase();
    const found=calculate().positions.find(p=>p.ticker===id);
    if(found)$('trade-type').value=found.type;
  });
  load();render();
  if(!inMemoryOnly)note('Sua carteira é privada e fica neste navegador. Faça backup JSON regularmente. A cotação automática consulta somente os tickers elegíveis.');
  if(wallet.trades.length)refreshPrices(false);
}
init();
