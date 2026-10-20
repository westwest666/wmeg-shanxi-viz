'use strict';
/* CENI-style big screen · data-driven */
var DATA=null, GEO=null, FIT=null;
var CITY={}, SERIES={}, PROV={};
var state={idx:0,mode:'cases',city:null,playing:false,speed:10,timer:null};
var MAP=null;
var NS='http://www.w3.org/2000/svg';

function $(s){return document.querySelector(s)}
function $$(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
function svgEl(tag,attrs){var e=document.createElementNS(NS,tag);if(attrs)for(var k in attrs)e.setAttribute(k,attrs[k]);return e}
function clamp(v,a,b){return v<a?a:(v>b?b:v)}
function fmt(v,d){if(v===null||v===undefined||isNaN(v))return '—';return Number(v).toFixed(d===undefined?0:d)}
function fmtInt(v){return v===null||v===undefined?'—':String(Math.round(v))}
function weekday(str){var d=new Date(str+'T00:00:00');return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}
function colorScale(v,min,max){
  var t=max>min?clamp((v-min)/(max-min),0,1):0;
  var stops=[[8,34,49],[9,56,76],[14,100,122],[34,172,182],[196,150,68],[255,190,98]];
  var p=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(p)),u=p-i;
  var a=stops[i],b=stops[i+1];
  return 'rgb('+Math.round(a[0]+(b[0]-a[0])*u)+','+Math.round(a[1]+(b[1]-a[1])*u)+','+Math.round(a[2]+(b[2]-a[2])*u)+')';
}
function cityValue(name,i){
  if(state.mode==='precip') return SERIES[name].precip[i];
  if(state.mode==='tavg') return SERIES[name].tavg[i];
  return SERIES[name].casesSmooth[i];
}
function cityValueText(name,i){
  var v=cityValue(name,i);
  if(state.mode==='precip') return fmt(v,1)+' mm';
  if(state.mode==='tavg') return fmt(v,1)+' °C';
  return fmt(v,1)+' 例';
}
function modeName(){return {cases:'7 日平滑病例',precip:'降水量',tavg:'日均气温'}[state.mode]}
function fitScreen(){var s=Math.min(innerWidth/1920,innerHeight/1080);$('#screen').style.transform='scale('+s+')'}
window.addEventListener('resize',fitScreen);

function projectSetup(){
  var coords=[];
  GEO.features.forEach(function(f){
    (function walk(c){
      if(!c)return;
      if(typeof c[0]==='number'){coords.push(c);return}
      for(var i=0;i<c.length;i++)walk(c[i]);
    })(f.geometry.coordinates);
  });
  var minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  coords.forEach(function(c){minx=Math.min(minx,c[0]);maxx=Math.max(maxx,c[0]);miny=Math.min(miny,c[1]);maxy=Math.max(maxy,c[1])});
  var pad=52,W=780,H=610;
  var sc=Math.min((W-pad*2)/(maxx-minx),(H-pad*2)/(maxy-miny));
  var ox=(W-(maxx-minx)*sc)/2,oy=(H-(maxy-miny)*sc)/2;
  MAP={W:W,H:H,project:function(lon,lat){return [ox+(lon-minx)*sc,oy+(maxy-lat)*sc]},bounds:{minx:minx,maxx:maxx,miny:miny,maxy:maxy}};
}
function ringPath(polys){
  var d='';
  polys.forEach(function(poly){
    poly.forEach(function(ring){
      ring.forEach(function(c,idx){var p=MAP.project(c[0],c[1]);d+=(idx?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)});
      d+='Z';
    });
  });
  return d;
}
function buildMap(){
  var svg=$('#map');while(svg.firstChild)svg.removeChild(svg.firstChild);
  var defs=svgEl('defs');
  var grad=svgEl('radialGradient',{id:'mapBg',cx:'50%',cy:'48%',r:'58%'});
  grad.appendChild(svgEl('stop',{offset:'0%','stop-color':'#0a3f5b','stop-opacity':'.38'}));
  grad.appendChild(svgEl('stop',{offset:'100%','stop-color':'#03101d','stop-opacity':'0'}));
  defs.appendChild(grad);
  var glow=svgEl('filter',{id:'nodeGlow',x:'-80%',y:'-80%',width:'260%',height:'260%'});
  var blur=svgEl('feGaussianBlur',{stdDeviation:'3',result:'b'});
  var merge=svgEl('feMerge');merge.appendChild(svgEl('feMergeNode',{in:'b'}));merge.appendChild(svgEl('feMergeNode',{in:'SourceGraphic'}));
  glow.appendChild(blur);glow.appendChild(merge);defs.appendChild(glow);
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect',{x:0,y:0,width:780,height:610,fill:'url(#mapBg)'}));
  // grid rings
  [[150,1],[260,1],[370,1]].forEach(function(r){svg.appendChild(svgEl('circle',{cx:390,cy:300,r:r[0],class:'map-ring'}))});
  // edges
  var gEdges=svgEl('g');
  var seen={};
  DATA.meta.cities.forEach(function(c){
    c.neighbors.forEach(function(n){
      var key=[c.short,n].sort().join('|');
      if(seen[key])return;seen[key]=1;
      var b=CITY[n];if(!b)return;
      var p1=MAP.project(c.lon,c.lat),p2=MAP.project(b.lon,b.lat);
      var d='M'+p1[0]+' '+p1[1]+'L'+p2[0]+' '+p2[1];
      gEdges.appendChild(svgEl('path',{d:d,class:'edge-line'}));
      var flow=svgEl('circle',{r:1.7,class:'edge-flow'});
      var anim=svgEl('animateMotion',{dur:(2.8+Math.random()*2).toFixed(1)+'s',repeatCount:'indefinite',path:d});
      flow.appendChild(anim);gEdges.appendChild(flow);
    });
  });
  svg.appendChild(gEdges);
  // zones
  var gZones=svgEl('g');
  GEO.features.forEach(function(f){
    var name=f.properties.name;
    var d=ringPath(f.geometry.coordinates);
    var p=svgEl('path',{d:d,class:'city-zone','data-name':name,fill:'#0b415a',stroke:'rgba(94,232,255,.72)','stroke-width':'1.25','fill-rule':'evenodd'});
    p.addEventListener('mousemove',function(ev){showTip(ev,name)});
    p.addEventListener('mouseleave',hideTip);
    p.addEventListener('click',function(){selectCity(name)});
    gZones.appendChild(p);
  });
  svg.appendChild(gZones);
  // nodes
  var gNodes=svgEl('g');
  DATA.meta.cities.forEach(function(c){
    var p=MAP.project(c.lon,c.lat);
    var g=svgEl('g',{transform:'translate('+p[0]+','+p[1]+')','data-name':c.name,style:'cursor:pointer'});
    var pulse=svgEl('circle',{r:5,class:'node-pulse'});
    var ring=svgEl('circle',{r:7,class:'node-ring'});
    var core=svgEl('circle',{r:3.4,class:'node-core'});
    var label=svgEl('text',{class:'city-label',x:0,y:-13,'text-anchor':'middle'});
    label.textContent=c.short;
    var val=svgEl('text',{class:'city-val',x:0,y:17,'text-anchor':'middle'});
    val.textContent='';
    g.appendChild(pulse);g.appendChild(ring);g.appendChild(core);g.appendChild(label);g.appendChild(val);
    g.addEventListener('mousemove',function(ev){showTip(ev,c.name)});
    g.addEventListener('mouseleave',hideTip);
    g.addEventListener('click',function(){selectCity(c.name)});
    gNodes.appendChild(g);
  });
  svg.appendChild(gNodes);
  updateMap();
}
function showTip(ev,name){
  var tip=$('#map-tip');var r=$('#screen').getBoundingClientRect();var scale=r.width/1920;
  var i=state.idx;
  tip.innerHTML='<b>'+name+'</b><br>'+modeName()+'：'+cityValueText(name,i)+'<br>日期：'+DATA.meta.dates[i];
  tip.style.display='block';
  var x=(ev.clientX-r.left)/scale+14,y=(ev.clientY-r.top)/scale+14;
  tip.style.left=x+'px';tip.style.top=y+'px';
}
function hideTip(){$('#map-tip').style.display='none'}
function selectCity(name){
  state.city=name;
  updateMap();
  drawForecast();
  var h=$('.p-forecast .panel-h h2'); if(h)h.textContent='模型预测 · '+CITY[name].short;
}
function updateMap(){
  var i=state.idx;
  var vals=DATA.meta.cities.map(function(c){return cityValue(c.name,i)});
  var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
  var topNames=DATA.meta.cities.map(function(c){return {name:c.name,v:cityValue(c.name,i)}}).sort(function(a,b){return b.v-a.v}).slice(0,3).map(function(d){return d.name});
  $$('#map .city-zone').forEach(function(p){
    var name=p.getAttribute('data-name');var v=cityValue(name,i);
    p.setAttribute('fill',colorScale(v,min,max));
    p.setAttribute('fill-opacity',state.city&&state.city!==name?'.42':'.62');
    p.setAttribute('stroke',state.city===name?'#eaffff':'rgba(94,232,255,.72)');
    p.setAttribute('stroke-width',state.city===name?'2':'1.25');
  });
  $$('#map g[data-name]').forEach(function(g){
    var name=g.getAttribute('data-name');var v=cityValue(name,i);
    var val=g.querySelector('.city-val');if(val)val.textContent=(topNames.indexOf(name)>=0||state.city===name)?cityValueText(name,i):'';
    var core=g.querySelector('.node-core');var ring=g.querySelector('.node-ring');
    var rad=3.2+Math.sqrt(Math.max(0,v)/(max||1))*5.4;
    if(core)core.setAttribute('r',rad.toFixed(2));
    if(ring)ring.setAttribute('r',(rad+3.6).toFixed(2));
    if(state.city===name){g.style.filter='drop-shadow(0 0 10px #bffaff)'}else{g.style.filter=''}
  });
  $('#map-date').textContent=DATA.meta.dates[i];
  var lg=$('#map-legend');
  lg.innerHTML='<span>'+modeName()+'</span><i class="bar"></i><span>'+fmt(min,1)+' — '+fmt(max,1)+'</span>';
}
function drawRanking(){
  var i=state.idx;
  var arr=DATA.meta.cities.map(function(c){return {name:c.name,short:c.short,v:SERIES[c.name].casesSmooth[i]||0}}).sort(function(a,b){return b.v-a.v});
  var max=arr[0].v||1;
  var box=$('#rank');
  box.innerHTML=arr.map(function(d,idx){
    var w=clamp(d.v/max*100,2,100);
    return '<div class="rank-row '+(idx<3?'hot ':'')+(state.city===d.name?'sel':'')+'" data-name="'+d.name+'">'+
      '<span class="rk">'+String(idx+1).padStart(2,'0')+'</span><span class="nm">'+d.short+'</span>'+
      '<span class="bar"><i style="width:'+w+'%"></i></span><span class="vl">'+fmt(d.v,1)+'</span></div>';
  }).join('');
  $$('#rank .rank-row').forEach(function(r){r.addEventListener('click',function(){selectCity(r.getAttribute('data-name'))})});
}
function updateMetrics(){
  var i=state.idx;
  var total=PROV.casesSmoothSum[i]||0;
  var prev=PROV.casesSmoothSum[Math.max(0,i-7)]||0;
  var delta=total-prev;
  $('#m-total').textContent=fmt(total,0);
  var arr=DATA.meta.cities.map(function(c){return {name:c.name,short:c.short,v:SERIES[c.name].casesSmooth[i]||0}}).sort(function(a,b){return b.v-a.v});
  $('#m-topcity').textContent=arr[0].short;
  $('#m-topval').textContent=fmt(arr[0].v,1)+' 例';
  var dEl=$('#m-delta');dEl.textContent=(delta>=0?'+':'')+fmt(delta,1);dEl.className=delta>=0?'pos':'neg';
  $('#m-rmse').textContent='2.0125';
  $('#map-date').textContent=DATA.meta.dates[i];
  $('#tl-date').textContent=DATA.meta.dates[i];
  $('#tl-week').textContent=weekday(DATA.meta.dates[i]);
  $('#date').textContent=DATA.meta.dates[i];
  // weather
  var ta=0,rh=0,pmax=0,n=0;
  DATA.meta.cities.forEach(function(c){var s=SERIES[c.name];ta+=s.tavg[i]||0;rh+=s.rh[i]||0;pmax=Math.max(pmax,s.precip[i]||0);n++});
  $('#w-tavg').textContent=fmt(ta/n,1)+' °C';
  $('#w-precip').textContent=fmt(pmax,1)+' mm';
  $('#w-rh').textContent=fmt(rh/n,0)+' %';
  var top3=arr.slice(0,3).map(function(d){return d.short}).join(' / ');
  $('#brief-title').textContent='当前高位城市：'+top3;
  $('#brief-text').textContent=DATA.meta.dates[i]+' 全省 7 日平滑病例合计 '+fmt(total,0)+' 例，较 7 日前 '+(delta>=0?'+':'')+fmt(delta,1)+' 例。模型输入窗口 W=20 天，输出 H=12 天；长步长误差随预测步长增长。';
  $('#weather-note').textContent='全省 '+n+' 城平均气温 '+fmt(ta/n,1)+' °C；最大降水 '+fmt(pmax,1)+' mm。气象只使用与病例同期的历史观测。';
}
function sparkline(box,vals,color,fill){
  var w=360,h=54,pad=2;var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
  var n=vals.length;var pts=vals.map(function(v,i){var x=pad+i/(n-1)*(w-pad*2);var y=h-pad-(v-min)/(max-min||1)*(h-pad*2);return [x,y]});
  var d=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('');
  var area=d+'L'+(w-pad)+' '+(h-pad)+'L'+pad+' '+(h-pad)+'Z';
  box.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path d="'+area+'" fill="'+fill+'"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.5"/></svg>';
}
function drawWeatherSpark(){
  var i=state.idx,start=Math.max(0,i-90),vals=[];
  for(var k=start;k<=i;k++){var s=0;DATA.meta.cities.forEach(function(c){s+=SERIES[c.name].tavg[k]||0});vals.push(s/11)}
  sparkline($('#weather-spark'),vals,'#42d7ff','rgba(66,215,255,.10)');
  // province spark
  var all=PROV.casesSmoothSum;var step=Math.max(1,Math.floor(all.length/300));var arr=[];
  for(var j=0;j<all.length;j+=step)arr.push(all[j]);
  var idx2=Math.floor(i/step);
  var w=780,h=48;var min=Math.min.apply(null,arr),max=Math.max.apply(null,arr);
  var pts=arr.map(function(v,k){return [k/(arr.length-1)*w,h-2-(v-min)/(max-min||1)*(h-6)]});
  var d=pts.map(function(p,k){return (k?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('');
  var area=d+'L'+w+' '+h+'L0 '+h+'Z';
  var x=idx2/(arr.length-1)*w;
  $('#province-spark').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
    '<path d="'+area+'" fill="rgba(66,215,255,.08)"/>'+
    '<path d="'+d+'" fill="none" stroke="rgba(66,215,255,.7)" stroke-width="1.2"/>'+
    '<line x1="'+x+'" x2="'+x+'" y1="0" y2="'+h+'" stroke="#ffd166" stroke-width="1" stroke-dasharray="2 3"/>'+
    '</svg>';
}
function drawForecast(){
  var name=state.city||'太原市';var s=FIT.series[name]||FIT.province;
  var t=s.true||[],p=s.pred||[];
  var start=Math.max(0,t.length-92);var tt=t.slice(start),pp=p.slice(start);
  var w=386,h=158,padL=28,padR=8,padT=8,padB=18;
  var min=Math.min.apply(null,tt.concat(pp)),max=Math.max.apply(null,tt.concat(pp));var span=max-min||1;
  function x(i){return padL+i/(tt.length-1)*(w-padL-padR)}
  function y(v){return padT+(max-v)/span*(h-padT-padB)}
  function line(a){return a.map(function(v,i){return (i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)}).join('')}
  var grid='';
  for(var g=0;g<4;g++){var yy=padT+g/(3)*(h-padT-padB);grid+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+yy+'" y2="'+yy+'" stroke="rgba(66,215,255,.09)"/>'}
  var labels='<text x="4" y="'+(y(max)+3)+'" fill="#507e99" font-size="8">'+fmt(max,1)+'</text><text x="4" y="'+(y(min)+3)+'" fill="#507e99" font-size="8">'+fmt(min,1)+'</text>';
  labels+='<text x="'+(w-padR)+'" y="'+(h-4)+'" fill="#507e99" font-size="8" text-anchor="end">'+FIT.testDates[FIT.testDates.length-1]+'</text>';
  labels+='<text x="'+padL+'" y="'+(h-4)+'" fill="#507e99" font-size="8">'+FIT.testDates[start]+'</text>';
  $('#forecast-chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
    '<defs><linearGradient id="fg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#39e0c5" stop-opacity=".24"/><stop offset="1" stop-color="#39e0c5" stop-opacity="0"/></linearGradient></defs>'+
    grid+labels+
    '<path d="'+line(pp)+'L'+x(pp.length-1)+' '+(h-padB)+'L'+padL+' '+(h-padB)+'Z" fill="url(#fg)"/>'+
    '<path d="'+line(tt)+'" fill="none" stroke="#d9fbff" stroke-width="1.2" stroke-opacity=".7"/>'+
    '<path d="'+line(pp)+'" fill="none" stroke="#39e0c5" stroke-width="1.7"/>'+
    '<circle cx="'+x(pp.length-1)+'" cy="'+y(pp[pp.length-1])+'" r="2.5" fill="#8ffff0"/></svg>';
}
function drawError(){
  var arr=Object.keys(FIT.metrics.cities).map(function(n){return {name:n,short:CITY[n]?CITY[n].short:n,v:FIT.metrics.cities[n].allRmse}}).sort(function(a,b){return b.v-a.v});
  var max=arr[0].v;var w=370,h=186,left=42,top=8,row=15;
  var bars='';
  arr.forEach(function(d,i){
    var y=top+i*row;var bw=(d.v/max)*(w-left-56);
    bars+='<text x="0" y="'+(y+9)+'" fill="#78a9c2" font-size="9">'+d.short+'</text>'+
      '<rect x="'+left+'" y="'+(y+1)+'" width="'+(w-left-70)+'" height="7" fill="rgba(31,89,116,.18)"/>'+
      '<rect x="'+left+'" y="'+(y+1)+'" width="'+bw.toFixed(1)+'" height="7" fill="'+(i<3?'#ffb454':'#28c6df')+'"/>'+
      '<text x="'+(w-4)+'" y="'+(y+9)+'" fill="#c9f3ff" font-size="9" text-anchor="end">'+fmt(d.v,2)+'</text>';
  });
  $('#error-chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+bars+'</svg>';
}
function updateAll(){
  updateMap();drawRanking();updateMetrics();drawWeatherSpark();drawForecast();drawError();
}
function step(dir){
  state.idx=(state.idx+dir+1826)%1826;
  $('#slider').value=state.idx;
  updateAll();
}
function playToggle(){
  state.playing=!state.playing;
  var b=$('#play');b.textContent=state.playing?'❚❚':'▶';
  if(state.timer)clearInterval(state.timer);
  if(state.playing){state.timer=setInterval(function(){step(1)},1000/state.speed)}
}
function boot(){
  fitScreen();
  Promise.all([
    fetch('data/app_data.json').then(function(r){return r.json()}),
    fetch('data/geo.json').then(function(r){return r.json()}),
    fetch('data/fit_data.json').then(function(r){return r.json()})
  ]).then(function(res){
    DATA=res[0];GEO=res[1];FIT=res[2];PROV=DATA.meta.province;
    DATA.meta.cities.forEach(function(c){CITY[c.name]=c;SERIES[c.name]=DATA.series[c.name]});
    var max=-Infinity,idx=0;
    PROV.casesSmoothSum.forEach(function(v,i){if(v>max){max=v;idx=i}});
    state.idx=idx;$('#slider').value=idx;
    projectSetup();buildMap();updateAll();
    var top=DATA.meta.cities.map(function(c){return {name:c.name,v:SERIES[c.name].casesSmooth[idx]||0}}).sort(function(a,b){return b.v-a.v})[0];
    if(top){state.city=top.name;updateMap();drawForecast();var h=$('.p-forecast .panel-h h2');if(h)h.textContent='模型预测 · '+CITY[top.name].short;}
    setInterval(function(){var d=new Date();$('#clock').textContent=d.toTimeString().slice(0,8)},1000);
  }).catch(function(err){console.error(err);document.body.innerHTML='<pre style="color:#f88;padding:30px">数据加载失败：'+err+'</pre>'});
  var slider=$('#slider');
  slider.addEventListener('input',function(){state.idx=+slider.value;updateAll()});
  $('#play').addEventListener('click',playToggle);
  $('#speed').addEventListener('change',function(){state.speed=+this.value;if(state.playing){clearInterval(state.timer);state.timer=setInterval(function(){step(1)},1000/state.speed)}});
  $$('#map-tabs button').forEach(function(b){b.addEventListener('click',function(){$$('#map-tabs button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');state.mode=b.getAttribute('data-mode');updateAll()})});
}
boot();
