'use strict';
/* CENI-style big screen · data-driven */
var DATA=null, GEO=null, FIT=null, MECH=null, CITY_Q90={};
var CITY={}, SERIES={}, PROV={};
var state={idx:0,mode:'cases',city:null,playing:false,speed:10,timer:null,horizon:1,edges:true,labels:true};
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
function colorDomain(){
  if(state.mode==='cases')return [0,40];
  if(state.mode==='precip')return [0,20];
  return [-10,30];
}
function quantile(arr,q){
  var a=arr.filter(function(v){return v!==null&&v!==undefined&&!isNaN(v)}).slice().sort(function(x,y){return x-y});
  if(!a.length)return 0;var pos=(a.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return a[lo]+(a[hi]-a[lo])*(pos-lo);
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
function fitScreen(){document.body.classList.toggle('compact',innerHeight<960)}
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
  var padX=8,padY=6,W=900,H=760;
  var sc=Math.min((W-padX*2)/(maxx-minx),(H-padY*2)/(maxy-miny));
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
  var disc=svgEl('radialGradient',{id:'discGrad',cx:'50%',cy:'50%',r:'50%'});
  disc.appendChild(svgEl('stop',{offset:'0%','stop-color':'#0b354e','stop-opacity':'.38'}));
  disc.appendChild(svgEl('stop',{offset:'68%','stop-color':'#082539','stop-opacity':'.24'}));
  disc.appendChild(svgEl('stop',{offset:'100%','stop-color':'#03101d','stop-opacity':'0'}));
  defs.appendChild(disc);
  var glow=svgEl('filter',{id:'nodeGlow',x:'-80%',y:'-80%',width:'260%',height:'260%'});
  var blur=svgEl('feGaussianBlur',{stdDeviation:'3',result:'b'});
  var merge=svgEl('feMerge');merge.appendChild(svgEl('feMergeNode',{in:'b'}));merge.appendChild(svgEl('feMergeNode',{in:'SourceGraphic'}));
  glow.appendChild(blur);glow.appendChild(merge);defs.appendChild(glow);
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect',{x:0,y:0,width:900,height:760,fill:'url(#mapBg)'}));
  // circular HUD: rings, ticks, rotating sweep, cardinal annotations
  var gHud=svgEl('g',{class:'hud-rings'});
  gHud.appendChild(svgEl('circle',{cx:450,cy:380,r:370,fill:'url(#discGrad)'}));
  gHud.appendChild(svgEl('circle',{cx:450,cy:380,r:370,fill:'none',stroke:'rgba(66,215,255,.30)','stroke-width':'1.1','stroke-dasharray':'1 9'}));
  [110,205,292,350].forEach(function(r,idx){gHud.appendChild(svgEl('circle',{cx:450,cy:380,r:r,class:'map-ring',opacity:idx===3?'.95':'.55',stroke:idx===3?'rgba(66,215,255,.40)':'rgba(66,215,255,.075)','stroke-width':idx===3?'1.2':'0.8','stroke-dasharray':idx===3?'3 7':'none'}))});
  var spokes=svgEl('g',{stroke:'rgba(66,215,255,.09)','stroke-width':'.7'});
  for(var si=0;si<12;si++){var sa=si/12*Math.PI*2;var sr1=115,sr2=350;spokes.appendChild(svgEl('line',{x1:(450+Math.cos(sa)*sr1).toFixed(1),y1:(380+Math.sin(sa)*sr1).toFixed(1),x2:(450+Math.cos(sa)*sr2).toFixed(1),y2:(380+Math.sin(sa)*sr2).toFixed(1)}))}
  gHud.appendChild(spokes);
  var tick=svgEl('g',{stroke:'rgba(66,215,255,.28)','stroke-width':'.7'});
  for(var ti=0;ti<72;ti++){var ang=ti/72*Math.PI*2;var r1=ti%6===0?340:347;var r2=356;var x1=450+Math.cos(ang)*r1,y1=380+Math.sin(ang)*r1,x2=450+Math.cos(ang)*r2,y2=380+Math.sin(ang)*r2;tick.appendChild(svgEl('line',{x1:x1.toFixed(1),y1:y1.toFixed(1),x2:x2.toFixed(1),y2:y2.toFixed(1)}))}
  gHud.appendChild(tick);
  var sweep=svgEl('g',{opacity:'.5'});
  var wedge=svgEl('path',{d:'M450 380 L450 40 A340 340 0 0 1 678 163 Z',fill:'rgba(66,215,255,.045)',stroke:'rgba(66,215,255,.12)','stroke-width':'.6'});
  sweep.appendChild(wedge);
  var anim=svgEl('animateTransform',{attributeName:'transform',type:'rotate',from:'0 450 380',to:'360 450 380',dur:'26s',repeatCount:'indefinite'});
  sweep.appendChild(anim);gHud.appendChild(sweep);
  function hudText(x,y,t,anchor,size){var tx=svgEl('text',{x:x,y:y,'text-anchor':anchor||'start',fill:'rgba(125,191,214,.62)','font-size':size||'10','letter-spacing':'1.3'});tx.textContent=t;gHud.appendChild(tx)}
  hudText(80,350,'11 CITIES');hudText(80,366,'11 地级市');hudText(820,350,'19 EDGES','end');hudText(820,366,'19 对无向边','end');
  hudText(80,414,'W = 20');hudText(80,430,'输入窗口');hudText(820,414,'H = 12','end');hudText(820,430,'预测步长','end');
  hudText(450,46,'SHANXI · 山西','middle','10');hudText(450,726,'WMEG-Net / SPATIOTEMPORAL FORECAST','middle','8');
  svg.appendChild(gHud);
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
    p.addEventListener('click',function(){selectCity(name,true)});
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
    g.addEventListener('click',function(){selectCity(c.name,true)});
    gNodes.appendChild(g);
  });
  svg.appendChild(gNodes);
  updateMap();
}
function showTip(ev,name){
  var tip=$('#map-tip');var stage=$('.map-stage').getBoundingClientRect();
  var i=state.idx;
  tip.innerHTML='<b>'+name+'</b><br>'+modeName()+'：'+cityValueText(name,i)+'<br>日期：'+DATA.meta.dates[i];
  tip.style.display='block';
  var x=(ev.clientX-stage.left)+14,y=(ev.clientY-stage.top)+14;
  x=Math.max(8,Math.min(x,stage.width-160));y=Math.max(8,Math.min(y,stage.height-62));
  tip.style.left=x+'px';tip.style.top=y+'px';
}
function hideTip(){$('#map-tip').style.display='none'}
function selectCity(name,open){
  state.city=name;
  updateMap();drawForecast();drawHorizon();drawRanking();updateHorizonStat();
  var h=$('.p-forecast .panel-h h2'); if(h)h.textContent='模型预测 · '+CITY[name].short;
  if(open)openDrawer(name); else if($('#city-drawer').classList.contains('open'))drawDrawer();
  updateURL();
}
function updateMap(){
  var i=state.idx;
  var vals=DATA.meta.cities.map(function(c){return cityValue(c.name,i)});
  var dom=colorDomain();var min=dom[0],max=dom[1];
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
  var unit=state.mode==='cases'?' 例':(state.mode==='precip'?' mm':' °C');
  lg.innerHTML='<span>'+modeName()+' · 固定色阶</span><i class="bar"></i><span>'+fmt(min,0)+' — '+fmt(max,0)+unit+'</span>';
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
  $$('#rank .rank-row').forEach(function(r){r.addEventListener('click',function(){selectCity(r.getAttribute('data-name'),true)})});
  var total=arr.reduce(function(s,d){return s+d.v},0)||1;
  var top3=arr.slice(0,3).reduce(function(s,d){return s+d.v},0);
  var pct=Math.round(top3/total*100);
  $('#rank-summary').innerHTML='<div class="rank-donut" style="background:conic-gradient(#3fe0d0 0 '+pct+'%,#1b4b63 '+pct+'% 100%)"><b>'+pct+'%</b></div>'+
    '<div class="rank-sum-txt"><span>TOP 3 SHARE / 集中度</span><b>前 3 城占全省 '+pct+'%<br>'+arr[0].short+'、'+arr[1].short+'、'+arr[2].short+' 为当前高位</b></div>';
}
function updateAlert(){
  if(!DATA)return;
  var i=state.idx;
  var risks=DATA.meta.cities.filter(function(c){var v=SERIES[c.name].casesSmooth[i]||0;return v>=CITY_Q90[c.name]}).map(function(c){return {short:c.short,v:SERIES[c.name].casesSmooth[i]||0}}).sort(function(a,b){return b.v-a.v});
  var chip=$('#alert-chip');if(!chip)return;
  var level=risks.length>=4?'high':(risks.length>=1?'watch':'low');
  chip.className='alert-chip '+level;
  var names=risks.slice(0,3).map(function(x){return x.short}).join(' / ');
  chip.innerHTML='<i></i><span>风险：'+(level==='high'?'高':level==='watch'?'关注':'低')+(risks.length?' · '+risks.length+' 城高于 P90 · '+names:' · 无城市超 P90')+'</span>';
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
  $('#date').textContent='回放 '+DATA.meta.dates[i];
  $('#slider').value=state.idx;
  $('#date-pick').value=DATA.meta.dates[i];
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
  var ci=-1;for(var q=0;q<DATA.meta.cities.length;q++)if(DATA.meta.cities[q].name===name)ci=q;
  var b10=[],b90=[];
  if(MECH&&MECH.fan&&ci>=0){for(var d=start;d<t.length;d++){b10.push(MECH.fan.p10[d][ci]);b90.push(MECH.fan.p90[d][ci])}}
  var all=tt.concat(pp).concat(b10).concat(b90);
  var w=386,h=158,padL=28,padR=8,padT=8,padB=18;
  var min=Math.min.apply(null,all),max=Math.max.apply(null,all);var span=max-min||1;
  function x(i){return padL+i/(tt.length-1)*(w-padL-padR)}
  function y(v){return padT+(max-v)/span*(h-padT-padB)}
  function line(a){return a.map(function(v,i){return (i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)}).join('')}
  function revLine(a){return a.map(function(v,i){return 'L'+x(i).toFixed(1)+' '+y(v).toFixed(1)}).reverse().join('')}
  var band='';
  if(b10.length===tt.length){var bd=line(b10)+revLine(b90)+'Z';band='<path d="'+bd+'" fill="rgba(66,215,255,.10)" stroke="rgba(66,215,255,.22)" stroke-width=".7"/>'}
  var grid='';
  for(var g=0;g<4;g++){var yy=padT+g/(3)*(h-padT-padB);grid+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+yy+'" y2="'+yy+'" stroke="rgba(66,215,255,.09)"/>'}
  var labels='<text x="4" y="'+(y(max)+3)+'" fill="#507e99" font-size="8">'+fmt(max,1)+'</text><text x="4" y="'+(y(min)+3)+'" fill="#507e99" font-size="8">'+fmt(min,1)+'</text>';
  labels+='<text x="'+(w-padR)+'" y="'+(h-4)+'" fill="#507e99" font-size="8" text-anchor="end">'+FIT.testDates[FIT.testDates.length-1]+'</text>';
  labels+='<text x="'+padL+'" y="'+(h-4)+'" fill="#507e99" font-size="8">'+FIT.testDates[start]+'</text>';
  $('#forecast-chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
    '<defs><linearGradient id="fg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#39e0c5" stop-opacity=".24"/><stop offset="1" stop-color="#39e0c5" stop-opacity="0"/></linearGradient></defs>'+
    grid+labels+band+
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
function updateHorizonStat(){
  var name=state.city||'临汾市';
  var m=FIT.metrics.cities[name]||FIT.metrics.cities['临汾市'];
  if(!m){return}
  var h=clamp(state.horizon,1,12),k=h-1;
  var stat=$('#horizon-stat');
  if(stat)stat.textContent='第 '+h+' 步 · RMSE '+fmt(m.rmseH[k],2)+' · MAE '+fmt(m.maeH[k],2)+' · PCC '+fmt(m.pccH[k],2);
  $$('#horizon-select button').forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-h')===h)});
  $$('#horizon-chart .hz-bar').forEach(function(r){r.setAttribute('opacity',+r.getAttribute('data-h')===h?'1':'.42')});
}
function drawHorizon(){
  var name=state.city||'临汾市';
  var m=FIT.metrics.cities[name]||FIT.metrics.cities['临汾市'];
  if(!m||!m.rmseH){$('#horizon-chart').innerHTML='';return}
  var vals=m.rmseH,w=370,h=58,bottom=14,top=6,bw=(w-4)/vals.length-2;
  var max=Math.max.apply(null,vals);
  var bars='';
  vals.forEach(function(v,i){
    var bh=(v/max)*(h-top-bottom);var x=2+i*((w-4)/vals.length);var y=h-bottom-bh;
    var col=state.horizon===i+1?'#7ff2dd':(i<2?'#35e0c8':(i<6?'#28bdda':'#2d8fb0'));
    bars+='<rect class="hz-bar" data-h="'+(i+1)+'" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,bh).toFixed(1)+'" fill="'+col+'" opacity="'+(state.horizon===i+1?'1':'.42')+'"/>';
    if(i===0||i===5||i===11)bars+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(h-3)+'" fill="#5c8ea8" font-size="8" text-anchor="middle">'+(i+1)+'</text>';
  });
  $('#horizon-chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+bars+'</svg>';
  $$('#horizon-chart .hz-bar').forEach(function(r){r.style.cursor='pointer';r.addEventListener('click',function(){state.horizon=+r.getAttribute('data-h');drawHorizon();updateURL();if($('#city-drawer').classList.contains('open'))drawDrawer()})});
  updateHorizonStat();
}
function updateURL(){
  if(!DATA)return;
  var p=new URLSearchParams();
  p.set('date',DATA.meta.dates[state.idx]);p.set('mode',state.mode);
  if(state.city)p.set('city',state.city);
  p.set('horizon',state.horizon);
  history.replaceState(null,'',location.pathname+'?'+p.toString());
}
function updateAll(){
  updateMap();drawRanking();updateMetrics();updateAlert();drawWeatherSpark();drawForecast();drawError();drawHorizon();
  if($('#city-drawer').classList.contains('open'))drawDrawer();
  updateURL();
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
function setMode(mode){
  if(['cases','precip','tavg'].indexOf(mode)<0)return;
  state.mode=mode;
  $$('#map-tabs button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-mode')===mode)});
  updateAll();
}
/* ---------- city drawer ---------- */
function drawerStat(label,value,cls){
  return '<div class="drawer-stat"><span>'+label+'</span><b class="'+(cls||'')+'">'+value+'</b></div>';
}
function drawerChart(values,color,fill,secondary){
  var w=410,h=74,pad=2,n=values.length;var min=Math.min.apply(null,values),max=Math.max.apply(null,values);
  var pts=values.map(function(v,i){return [pad+i/(n-1)*(w-pad*2),h-pad-(v-min)/(max-min||1)*(h-pad*2)]});
  var d=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('');
  var area=d+'L'+(w-pad)+' '+(h-pad)+'L'+pad+' '+(h-pad)+'Z';
  var sec='';
  if(secondary){var min2=Math.min.apply(null,secondary),max2=Math.max.apply(null,secondary);var bw=(w-pad*2)/secondary.length;secondary.forEach(function(v,i){var bh=(v/(max2||1))*(h-8);sec+='<rect x="'+(pad+i*bw).toFixed(1)+'" y="'+(h-pad-bh).toFixed(1)+'" width="'+Math.max(1,bw-1).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="rgba(66,215,255,.28)"/>'})}
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+sec+'<path d="'+area+'" fill="'+fill+'"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.4"/></svg>';
}
function openDrawer(name){
  if(!CITY[name])return;
  state.city=name;
  if(state.playing){state.playing=false;if(state.timer)clearInterval(state.timer);$('#play').textContent='▶'}
  updateMap();drawForecast();drawHorizon();drawRanking();updateHorizonStat();
  drawDrawer();
  $('#drawer-mask').classList.add('on');$('#city-drawer').classList.add('open');$('#city-drawer').setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
  try{$('#drawer-close').focus()}catch(e){}
  updateURL();
}
function closeDrawer(){
  $('#drawer-mask').classList.remove('on');$('#city-drawer').classList.remove('open');$('#city-drawer').setAttribute('aria-hidden','true');
  document.body.classList.remove('drawer-open');
}
function drawDrawer(){
  var name=state.city;if(!name||!CITY[name])return;
  var i=state.idx,s=SERIES[name],c=CITY[name];
  var vals=DATA.meta.cities.map(function(x){return SERIES[x.name].casesSmooth[i]||0});
  var arr=DATA.meta.cities.map(function(x){return {name:x.name,v:SERIES[x.name].casesSmooth[i]||0}}).sort(function(a,b){return b.v-a.v});
  var rank=arr.findIndex(function(x){return x.name===name})+1;
  var d7=(s.casesSmooth[i]||0)-(s.casesSmooth[Math.max(0,i-7)]||0);
  var m=FIT.metrics.cities[name];
  $('#drawer-city').textContent=name;
  $('#drawer-sub').textContent=DATA.meta.dates[i]+' · 全省第 '+rank+' / 11 · '+c.neighbors.length+' 个接壤城市';
  $('#drawer-stats').innerHTML=
    drawerStat('7 日平滑病例',fmt(s.casesSmooth[i],1)+' 例')+
    drawerStat('7 日变化',(d7>=0?'+':'')+fmt(d7,1)+' 例',d7>=0?'up':'down')+
    drawerStat('日均气温',fmt(s.tavg[i],1)+' °C')+
    drawerStat('相对湿度',fmt(s.rh[i],0)+' %')+
    drawerStat('绝对湿度',fmt(s.AH[i],1)+' g/m³')+
    drawerStat('降水量',fmt(s.precip[i],1)+' mm');
  var start=Math.max(0,i-59),raw=[],smooth=[],tavg=[],precip=[];
  for(var k=start;k<=i;k++){raw.push(s.casesRaw[k]||0);smooth.push(s.casesSmooth[k]||0);tavg.push(s.tavg[k]||0);precip.push(s.precip[k]||0)}
  $('#drawer-trend').innerHTML=drawerChart(raw,'rgba(156,190,210,.55)','rgba(156,190,210,.06)',null).replace('</svg>','')+'<path d="'+smooth.reduce(function(acc,v,j){var n=smooth.length;var x=2+j/(n-1)*406;var mn=Math.min.apply(null,smooth),mx=Math.max.apply(null,smooth);var y=74-2-(v-mn)/(mx-mn||1)*70;return acc+(j?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)},'')+'" fill="none" stroke="#42d7ff" stroke-width="1.8"/></svg>';
  $('#drawer-weather-chart').innerHTML=drawerChart(tavg,'#7cebd8','rgba(80,235,210,.10)',precip).replace('</svg>','')+
    '<text x="4" y="10" fill="#5e91ac" font-size="8">气温 °C / 降水柱</text></svg>';
  $('#drawer-metrics').innerHTML=
    '<div class="drawer-metric"><span>全期 RMSE</span><b>'+fmt(m.allRmse,3)+'</b></div>'+
    '<div class="drawer-metric"><span>全期 MAE</span><b>'+fmt(m.allMae,3)+'</b></div>'+
    '<div class="drawer-metric"><span>全期 PCC</span><b>'+fmt(m.allPcc,3)+'</b></div>'+
    '<div class="drawer-metric"><span>第 '+state.horizon+' 步 RMSE</span><b>'+fmt(m.rmseH[state.horizon-1],3)+'</b></div>';
  $('#drawer-neighbors').innerHTML=c.neighbors.map(function(n){return '<button data-name="'+n+'">'+CITY[n].short+'</button>'}).join('');
  $$('#drawer-neighbors button').forEach(function(b){b.addEventListener('click',function(){openDrawer(b.getAttribute('data-name'))})});
  $('#drawer-explore').href='explore.html?date='+DATA.meta.dates[i]+'&city='+encodeURIComponent(name);
}
function downloadCSV(){
  var name=state.city;if(!name)return;var s=SERIES[name];
  var rows=['date,cases_raw,cases_smooth,tavg,rh,AH,precip'];
  DATA.meta.dates.forEach(function(d,i){rows.push([d,s.casesRaw[i],s.casesSmooth[i],s.tavg[i],s.rh[i],s.AH[i],s.precip[i]].join(','))});
  var blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name+'_2015_2019.csv';a.click();URL.revokeObjectURL(a.href);
}
/* ---------- help / fullscreen ---------- */
function openHelp(){$('#help-mask').classList.add('on');$('#help-modal').classList.add('open');$('#help-modal').setAttribute('aria-hidden','false');try{$('#help-close').focus()}catch(e){}}
function closeHelp(){$('#help-mask').classList.remove('on');$('#help-modal').classList.remove('open');$('#help-modal').setAttribute('aria-hidden','true')}
function toggleFull(){if(!document.fullscreenElement){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()}else{document.exitFullscreen&&document.exitFullscreen()}}
/* ---------- boot ---------- */
function boot(){
  fitScreen();
  Promise.all([
    fetch('data/app_data.json').then(function(r){return r.json()}),
    fetch('data/geo.json').then(function(r){return r.json()}),
    fetch('data/fit_data.json').then(function(r){return r.json()}),
    fetch('data/mech_data.json').then(function(r){return r.json()})
  ]).then(function(res){
    DATA=res[0];GEO=res[1];FIT=res[2];MECH=res[3];PROV=DATA.meta.province;
    DATA.meta.cities.forEach(function(c){CITY[c.name]=c;SERIES[c.name]=DATA.series[c.name];CITY_Q90[c.name]=quantile(SERIES[c.name].casesSmooth,0.9)});
    var q=new URLSearchParams(location.search);
    var max=-Infinity,idx=0;PROV.casesSmoothSum.forEach(function(v,i){if(v>max){max=v;idx=i}});
    state.idx=idx;
    if(q.get('date')){var qi=DATA.meta.dates.indexOf(q.get('date'));if(qi>=0)state.idx=qi}
    if(['cases','precip','tavg'].indexOf(q.get('mode'))>=0)state.mode=q.get('mode');
    if(q.get('horizon'))state.horizon=clamp(parseInt(q.get('horizon'),10)||1,1,12);
    state.city=q.get('city')&&CITY[q.get('city')]?q.get('city'):null;
    projectSetup();buildMap();updateAll();
    if(!state.city){var top=DATA.meta.cities.map(function(c){return {name:c.name,v:SERIES[c.name].casesSmooth[state.idx]||0}}).sort(function(a,b){return b.v-a.v})[0];state.city=top.name}
    updateMap();drawForecast();drawHorizon();drawRanking();updateAll();
    var h=$('.p-forecast .panel-h h2');if(h)h.textContent='模型预测 · '+CITY[state.city].short;
    if(q.get('city'))openDrawer(state.city);
    $('#loading').classList.add('hide');
    setInterval(function(){var d=new Date();$('#clock').textContent=d.toTimeString().slice(0,8)},1000);
  }).catch(function(err){console.error(err);var ld=$('#loading');if(ld){ld.innerHTML='<span style="color:#ff8f9e">数据加载失败：'+String(err).slice(0,80)+'</span>'}});
  $('#slider').addEventListener('input',function(){state.idx=+this.value;updateAll()});
  $('#date-pick').addEventListener('change',function(){var i=DATA.meta.dates.indexOf(this.value);if(i>=0){state.idx=i;updateAll()}});
  $('#play').addEventListener('click',playToggle);
  $('#prev').addEventListener('click',function(){step(-1)});
  $('#next').addEventListener('click',function(){step(1)});
  $('#speed').addEventListener('change',function(){state.speed=+this.value;if(state.playing){clearInterval(state.timer);state.timer=setInterval(function(){step(1)},1000/state.speed)}});
  $$('#map-tabs button').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'))})});
  $('#toggle-edges').addEventListener('click',function(){state.edges=!state.edges;this.classList.toggle('on',state.edges);$('#map').classList.toggle('hide-edges',!state.edges)});
  $('#toggle-labels').addEventListener('click',function(){state.labels=!state.labels;this.classList.toggle('on',state.labels);$('#map').classList.toggle('hide-values',!state.labels)});
  $('#horizon-select').addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;state.horizon=+b.getAttribute('data-h');drawHorizon();updateURL();if($('#city-drawer').classList.contains('open'))drawDrawer()});
  $('#btn-help').addEventListener('click',openHelp);$('#help-close').addEventListener('click',closeHelp);$('#help-mask').addEventListener('click',closeHelp);
  $('#btn-full').addEventListener('click',toggleFull);
  $('#drawer-close').addEventListener('click',closeDrawer);$('#drawer-mask').addEventListener('click',closeDrawer);$('#drawer-csv').addEventListener('click',downloadCSV);
  document.addEventListener('keydown',function(ev){
    var tag=(ev.target&&ev.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea')return;
    if(ev.key==='Escape'){closeHelp();closeDrawer();return}
    if(ev.code==='Space'){ev.preventDefault();playToggle();return}
    if(ev.key==='ArrowLeft'){ev.preventDefault();step(-1)}
    if(ev.key==='ArrowRight'){ev.preventDefault();step(1)}
  });
  fitScreen();
}
boot();
