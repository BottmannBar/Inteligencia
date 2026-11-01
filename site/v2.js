'use strict';
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
const number = n => new Intl.NumberFormat('pt-BR').format(n);
const signed = n => (n > 0 ? '+' : '') + Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '%';
const STATES = [['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']];
const UFCODES = {AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17};
const FALLBACK_CITIES = {PR:[['4106902','Curitiba'],['4125506','São José dos Pinhais'],['4119152','Pinhais'],['4105805','Colombo'],['4101804','Araucária'],['4104204','Campo Largo'],['4107652','Fazenda Rio Grande']],SP:[['3550308','São Paulo'],['3509502','Campinas']],RJ:[['3304557','Rio de Janeiro']],SC:[['4205407','Florianópolis'],['4209102','Joinville']],RS:[['4314902','Porto Alegre']],MG:[['3106200','Belo Horizonte']],DF:[['5300108','Brasília']]};
const CITIES_VERIFIED = {
  '4106902':{name:'Curitiba',uf:'PR',population:1832183,year:'2026',gdp:67691.30,gdpYear:'2023',income:3137.92,incomeYear:'2022',incomeScope:'Município · Censo 2022'},
  '4125506':{name:'São José dos Pinhais',uf:'PR',population:353874,year:'2026',gdp:103019.05,gdpYear:'2023'},
  '4119152':{name:'Pinhais',uf:'PR',population:131857,year:'2026',gdp:77567.93,gdpYear:'2023'},
  '4105805':{name:'Colombo',uf:'PR',population:242698,year:'2026',gdp:32853.49,gdpYear:'2023'},
  '4101804':{name:'Araucária',uf:'PR',population:164291,year:'2026',gdp:224671.66,gdpYear:'2023'},
  '4104204':{name:'Campo Largo',uf:'PR',population:146002,year:'2026',gdp:51863.48,gdpYear:'2023'},
  '4107652':{name:'Fazenda Rio Grande',uf:'PR',population:170123,year:'2026',gdp:27805.32,gdpYear:'2023'}
};
const UF_INCOME = {PR:{value:2762,year:'2025',url:'https://www.ibge.gov.br/cidades-e-estados/pr.html'}};
const PMC_URL = 'https://www.gov.br/fazenda/pt-br/central-de-conteudo/publicacoes/conjuntura-economica/atividade-economica/defeso-eleitoral-2026/informativo-pmc-ago2026.html';
const SECTORS = [
 {id:'tecnologia',name:'Celulares e informática',activity:'Equipamentos e materiais para escritório, informática e comunicação',trend:[-1.0,1.1,6.3],mom:6.3,yoy:10.2,y12:8.6,categories:['Celulares','Tecnologia'],query:'celular smartphone informática'},
 {id:'eletrodomesticos',name:'Móveis e eletrodomésticos',activity:'Móveis e eletrodomésticos',trend:[-0.6,-4.2,-4.2],mom:-4.2,yoy:-8.5,y12:3.0,categories:['Eletrodomésticos'],query:'eletrodomésticos móveis'},
 {id:'automotivo',name:'Veículos e peças',activity:'Veículos, motocicletas, partes e peças',trend:[-1.3,0.3,-1.0],mom:-1.0,yoy:1.5,y12:0.9,categories:['Automotivo'],query:'veículos peças'},
 {id:'moda',name:'Moda e calçados',activity:'Tecidos, vestuário e calçados',trend:[-3.4,-3.0,0.6],mom:0.6,yoy:-3.9,y12:-1.8,categories:['Moda'],query:'moda vestuário'},
 {id:'farmacia',name:'Farmácia e cosméticos',activity:'Artigos farmacêuticos, médicos, ortopédicos e perfumaria',trend:[0.4,0.5,0.7],mom:0.7,yoy:4.8,y12:5.3,categories:['Farmácia'],query:'farmacêuticos cosméticos'},
 {id:'alimentacao',name:'Supermercados e alimentos',activity:'Hipermercados, supermercados, produtos alimentícios, bebidas e fumo',trend:[1.0,-0.2,-0.3],mom:-0.3,yoy:0.5,y12:1.0,categories:['Supermercados'],query:'supermercado alimentos'},
 {id:'construcao',name:'Materiais de construção',activity:'Materiais de construção',trend:[-3.2,1.0,-2.0],mom:-2.0,yoy:-3.8,y12:-1.4,categories:['Construção'],query:'material construção'},
 {id:'combustiveis',name:'Combustíveis',activity:'Combustíveis e lubrificantes',trend:[-1.8,0.3,1.1],mom:1.1,yoy:0.8,y12:1.2,categories:['Combustíveis'],query:'combustíveis'},
 {id:'papelaria',name:'Papelaria e livros',activity:'Livros, jornais, revistas e papelaria',trend:[-11.8,-4.2,0.2],mom:0.2,yoy:1.1,y12:2.4,categories:['Papelaria'],query:'livros papelaria'},
 {id:'varejo',name:'Comércio varejista geral',activity:'Comércio varejista (restrito)',trend:[0.3,-0.8,0.1],mom:0.1,yoy:0.4,y12:1.6,categories:['Tecnologia','Celulares','Automotivo','Moda','Farmácia','Supermercados','Construção'],query:'comércio economia'}
];
let snapshot=null, selectedId='4106902', selectedName='Curitiba', cityMetrics={}, citiesLoading=0, fetchToken=0;
const getSector=()=>SECTORS.find(s=>s.id===$('sector').value)||SECTORS[0];
function write(id,v){$(id).textContent=String(v)}
function signClass(v){return v>0?'positive':v<0?'negative':'neutral'}
function safeLink(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
function setNote(msg){write('city-status',msg)}
function initOptions(){
 for(const [uf,name] of STATES){const o=document.createElement('option');o.value=uf;o.textContent=name+' ('+uf+')';$('uf').append(o)} 
 // Remove the initial placeholder option so PR appears once.
 $('uf').querySelector('option[value="PR"]').remove();
 $('uf').value='PR';
 for(const s of SECTORS){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('sector').append(o)}
 $('sector').querySelector('option[value="tecnologia"]').remove();$('sector').value='tecnologia';
}
function fallbackCities(uf){
 const choices=FALLBACK_CITIES[uf]||[];
 return choices.map(([id,nome])=>({id:String(id),nome}));
}
async function loadCities(uf,preferred=''){
 const t=++citiesLoading;
 const previous=preferred||($('city').value||'');
 const options=fallbackCities(uf);
 populateCities(options,previous);
 setNote('Buscando municípios do IBGE…');
 try {
  const response=await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'+UFCODES[uf]+'/municipios',{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('API '+response.status);
  const records=await response.json();
  if(t!==citiesLoading)return;
  const list=records.map(c=>({id:String(c.id),nome:c.nome})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(list.length)populateCities(list,previous);
  setNote(list.length+' municípios encontrados na fonte oficial IBGE.');
 }catch(e){
  if(t!==citiesLoading)return;
  setNote(options.length?'Conexão com a lista completa indisponível; exibindo municípios de referência.':'Não foi possível consultar os municípios desta UF. Tente novamente.');
 }
}
function populateCities(options,preferred){
 const select=$('city');
 select.replaceChildren();
 if(!options.length){const o=document.createElement('option');o.value='';o.textContent='Municípios indisponíveis';select.append(o);select.disabled=true;selectedId='';selectedName='';renderCity();return}
 select.disabled=false;
 for(const city of options){const o=document.createElement('option');o.value=city.id;o.textContent=city.nome;select.append(o)}
 const match=options.some(c=>c.id===preferred)?preferred:options.some(c=>c.id===selectedId)?selectedId:options[0].id;
 select.value=match;
 selectedId=match;
 selectedName=options.find(c=>c.id===match).nome;
 renderCity();
 requestMunicipality(match);
}
function recordFor(id){
 const cached=CITIES_VERIFIED[id]||{};
 const published=snapshot?.populacao?.municipios?.[id];
 const current=cityMetrics[id]||{};
 return {
  population:current.population||Number(published?.valor)||cached.population||null,
  year:current.year||published?.ano||cached.year||null,
  gdp:cached.gdp||null,gdpYear:cached.gdpYear||null,
  income:cached.income||null,incomeYear:cached.incomeYear||null,incomeScope:cached.incomeScope||null
 };
}
function renderCity(){
 const id=selectedId, uf=$('uf').value, rec=recordFor(id);
 write('city-title',selectedName?'Panorama de '+selectedName:'Selecione um município');
 write('kpi-pop',rec.population?number(rec.population):'—');
 write('kpi-pop-sub',rec.population?'IBGE · população estimada '+rec.year:'População municipal indisponível');
 write('kpi-pib',rec.gdp?money(rec.gdp):'—');
 write('kpi-pib-sub',rec.gdp?'IBGE · município '+rec.gdpYear+' · não é renda':'PIB per capita municipal não carregado');
 const income=rec.income?{value:rec.income,year:rec.incomeYear,scope:rec.incomeScope}:UF_INCOME[uf]?{value:UF_INCOME[uf].value,year:UF_INCOME[uf].year,scope:'ESTADO '+uf+' · não municipal'}:null;
 write('kpi-income',income?money(income.value):'—');
 write('kpi-income-sub',income?income.scope+' · '+income.year:'Renda domiciliar não carregada para esta UF');
 write('compare-year','2026 ou referência disponível');
 const slug=selectedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const link=$('city-source');link.href='https://www.ibge.gov.br/cidades-e-estados/'+uf.toLowerCase()+'/'+slug+'.html';
 renderComparison(rec);
}
function renderComparison(rec){
 const chart=$('city-bars');chart.replaceChildren();
 const otherId=selectedId==='4106902'?'4125506':'4106902';
 const cityLabels=[{id:selectedId,name:selectedName,value:rec.population},{id:otherId,name:CITIES_VERIFIED[otherId].name,value:recordFor(otherId).population}];
 const max=Math.max(...cityLabels.map(x=>x.value||0),1);
 for(const c of cityLabels){
  const row=document.createElement('div');row.className='compare-row';
  const label=document.createElement('div');label.className='compare-row-label';
  const l=document.createElement('span');l.textContent=c.name;
  const n=document.createElement('b');n.textContent=c.value?number(c.value):'N/D';
  label.append(l,n);
  const track=document.createElement('div');track.className='track';
  const fill=document.createElement('div');fill.className='fill';fill.style.width=(c.value?c.value/max*100:0).toFixed(1)+'%';
  track.append(fill);row.append(label,track);chart.append(row);
 }
 write('pop-reading',rec.population?'O município selecionado tem '+number(rec.population)+' habitantes na estimativa de '+rec.year+'. Isso mede a escala populacional, mas não o número de compradores de produtos do setor.':'Não foi possível recuperar a população desta cidade. A consulta ao IBGE pode estar temporariamente indisponível.');
}
async function requestMunicipality(id){
 const token=++fetchToken;
 if(!id || recordFor(id).population)return;
 setNote('Consultando estimativa populacional do município…');
 const url='https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6%5B'+encodeURIComponent(id)+'%5D';
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new Error('IBGE '+r.status);
  const data=await r.json();
  const series=data.flatMap(x=>(x.resultados||[]).flatMap(y=>y.series||[])).find(x=>String(x.localidade?.id)===id);
  const values=Object.entries(series?.serie||{}).filter(([year,value])=>/^\d{4}$/.test(year)&&/^\d+$/.test(String(value))).sort((a,b)=>b[0].localeCompare(a[0]));
  if(!values.length)throw new Error('Sem estimativa');
  cityMetrics[id]={population:Number(values[0][1]),year:values[0][0]};
  if(token===fetchToken){renderCity();setNote('Município atualizado pela API oficial do IBGE.')}
 }catch{if(token===fetchToken)setNote('API de população indisponível para este município. Sem estimativas inventadas.')}
}
function renderSector(){
 const s=getSector(), metric=$('comparison').value;
 write('sector-title',s.name);
 const value=s[metric];
 write('kpi-sector',signed(value));
 $('kpi-sector').className=signClass(value);
 write('kpi-sector-sub','PMC · Brasil · '+(metric==='mom'?'ago/jul 2026':metric==='yoy'?'ago 2026/2025':'12 meses até ago/2026'));
 for(const x of ['mom','yoy','y12']){write('sector-'+x,signed(s[x]));$('sector-'+x).className=signClass(s[x]);}
 const chart=$('trend-chart');chart.replaceChildren();
 for(let i=0;i<3;i++){
  const v=s.trend[i];const row=document.createElement('div');row.className='trend-item';
  const name=document.createElement('span');name.textContent=['JUN','JUL','AGO'][i];
  const track=document.createElement('div');track.className='trend-bar';
  const bar=document.createElement('div');bar.className='trend-fill'+(v<0?' down':'');bar.style.width=Math.min(49,Math.abs(v)/12*49)+'%';
  bar.style.left=v>=0?'50%':(50-Math.min(49,Math.abs(v)/12*49))+'%';
  track.append(bar);
  const num=document.createElement('b');num.textContent=signed(v);num.className=signClass(v);
  row.append(name,track,num);chart.append(row);
 }
 write('sector-fact','Em agosto de 2026, '+s.activity.toLowerCase()+' registrou '+signed(s.mom)+' no volume de vendas frente a julho, com ajuste sazonal, e '+signed(s.yoy)+' frente a agosto de 2025.');
 write('sector-hypothesis',s.mom>0?'A alta mensal pode justificar investigar quais produtos ganharam procura. Serão necessários dados de preços, consumidores e concorrência para verificar a oportunidade.':'A queda mensal pode justificar investigar sazonalidade, preços e mudanças de demanda antes de tirar conclusões sobre oportunidades.');
 write('sector-limitation','Esta categoria é medida no Brasil e pode incluir atividades além de '+s.name.toLowerCase()+'. Não indica desempenho de lojas em '+(selectedName||'um município')+'.');
 renderNews();
}
function newsMatches(item,s){return s.categories.some(c=>(item.categoria||'').toLocaleLowerCase('pt-BR')===c.toLocaleLowerCase('pt-BR'))}
function renderNews(){
 const items=Array.isArray(snapshot?.noticias)?snapshot.noticias:[];
 const sector=getSector(),scope=$('news-mode').value,search=$('news-search').value.trim().toLocaleLowerCase('pt-BR');
 const filtered=items.filter(i=>(scope==='todas'||newsMatches(i,sector))&&(!search||(i.titulo+' '+i.fonte).toLocaleLowerCase('pt-BR').includes(search))).slice(0,24);
 const list=$('news-list');list.replaceChildren();
 if(!filtered.length){const div=document.createElement('div');div.className='empty';div.textContent=items.length?'Nenhuma notícia nesta seleção. Escolha “Todas as notícias” ou aguarde a próxima coleta temática.':'Nenhuma notícia disponível. Confira a coleta automática do GitHub Actions.';list.append(div)}
 else for(const item of filtered){
  const card=document.createElement('a');card.className='news-card';const url=safeLink(item.url);if(url){card.href=url;card.target='_blank';card.rel='noopener noreferrer'}else card.removeAttribute('href');
  const source=document.createElement('span');source.textContent=(item.categoria||'RSS').toLocaleUpperCase('pt-BR')+' · '+(item.fonte||'Notícias');
  const title=document.createElement('strong');title.textContent=item.titulo||'Notícia sem título';
  const date=document.createElement('small');date.textContent=(item.data_publicacao||'Data não informada')+' · Ver notícia ↗';
  card.append(source,title,date);list.append(card);
 }
 write('news-count',filtered.length+' notícia(s) exibida(s) · '+items.length+' no banco');
}
async function loadSnapshot(){
 // O conteúdo é público: leitura da branch principal para refletir a coleta mais recente.
 const urls=[
  'https://raw.githubusercontent.com/BottmannBar/Inteligencia/main/site/data/painel.json',
  './site/data/painel.json'
 ];
 for(const url of urls){try{
   const response=await fetch(url+(url.includes('?')?'&':'?')+'v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(data && typeof data==='object')return data;
 }catch{}}
 return null;
}
function setAlert(message){
 const el=$('global-alert');el.hidden=!message;if(message)el.textContent=message;
}
async function init(){
 initOptions();
 $('city').addEventListener('change',()=>{selectedId=$('city').value;selectedName=$('city').selectedOptions[0]?.textContent||'';renderCity();requestMunicipality(selectedId);renderSector()});
 $('uf').addEventListener('change',()=>{selectedId='';selectedName='';loadCities($('uf').value)});
 $('sector').addEventListener('change',renderSector);
 $('comparison').addEventListener('change',renderSector);
 $('news-mode').addEventListener('change',renderNews);
 $('news-search').addEventListener('input',renderNews);
 $('reset').addEventListener('click',()=>{$('uf').value='PR';$('sector').value='tecnologia';$('comparison').value='mom';$('news-mode').value='setor';$('news-search').value='';loadCities('PR','4106902');renderSector()});
 await loadCities('PR','4106902');
 renderSector();
 snapshot=await loadSnapshot();
 if(snapshot?.coletado_em){const d=new Date(snapshot.coletado_em);write('collect-date','Coleta: '+(isNaN(d.getTime())?'data indisponível':d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})));}
 if(snapshot?.erros?.length)setAlert('Aviso de coleta: '+snapshot.erros.join(' · ')+'. Os valores de referência continuam identificados pelo ano.');
 else if(!snapshot)setAlert('Não foi possível carregar o arquivo de notícias e populações. Indicadores de referência seguem disponíveis; dados dinâmicos estão indisponíveis.');
 renderCity();renderNews();
}
init().catch(e=>{setAlert('Falha na inicialização dos filtros: '+e.message);console.error(e)});
