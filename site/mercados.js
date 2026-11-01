'use strict';
const $ = id => document.getElementById(id);
const ASSETS = {
 fii:[
  {ticker:'MXRF11',symbol:'BMFBOVESPA:MXRF11',name:'Maxi Renda',description:'Fundo imobiliário listado na B3; analise rendimentos, carteira e riscos.'},
  {ticker:'HGLG11',symbol:'BMFBOVESPA:HGLG11',name:'Pátria Log',description:'Fundo imobiliário do segmento logístico.'},
  {ticker:'KNRI11',symbol:'BMFBOVESPA:KNRI11',name:'Kinea Renda',description:'Fundo imobiliário com exposição a imóveis comerciais e logísticos.'},
  {ticker:'XPML11',symbol:'BMFBOVESPA:XPML11',name:'XP Malls',description:'Fundo imobiliário com exposição a shopping centers.'},
  {ticker:'VISC11',symbol:'BMFBOVESPA:VISC11',name:'Vinci Shopping',description:'Fundo imobiliário com foco em shopping centers.'}
 ],
 acao:[
  {ticker:'PETR4',symbol:'BMFBOVESPA:PETR4',name:'Petrobras PN',description:'Acompanhe preços, resultados, dividendos e exposição ao petróleo.'},
  {ticker:'VALE3',symbol:'BMFBOVESPA:VALE3',name:'Vale ON',description:'Sensível a minério de ferro, China e câmbio.'},
  {ticker:'ITUB4',symbol:'BMFBOVESPA:ITUB4',name:'Itaú Unibanco PN',description:'Acompanhe resultado financeiro, crédito e juros.'},
  {ticker:'WEGE3',symbol:'BMFBOVESPA:WEGE3',name:'WEG ON',description:'Indústria e equipamentos, com exposição a exportações.'},
  {ticker:'BBAS3',symbol:'BMFBOVESPA:BBAS3',name:'Banco do Brasil ON',description:'Setor bancário: crédito, resultados e dividendos.'},
  {ticker:'BBDC4',symbol:'BMFBOVESPA:BBDC4',name:'Bradesco PN',description:'Setor bancário: risco de crédito, receitas e provisões.'}
 ],
 commodities:[
  {ticker:'OURO',symbol:'TVC:GOLD',name:'Ouro',description:'Preço de referência internacional do ouro. Observe a moeda e a unidade do gráfico.'},
  {ticker:'PETRÓLEO',symbol:'TVC:USOIL',name:'Petróleo WTI',description:'Preço de referência internacional do petróleo WTI.'},
  {ticker:'PRATA',symbol:'TVC:SILVER',name:'Prata',description:'Referência internacional da prata.'},
  {ticker:'MILHO',symbol:'CBOT:ZC1!',name:'Milho futuro',description:'Contrato futuro contínuo em bolsa internacional; não é preço de balcão local.'},
  {ticker:'SOJA',symbol:'CBOT:ZS1!',name:'Soja futura',description:'Contrato futuro contínuo. Verifique vencimentos e unidade cotada.'}
 ],
 indices:[
  {ticker:'IBOV',symbol:'BMFBOVESPA:IBOV',name:'Índice Ibovespa',description:'Indicador de referência da bolsa brasileira, não um ativo comprado diretamente.'},
  {ticker:'BOVA11',symbol:'BMFBOVESPA:BOVA11',name:'ETF Ibovespa',description:'Fundo de índice negociado na B3.'},
  {ticker:'IVVB11',symbol:'BMFBOVESPA:IVVB11',name:'ETF S&P 500',description:'ETF brasileiro de exposição a bolsa dos EUA e câmbio.'}
 ],
 moedas:[
  {ticker:'USD/BRL',symbol:'FX_IDC:USDBRL',name:'Dólar / real',description:'Preço de mercado fornecido pelo gráfico, diferente da PTAX oficial.'},
  {ticker:'EUR/BRL',symbol:'FX_IDC:EURBRL',name:'Euro / real',description:'Preço de mercado fornecido pelo gráfico, diferente da PTAX oficial.'},
  {ticker:'CNY/BRL',symbol:'FX_IDC:CNYBRL',name:'Yuan / real',description:'Se o par não estiver disponível, use a PTAX do Banco Central acima.'}
 ]
};
let active=ASSETS.fii[0], news=[];
function percent(value){if(!Number.isFinite(value))return '—';return (value>0?'+':'')+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value)+'%'}
function money4(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:4,maximumFractionDigits:4}).format(value)}
function safeURL(value){try{const x=new URL(value);return ['http:','https:'].includes(x.protocol)?x.href:null}catch{return null}}
function selectAsset(asset){
 active=asset;
 $('chart-title').textContent=asset.ticker+' — '+asset.name;
 $('chart-description').textContent=asset.description;
 const url='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(asset.symbol);
 $('chart-link').href=url;
 renderButtons();
 const container=$('tv-chart');
 container.replaceChildren();
 const holder=document.createElement('div');holder.className='tradingview-widget-container';
 const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';
 holder.append(widget);
 const script=document.createElement('script');
 script.type='text/javascript';
 script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
 script.async=true;
 script.textContent=JSON.stringify({
  autosize:true,symbol:asset.symbol,interval:'D',timezone:'America/Sao_Paulo',theme:'dark',style:'1',
  locale:'br',backgroundColor:'#071934',gridColor:'rgba(75,164,239,0.09)',
  hide_top_toolbar:false,hide_legend:false,allow_symbol_change:true,
  save_image:false,calendar:false,hide_volume:false,show_popup_button:true,
  popup_width:'1100',popup_height:'680',support_host:'https://www.tradingview.com',
  withdateranges:true
 });
 holder.append(script);
 container.append(holder);
}
function renderButtons(){
 const list=$('asset-options');list.replaceChildren();
 for(const a of ASSETS[$('asset-class').value]||[]){
  const b=document.createElement('button');b.type='button';b.className='fin-asset-button'+(a.symbol===active.symbol?' active':'');
  const sym=document.createElement('span');sym.textContent=a.ticker;
  const name=document.createElement('small');name.textContent=a.name;
  b.append(sym,name);b.addEventListener('click',()=>selectAsset(a));list.append(b);
 }
}
function searchTicker(){
 const input=$('symbol-input');const raw=input.value.trim().toUpperCase().replace(/\s/g,'');
 if(!raw)return;
 if(!/^[A-Z0-9:^!._-]{2,32}$/.test(raw)){input.setCustomValidity('Digite um ticker válido (letras e números).');input.reportValidity();return}
 input.setCustomValidity('');
 const group=Object.values(ASSETS).flat().find(a=>a.ticker===raw||a.symbol===raw);
 if(group){$('asset-class').value=Object.keys(ASSETS).find(k=>ASSETS[k].some(a=>a.symbol===group.symbol));selectAsset(group);return}
 // Pesquisa livre: código sem prefixo usa B3; prefixo informado é preservado.
 const symbol=raw.includes(':')?raw:'BMFBOVESPA:'+raw;
 selectAsset({ticker:raw,symbol,name:'Código pesquisado',description:'Confira se o código corresponde ao ativo e à bolsa desejados; a disponibilidade depende do TradingView.'});
}
function displayFX(fx, code){
 const card=fx?.[code]||null;
 if(!card||!Number.isFinite(Number(card.venda))||Number(card.venda)<=0)return;
 $('fx-'+code).textContent=money4(Number(card.venda));
 const change=$('fx-change-'+code);
 if(Number.isFinite(Number(card.variacao_pct))&&card.variacao_pct!==null){
  change.textContent=percent(Number(card.variacao_pct))+' vs. fechamento anterior';
  change.className='fx-change '+(card.variacao_pct>0?'up':card.variacao_pct<0?'down':'');
 }else{change.textContent='Variação anterior indisponível';change.className='fx-change'}
 $('fx-date-'+code).textContent='PTAX venda · '+(card.data||'data não informada')+(card.preservado?' · último dado disponível':'');
}
function renderNews(){
 const category=$('news-category').value;
 const term=$('news-search-fin').value.trim().toLocaleLowerCase('pt-BR');
 const filtered=news.filter(n=>(category==='todas'||n.categoria===category)&&(!term||(n.titulo+' '+n.fonte).toLocaleLowerCase('pt-BR').includes(term)));
 const list=$('fin-news-list');list.replaceChildren();
 if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent=news.length?'Nenhuma notícia corresponde à seleção.':'Sem notícias da coleta. Verifique o GitHub Actions.';list.append(p)}
 for(const n of filtered.slice(0,48)){
  const a=document.createElement('a');a.className='fin-news-card';
  const link=safeURL(n.url);if(link){a.href=link;a.target='_blank';a.rel='noopener noreferrer'}
  const type=document.createElement('span');type.className='news-topic';type.textContent=(n.categoria||'MERCADO').toLocaleUpperCase('pt-BR')+' · '+(n.fonte||'RSS');
  const title=document.createElement('strong');title.textContent=n.titulo||'Sem título';
  const date=document.createElement('small');date.textContent=(n.data_publicacao||'Data não informada')+' · Abrir publicação ↗';
  a.append(type,title,date);list.append(a);
 }
 $('fin-news-total').textContent=filtered.length+' notícias exibidas · '+news.length+' no banco';
}
async function loadData(){
 const candidate=['./data/mercados.json','https://raw.githubusercontent.com/BottmannBar/Inteligencia/main/site/data/mercados.json'];
 for(const url of candidate){
  try{
   const r=await fetch(url+(url.includes('?')?'&':'?')+'v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(9000)});
   if(!r.ok)continue;
   const payload=await r.json();
   if(typeof payload!=='object'||!payload)continue;
   for(const code of ['USD','EUR','CNY'])displayFX(payload.cambio,code);
   news=Array.isArray(payload.noticias)?payload.noticias:[];
   if(payload.coletado_em){const d=new Date(payload.coletado_em);if(!Number.isNaN(d.getTime()))$('updated').textContent='Coleta '+d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
   const available=['USD','EUR','CNY'].filter(code=>payload.cambio?.[code]?.venda).length;
   const message=available+' de 3 moedas com PTAX registrada. '+(payload.avisos?.length?'Avisos: '+payload.avisos.join(' · '):'Última data de cada cotação informada no cartão.')+(news.length?' Notícias coletadas: '+news.length+'.':'');
   $('fx-status').textContent=message;
   renderNews();
   return;
  }catch(e){console.warn('Falha em fonte de dados financeiros:',e.message)}
 }
 $('fx-status').textContent='Não foi possível carregar o arquivo de câmbio. Veja as cotações diretamente no site do Banco Central; não há valores presumidos.';
 renderNews();
}
function init(){
 $('asset-class').addEventListener('change',()=>selectAsset(ASSETS[$('asset-class').value][0]));
 $('symbol-go').addEventListener('click',searchTicker);
 $('symbol-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchTicker()}});
 $('news-category').addEventListener('change',renderNews);
 $('news-search-fin').addEventListener('input',renderNews);
 selectAsset(ASSETS.fii[0]);
 renderNews();
 loadData();
}
init();
