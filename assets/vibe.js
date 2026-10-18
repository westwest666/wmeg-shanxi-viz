'use strict';
/* VIBE v2 · 一个数字的旅程 · 1920x1080 / 30fps / 2:30
   重点：公式 token 变形、矩阵行→向量→点积→GELU 的连续 morph */
(function () {
  var W = 1920, H = 1080, DUR = 150;
  var cv, ctx, dpr = 1;
  var EX = null, JR = null, APP = null;
  var T = 0, playing = false, lastTs = 0, RECORD = false;
  try { RECORD = /[?&]record=1/.test(location.search); } catch (e) {}
  var C = { bg: '#050510', gold: '#c9a96a', ivory: '#eaeaf2', dim: '#8a8aa0', cyan: '#7fc8d6', red: '#d97a66' };
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function lerp(a,b,t){return a+(b-a)*t;}
  function ease(t){t=clamp(t,0,1);return t*t*(3-2*t);}
  function fmt(v,d){return (v===null||v===undefined||isNaN(v))?'—':Number(v).toFixed(d===undefined?1:d);}
  function serif(s,x,y,size,color,align,italic,weight){
    ctx.font=(italic?'italic ':'')+(weight||400)+' '+size+'px Georgia,"Times New Roman","SimSun",serif';
    ctx.fillStyle=color||C.ivory; ctx.textAlign=align||'center'; ctx.textBaseline='middle'; ctx.fillText(s,x,y);
  }
  function sans(s,x,y,size,color,align,weight){
    ctx.font=(weight||400)+' '+size+'px "Microsoft YaHei","Segoe UI",sans-serif';
    ctx.fillStyle=color||C.ivory; ctx.textAlign=align||'center'; ctx.textBaseline='middle'; ctx.fillText(s,x,y);
  }
  function mono(s,x,y,size,color,align,weight){
    ctx.font=(weight||400)+' '+size+'px Consolas,monospace';
    ctx.fillStyle=color||C.ivory; ctx.textAlign=align||'center'; ctx.textBaseline='middle'; ctx.fillText(s,x,y);
  }
  function spaced(s,x,y,size,color,sp,align){
    ctx.font='400 '+size+'px Georgia,"SimSun",serif'; ctx.fillStyle=color||C.dim; ctx.textBaseline='middle';
    var ws=s.split('').map(function(ch){return ctx.measureText(ch).width;});
    var total=ws.reduce(function(a,b){return a+b;},0)+sp*(s.length-1);
    var cx=align==='left'?x:(align==='right'?x-total:x-total/2); ctx.textAlign='left';
    for(var i=0;i<s.length;i++){ctx.fillText(s[i],cx,y);cx+=ws[i]+sp;}
  }
  function ink(a){ctx.globalAlpha=a;}
  function bg(){
    var g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#050510'); g.addColorStop(.55,'#080818'); g.addColorStop(1,'#0b0b20');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    var v=ctx.createRadialGradient(W/2,H*.45,H*.25,W/2,H*.5,H*.95);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.62)');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
    // 极淡网格，只作质感
    ctx.strokeStyle='rgba(140,150,180,0.03)'; ctx.lineWidth=1;
    for(var x=0;x<=W;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(var y=0;y<=H;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
  function watermark(){
    mono('WMEG-NET',90,40,13,'rgba(138,138,160,.9)','left',600);
    spaced('SHANXI · 11 CITIES',90,60,9,'rgba(138,138,160,.7)',2.4,'left');
    spaced('VIBE 知识大赏',W-90,48,12,'rgba(201,169,106,.8)',3,'right');
  }
  function topLabel(s){
    line(W/2-190,52,W/2-120,52,'rgba(201,169,106,.55)',1);
    spaced(s,W/2,52,13,'rgba(201,169,106,.95)',4.5,'center');
    line(W/2+120,52,W/2+190,52,'rgba(201,169,106,.55)',1);
  }
  function line(x1,y1,x2,y2,color,w,dash){
    ctx.strokeStyle=color; ctx.lineWidth=w||1; if(dash)ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); if(dash)ctx.setLineDash([]);
  }
  function annotation(s){
    line(W/2-34,772,W/2-16,772,C.gold,2); line(W/2+34,772,W/2+16,772,C.gold,2);
    sans(s,W/2,772,16,C.dim,'center');
  }
  function token(s,x,y,size,color,align,italic,alpha,weight){
    if(alpha===undefined||alpha>0.001){ink(alpha===undefined?1:alpha); serif(s,x,y,size,color,align,italic,weight); ink(1);}
  }
  function tokenAt(s,x0,y0,x1,y1,s0,s1,c0,c1,t0,t1,align,italic){
    var lt = T - (window.__curAct ? window.__curAct.start : 0);
    var p=ease((lt-t0)/(t1-t0));
    if(p<=0)return; p=Math.min(1,p);
    var x=lerp(x0,x1,p), y=lerp(y0,y1,p), sz=lerp(s0,s1,p);
    var a=Math.min(1,p*4);
    ink(a); serif(s,x,y,sz,c1||c0||C.ivory,align||'center',italic||false); ink(1);
  }
  function matrixHeat(x,y,cw,ch,vals,opt){
    opt=opt||{}; var r=vals.length,c=vals[0].length;
    var lo=opt.lo!==undefined?opt.lo:Math.min.apply(null,vals.map(function(row){return Math.min.apply(null,row);}));
    var hi=opt.hi!==undefined?opt.hi:Math.max.apply(null,vals.map(function(row){return Math.max.apply(null,row);}));
    var rev=opt.reveal===undefined?1:opt.reveal;
    for(var i=0;i<r;i++)for(var j=0;j<c;j++){
      var a=clamp(rev*(r+c)-(i+j),0,1); if(a<=0)continue;
      var v=vals[i][j], q=clamp((v-lo)/(hi-lo+1e-9),0,1);
      ink(a);
      ctx.fillStyle=opt.fixed||('rgba('+Math.round(16+235*q)+','+Math.round(28+155*q)+','+Math.round(40+95*q)+','+(0.22+0.72*q)+')');
      ctx.fillRect(x+j*cw,y+i*ch,cw-1,ch-1);
      if(opt.numbers){
        ctx.fillStyle=q>0.62?'#160f05':'rgba(234,234,242,.9)';
        ctx.font=(opt.font||9)+'px Consolas,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(fmt(v,opt.digits===undefined?2:opt.digits),x+j*cw+cw/2-.5,y+i*ch+ch/2);
      }
      ink(1);
    }
    if(opt.highlightRow!==undefined){ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.strokeRect(x-2,y+opt.highlightRow*ch-2,c*cw+3,ch+3);}
  }
  function axis(x,y,w,h){line(x,y,x+w,y,'rgba(138,138,160,.35)',1);line(x,y,x,y-h,'rgba(138,138,160,.35)',1);}
  var FX={key:null,el:null,prev:null,change:0};
  function setFX(key,tex,x,y,size){
    var layer=document.getElementById('fx'); if(!layer)return;
    if(key!==FX.key){
      if(FX.el){FX.prev=FX.el; FX.prev.style.transition='none';}
      FX.key=key; FX.el=null; FX.change=T;
      if(key){
        var d=document.createElement('div'); d.className='item';
        d.style.left=(x/W*100)+'%'; d.style.top=(y/H*100)+'%';
        d.style.fontSize=size+'px'; d.style.opacity=0;
        try{d.innerHTML=katex.renderToString(tex,{displayMode:true,throwOnError:false});}catch(e){d.textContent=tex;}
        layer.appendChild(d); FX.el=d;
      }
    }
    // 直接可读：不做 0 透明度淡入，避免逐帧 seek 时公式不可见
    if(FX.el)FX.el.style.opacity=1;
    if(FX.prev){FX.prev.remove();FX.prev=null;}
  }

  /* ---------- HOOK ---------- */
  function sceneHook(tl){
    setFX(null);
    kinetic('一条数据，能预测未来吗？',W/2,380,58,C.ivory,0.8,99,'center',400);
    if(tl>3.0){
      var a=ease((tl-3.0)/1.0); ink(a);
      ctx.strokeStyle='rgba(201,169,106,'+(0.35+0.25*Math.sin(tl*2))+')'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(W/2,600,120+10*Math.sin(tl*1.4),0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W/2,600,158+7*Math.sin(tl*1.1+1),0,Math.PI*2); ctx.stroke();
      serif('2.04',W/2,600,230,C.gold,'center',false,600);
      ink(1);
    }
    annotation('REAL DATA · TAIYUAN · 2019-12-16');
  }
  function sceneTitle(tl){
    setFX(null);
    ctx.fillStyle='rgba(5,5,16,.88)'; ctx.fillRect(0,0,W,H);
    var a=ease(tl/0.7); ink(a);
    spaced('VIBE 知识大赏',W/2,360,16,C.gold,8,'center');
    line(W/2-70,392,W/2+70,392,C.gold,1.5);
    serif('一个数字的旅程',W/2,490,98,C.ivory,'center',false,400);
    serif('The Journey of a Number',W/2,560,30,'rgba(201,169,106,.92)','center',true);
    sans('WMEG-Net · 山西 11 个地级市 · 2015—2019',W/2,640,18,C.dim,'center');
    ink(1);
  }
  function kinetic(s,x,y,size,color,t0,t1,align,weight){
    var a=ease((T-t0)/0.7)*(1-ease((T-t1)/0.5)); if(a<=0.001)return;
    var dy=(1-ease((T-t0)/0.8))*20; ink(a); serif(s,x,y+dy,size,color,align,false,weight); ink(1);
  }

  /* ---------- DATA：滚动窗口 → 公式 token 变形 ---------- */
  function sceneData(tl){
    var prov=APP.meta.province.casesSmoothSum, dates=APP.meta.dates;
    var endIdx=dates.indexOf('2019-12-16'), t0=endIdx-19;
    var x0=150,x1=1770,y=380,hh=120;
    if(tl<5){
      var mx=Math.max.apply(null,prov)||1;
      ctx.strokeStyle='rgba(127,200,214,.6)'; ctx.lineWidth=1.4; ctx.beginPath();
      for(var i=0;i<prov.length;i++){var x=x0+i/(prov.length-1)*(x1-x0);var yy=y+hh-(prov[i]||0)/mx*hh;if(i===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}
      ctx.stroke();
      var wx0=x0+t0/(prov.length-1)*(x1-x0), wx1=x0+endIdx/(prov.length-1)*(x1-x0), fx1=x0+Math.min(prov.length-1,endIdx+12)/(prov.length-1)*(x1-x0);
      ctx.fillStyle='rgba(127,200,214,.16)';ctx.fillRect(wx0,y-8,wx1-wx0,hh+16);
      ctx.fillStyle='rgba(217,122,102,.16)';ctx.fillRect(wx1,y-8,fx1-wx1,hh+16);
      sans('20 天输入',(wx0+wx1)/2,y+hh+38,13,C.cyan,'center');
      sans('12 步输出',(wx1+fx1)/2,y+hh+38,13,C.red,'center');
      for(var yr=2015;yr<=2019;yr++){var xi=dates.indexOf(yr+'-01-01');if(xi>=0)sans(String(yr),x0+xi/(prov.length-1)*(x1-x0),y+hh+66,13,C.dim,'center');}
      sans('11 座城市 · 1826 天',W/2,220,26,C.ivory,'center');
      annotation('DATA · SHANXI · 2015—2019');
      return;
    }
    var raw=EX.window.matrix.raw, dts=EX.window.matrix.dates;
    if(tl<13){
      // 柱状图 + 公式 + 数字飞入
      var bx=150,by=640,bw=760,bh=260;
      var mxr=Math.max.apply(null,raw);
      for(var k=0;k<raw.length;k++){
        var h=raw[k]/mxr*bh;
        var isW=k>=raw.length-7;
        ctx.fillStyle=isW?'rgba(201,169,106,.86)':'rgba(138,138,160,.28)';
        ctx.fillRect(bx+k*(bw/raw.length),by-h,bw/raw.length-5,h);
        if(isW)mono(fmt(raw[k],0),bx+k*(bw/raw.length)+bw/32,by-h-12,12,C.gold);
      }
      setFX('y','\\bar y(t)=\\frac{1}{7}\\big[y(t-6)+\\cdots+y(t)\\big]',W/2,200,42);
      var nums=EX.example.raw7;
      for(var j=0;j<7;j++){
        var sx=bx+(raw.length-7+j)*(bw/raw.length)+bw/32;
        var tx=560+j*120, ty=330;
        tokenAt(fmt(nums[j],0),sx,by-20,tx,ty,26,40,C.gold,C.ivory,5.2+j*.18,6.4+j*.18,'center',false);
        if(j<6&&tl>8) token('+',tx+60,ty,30,C.dim,'center',false,1);
      }
      if(tl>10){
        token('9+11+4+3+4+7+6 = 44',W/2,360,38,C.ivory,'center',false,1);
        token('44 ÷ 7 = 6.29',W/2,450,52,C.gold,'center',false,1);
      }
      annotation('7-DAY ROLLING AVERAGE');
      return;
    }
    if(tl<18){
      setFX('z','z=\\frac{6.29-1.20}{2.49}=2.04',W/2,270,54);
      // 高斯曲线 + z=2.04 位置
      var gx=520,gy=700,gw=880,gh=240;
      ctx.strokeStyle='rgba(138,138,160,.35)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+gw,gy);ctx.stroke();
      ctx.strokeStyle='rgba(201,169,106,.75)';ctx.lineWidth=2;ctx.beginPath();
      for(var px=0;px<=gw;px+=3){var zz=(px/gw-0.5)/0.17;var yy=gy-Math.exp(-.5*zz*zz)*gh;if(px===0)ctx.moveTo(gx+px,yy);else ctx.lineTo(gx+px,yy);}
      ctx.stroke();
      var zx=gx+(0.5+2.04*0.17)*gw, zy=gy-Math.exp(-.5*2.04*2.04)*gh;
      ctx.beginPath();ctx.arc(zx,zy,7,0,Math.PI*2);ctx.fillStyle=C.gold;ctx.fill();
      mono('2.04',zx+14,zy-12,20,C.gold,'left',600);
      sans('训练段均值 μ = 1.20, σ = 2.49',gx,gy+30,15,C.dim,'left');
      annotation('STANDARDIZE · z-SCORE');
      return;
    }
    // 16 通道向量
    setFX(null);
    var lr=EX.window.matrix.X[EX.window.matrix.X.length-1];
    var labels=['z(x)','T′','AH′','z(P)','s1','c1','s2','c2','s3','c3','s4','c4','s5','c5','s6','c6'];
    for(var j2=0;j2<16;j2++){
      var cx=150+j2*103, cy=470, a2=ease((tl-18)/1.6-j2*.03); if(a2<=0)continue;
      ink(a2);
      ctx.fillStyle=lr[j2]>=0?'rgba(201,169,106,'+(0.22+Math.min(.55,Math.abs(lr[j2])/2))+')':'rgba(127,200,214,'+(0.16+Math.min(.5,Math.abs(lr[j2])/4))+')';
      ctx.fillRect(cx,cy,88,72);
      mono(fmt(lr[j2],2),cx+44,cy+30,14,C.ivory);
      sans(labels[j2],cx+44,cy+58,11,C.dim);
      ink(1);
    }
    sans('16 个通道 = 病例 z + 温度/湿度距平 + 降水 z + 12 个日历谐波',W/2,640,20,C.dim,'center');
    annotation('FEATURES · 16 CHANNELS');
  }

  /* ---------- MATRIX：矩阵 → 行向量 → 点积 ---------- */
  function sceneMatrix(tl){
    var X=EX.window.matrix.X, WT=JR.WTrained;
    var xv=JR.x, wv=JR.featureTrace.wTrained, b=JR.biasTrained[10];
    var mx=120,my=200,mcw=44,mch=20;
    var wx0=1500,wy0=220,wcw=18,wch=10;
    if(tl<6){
      var rev=ease(tl/4);
      matrixHeat(mx,my,mcw,mch,X,{reveal:rev,numbers:true,digits:2,font:7.5,lo:-1.2,hi:2.4});
      matrixHeat(wx0,wy0,wcw,wch,WT,{reveal:rev,numbers:false,lo:-.8,hi:.8,highlightRow:10});
      setFX('X','\\mathbf{X}\\in\\mathbb{R}^{20\\times16}',mx+40,150,28);
      sans('W · 32 × 16',wx0,190,16,C.gold,'left');
      sans('最后一行 = 12-16 的输入向量',mx,660,15,C.dim,'left');
      annotation('INPUT MATRIX · 20 × 16');
    } else if(tl<12){
      var p=ease((tl-6)/5);
      // 矩阵其余部分淡出
      ink(1-.85*p); matrixHeat(mx,my,mcw,mch,X,{reveal:1,numbers:true,digits:2,font:7.5,lo:-1.2,hi:2.4}); ink(1);
      // W 仍在
      ink(1-.6*p); matrixHeat(wx0,wy0,wcw,wch,WT,{reveal:1,numbers:false,lo:-.8,hi:.8,highlightRow:10}); ink(1);
      // 行单元格飞向向量
      for(var j=0;j<16;j++){
        var sx=mx+j*mcw+mcw/2, sy=my+19*mch+mch/2;
        var tx=200+j*96, ty=360;
        var q=ease((tl-6.4-j*.05)/1.8);
        if(q<=0)continue;
        var cx=lerp(sx,tx,q), cy=lerp(sy,ty,q), w=lerp(mcw,92,q), h=lerp(mch,72,q);
        ink(.85+.15*q);
        ctx.fillStyle='rgba(201,169,106,'+(.25+.5*q)+')';
        ctx.fillRect(cx-w/2,cy-h/2,w-1,h-1);
        mono(fmt(xv[j],2),cx,cy,lerp(7,15,q),q>.6?'#160f05':'rgba(234,234,242,.9)');
        ink(1);
        if(q>.7) sans('x'+(j+1),cx,cy+52,12,C.dim);
      }
      setFX('x','\\mathbf{x}\\in\\mathbb{R}^{16}',W/2,250,30);
      sans('取最后一行：16 维输入 x',W/2,290,22,C.ivory,'center');
      annotation('ROW → VECTOR · x ∈ R¹⁶');
    } else if(tl<17){
      // x 向量固定 + W 第 11 行飞入 w 向量
      for(var j2=0;j2<16;j2++){
        var cx2=200+j2*96, cy2=340;
        ctx.fillStyle='rgba(201,169,106,.45)'; ctx.fillRect(cx2-45,cy2-34,90,68);
        mono(fmt(xv[j2],2),cx2,cy2,15,'#160f05');
        sans('x'+(j2+1),cx2,cy2+50,11,C.dim);
      }
      var q2=ease((tl-11)/5);
      for(var k=0;k<16;k++){
        var ssx=wx0+k*wcw+wcw/2, ssy=wy0+10*wch+wch/2;
        var ttx=200+k*96, tty=490;
        var qq=ease((tl-10.6-k*.03)/1.3);
        if(qq<=0)continue;
        var ccx=lerp(ssx,ttx,qq), ccy=lerp(ssy,tty,qq), ww=lerp(wcw,90,qq), hh=lerp(wch,68,qq);
        ctx.fillStyle=wv[k]>=0?'rgba(201,169,106,'+(.3+.45*qq)+')':'rgba(127,200,214,'+(.25+.45*qq)+')';
        ctx.fillRect(ccx-ww/2,ccy-hh/2,ww-1,hh-1);
        mono(fmt(wv[k],2),ccx,ccy,lerp(7,14,qq),'#f2eee4');
        if(qq>.7) sans('w'+(k+1),ccx,ccy+50,11,C.dim);
      }
      setFX('w','\\mathbf{w}\\in\\mathbb{R}^{16}',W/2,230,30);
      sans('取权重矩阵第 11 行：16 个权重 w',W/2,300,22,C.ivory,'center');
      annotation('W ROW → VECTOR · w ∈ R¹⁶');
    } else if(tl<23){
      // 点积：逐列乘积，累加
      var sum=0;
      for(var j3=0;j3<16;j3++){
        var cx3=200+j3*96;
        // x、w 小方块
        ctx.fillStyle='rgba(201,169,106,.35)'; ctx.fillRect(cx3-45,300,90,54);
        mono(fmt(xv[j3],2),cx3,327,13,'#f2eee4');
        ctx.fillStyle='rgba(127,200,214,.3)'; ctx.fillRect(cx3-45,390,90,54);
        mono(fmt(wv[j3],2),cx3,417,13,'#f2eee4');
        var done=tl>17.4+j3*.18;
        if(done){
          sum+=xv[j3]*wv[j3];
          ink(.95);
          mono(fmt(xv[j3]*wv[j3],2),cx3,500,15,C.gold,'center',600);
          ctx.strokeStyle='rgba(201,169,106,.5)';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(cx3,445);ctx.lineTo(cx3,478);ctx.stroke();
          ink(1);
        }
      }
      setFX('pre','\\mathrm{pre}=\\sum_{c=1}^{16}x_c w_c+b',W/2,180,34);
      if(tl>19.5){
        ink(ease((tl-19.5)/.8));
        mono('Σ = '+fmt(sum,2),1080,580,26,C.ivory,'left');
        mono('+ b = '+fmt(b,2),1080,622,20,C.dim,'left');
        mono('pre = '+fmt(JR.featureTrace.preTrained,3),1080,672,34,C.cyan,'left',600);
        ink(1);
      }
      annotation('DOT PRODUCT · 16 TERMS');
    } else {
      // pre 放大，准备进 GELU
      var a=ease((tl-23)/2);
      ink(a);
      setFX('pre2','\\mathrm{pre}=-0.319',W/2,380,64);
      mono('pre = '+fmt(JR.featureTrace.preTrained,3),W/2,470,92,C.cyan,'center',600);
      sans('净输入 · 第 11 个特征',W/2,520,22,C.dim,'center');
      ink(1);
      annotation('PRE · GELU INPUT');
    }
  }

  /* ---------- ENCODER：GELU → 编码器 → 输出 ---------- */
  function sceneEncoder(tl){
    if(tl<7){
      var gx=460,gy=650,gw=1000,gh=300;
      axis(gx,gy,gw,0);
      function gelu(z){return .5*z*(1+Math.tanh(Math.sqrt(2/Math.PI)*(z+.044715*z*z*z)));}
      ctx.strokeStyle=C.gold; ctx.lineWidth=2.2; ctx.beginPath();
      for(var p=-4;p<=4;p+=.03){var X2=gx+(p+4)/8*gw,Y2=gy-gelu(p)*70;if(p===-4)ctx.moveTo(X2,Y2);else ctx.lineTo(X2,Y2);}
      ctx.stroke();
      setFX('gelu','\\mathrm{GELU}(z)=0.5z\\left(1+\\tanh\\left(\\sqrt{2/\\pi}(z+0.044715z^3)\\right)\\right)',W/2,170,24);
      var pre=JR.featureTrace.preTrained, post=JR.featureTrace.postTrained;
      var q=ease((tl-1)/4);
      var px=gx+(pre+4)/8*gw, py=gy-gelu(pre)*70;
      var qx=px, qy=py;
      if(q>0){
        // 沿曲线移动：用 x 从 pre 到 post
        var zz=lerp(pre,post,q);
        qx=gx+(zz+4)/8*gw; qy=gy-gelu(zz)*70;
        ctx.beginPath();ctx.arc(qx,qy,7,0,Math.PI*2);ctx.fillStyle=C.gold;ctx.fill();
      }
      mono('pre = '+fmt(pre,3),gx,720,20,C.cyan,'left');
      mono('GELU = '+fmt(post,3),gx+320,720,22,C.gold,'left',600);
      annotation('ACTIVATION · GELU');
    } else if(tl<13){
      var st=[JR.featureTrace.postTrained,JR.chain.stages[1].trained,JR.chain.stages[2].trained,JR.chain.stages[3].trained];
      var names=['GELU','编码器','时间投影','输出'];
      var pos=clamp((tl-7)/5,0,1)*3;
      for(var i=0;i<4;i++){
        var x=130+i*450,y=420;
        sans(names[i],x+160,y-90,18,C.dim,'center');
        mono(fmt(st[i],3),x+160,y,i===3?58:42,i===3?C.gold:C.ivory,'center',600);
        if(i<3)line(x+350,y,x+450,y,'rgba(201,169,106,.35)',1);
      }
      var dx=130+pos*450+160;
      ctx.beginPath();ctx.arc(dx,540,5,0,Math.PI*2);ctx.fillStyle=C.gold;ctx.fill();
      setFX('chain','\\mathbf{h}\\rightarrow\\cdots\\rightarrow\\hat{y}',W/2,190,30);
      annotation('SAME FEATURE · FOUR STAGES');
    } else {
      var O=JR.output,n=O.dates.length;
      var bx=260,by=660,bw=1000,bh=360;
      var all=O.true.concat(O.trained,O.init);
      var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all);
      function yy(v){return by-(v-mn)/(mx-mn+1e-6)*bh;}
      axis(bx,by,bw,0);
      var rv=ease((tl-13)/4);
      ctx.save();ctx.beginPath();ctx.rect(bx,by-bh-10,bw*rv,bh+20);ctx.clip();
      ctx.strokeStyle='rgba(234,234,242,.8)';ctx.lineWidth=2;ctx.beginPath();
      for(var i2=0;i2<n;i2++){var xx=bx+i2/(n-1)*bw;if(i2===0)ctx.moveTo(xx,yy(O.true[i2]));else ctx.lineTo(xx,yy(O.true[i2]));}ctx.stroke();
      ctx.strokeStyle=C.gold;ctx.lineWidth=3;ctx.beginPath();
      for(var i3=0;i3<n;i3++){var xx2=bx+i3/(n-1)*bw;if(i3===0)ctx.moveTo(xx2,yy(O.trained[i3]));else ctx.lineTo(xx2,yy(O.trained[i3]));}ctx.stroke();
      ctx.restore();
      big('6.57',W/2,360,150,C.gold,16,99);
      sans('太原 · 12 步输出',W/2,250,20,C.dim,'center');
      setFX(null);
      annotation('OUTPUT · 12 STEPS');
    }
  }
  function big(s,x,y,size,color,t0,t1){
    var p=(T-(t0))-(sceneOffset());
    // 用幕内时间
    if(!window.__curAct) return;
    var tl=T-window.__curAct.start;
    if(tl<t0||tl>t1)return;
    var a=Math.min(1,(tl-t0)/.6)*Math.min(1,(t1-tl)/.5); ink(a); serif(s,x,y,size,color,'center',false,600); ink(1);
  }
  function sceneOffset(){return 0;}

  /* ---------- LEARNING ---------- */
  function sceneLearning(tl){
    if(tl<9){
      var WI=JR.WInit,WT=JR.WTrained;
      var p=ease((tl-1)/7);
      var x0s=[160,430], labels=['初始化 W','训练后 W'];
      for(var s=0;s<2;s++){
        var base=s===0?WI:WT;
        for(var i=0;i<32;i++)for(var j=0;j<16;j++){
          var v=s===0?base[i][j]:lerp(WI[i][j],WT[i][j],p);
          var q=clamp((v+.8)/1.6,0,1);
          ctx.fillStyle='rgba('+Math.round(16+235*q)+','+Math.round(28+155*q)+','+Math.round(40+95*q)+','+(.25+.7*q)+')';
          ctx.fillRect(x0s[s]+j*11,i*9+220,10,8);
        }
        ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.strokeRect(x0s[s]-2,220+10*9-2,16*11+3,9+3);
        sans(labels[s],x0s[s]+88,540,16,s===0?C.dim:C.gold,'center');
      }
      setFX('theta','\\theta:\\ \\mathbf{W}^{(0)}\\rightarrow\\mathbf{W}^{(T)}',W/2,140,30);
      sans('同一个 32×16 权重矩阵：随机 → 训练后',W/2,190,26,C.ivory,'center');
      var rowI=JR.featureTrace.wInit,rowW=JR.featureTrace.wTrained;
      for(var k=0;k<16;k++){
        var yy=220+k*22;
        line(860,yy,1500,yy,'rgba(138,138,160,.15)',1);
        ctx.fillStyle='rgba(201,169,106,.65)';
        ctx.fillRect(860+330*clamp((lerp(rowI[k],rowW[k],p)+.8)/1.6,0,1)-2,yy-3,4,6);
      }
      mono('pre 0.899 → −0.319　　GELU 0.733 → −0.120',860,610,20,C.dim,'left');
      // 底部：θ 沿损失下降
      var lx=220,ly=700,lw=700;
      ctx.strokeStyle='rgba(201,169,106,.35)';ctx.lineWidth=2;ctx.beginPath();
      for(var q=0;q<=1;q+=0.02){var xx=lx+q*lw;var yy=ly-70*Math.exp(-q*3)-20*(1-q);if(q===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}
      ctx.stroke();
      var pr=clamp((tl-1)/7,0,1);
      var dx=lx+pr*lw, dy=ly-70*Math.exp(-pr*3)-20*(1-pr);
      ctx.beginPath();ctx.arc(dx,dy,6,0,Math.PI*2);ctx.fillStyle=C.gold;ctx.fill();
      sans('θ 沿损失下降方向更新',lx,ly+34,15,C.dim,'left');
      annotation('LEARNING · θ UPDATES');
    } else if(tl<17){
      var curves=JR.loss.curves,keys=Object.keys(curves);
      var maxEp=0,lo=Infinity,hi=-Infinity;
      keys.forEach(function(s){curves[s].forEach(function(q){maxEp=Math.max(maxEp,q[0]);var lv=Math.log10(Math.max(q[2],.02));lo=Math.min(lo,lv);hi=Math.max(hi,lv);});});
      var bx=140,by=660,bw=760,bh=340;
      axis(bx,by,bw,0);
      var prog=ease((tl-9)/6);
      keys.forEach(function(s,si){
        var arr=curves[s];
        ctx.strokeStyle=si===0?C.gold:'rgba(127,200,214,'+(.14+.03*(si%4))+')';ctx.lineWidth=si===0?2:1;
        ctx.beginPath();
        var up=Math.floor(prog*(arr.length-1));
        for(var i=0;i<=up;i++){var x=bx+arr[i][0]/maxEp*bw;var lv2=Math.log10(Math.max(arr[i][2],.02));var y=by-(lv2-lo)/(hi-lo+1e-6)*bh;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
      });
      setFX('loss','\\mathcal{L}(\\theta)\\downarrow',W/2,170,32);
      sans('15 个种子 · 验证损失（log）',520,250,20,C.ivory,'center');
      var O=JR.output,n=O.dates.length;
      var ox=1050,oy=660,ow=680,oh=330;
      var all=O.true.concat(O.trained,O.init);
      var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all);
      function yy2(v){return oy-(v-mn)/(mx-mn+1e-6)*oh;}
      function ln(vals,color,w){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();for(var i=0;i<n;i++){var x=ox+i/(n-1)*ow;if(i===0)ctx.moveTo(x,yy2(vals[i]));else ctx.lineTo(x,yy2(vals[i]));}ctx.stroke();}
      ln(O.true,'rgba(234,234,242,.8)',2); ln(O.init,'rgba(138,138,160,.6)',1.5); ln(O.trained,C.gold,2.5);
      sans('12 步输出：真值 / 初始化 / 训练后',1390,230,18,C.ivory,'center');
      annotation('TRAINING · 15 SEEDS');
    } else {
      var a = ease((tl - 17) / 1.2);
      ink(a);
      serif('但等等——', W/2, 420, 76, C.ivory, 'center', false, 400);
      sans('它真的学会了吗？', W/2, 520, 24, C.dim, 'center');
      ink(1);
      setFX(null);
      annotation('WAIT · DOES IT REALLY LEARN?');
    }
  }

  /* ---------- EVIDENCE ---------- */
  function sceneEvidence(tl){
    if(tl<8){
      serif('2.1611',W/2-410,400,100,C.ivory,'center',false,600); sans('模型 RMSE',W/2-410,490,19,C.dim,'center');
      serif('2.1225',W/2+40,400,100,'rgba(138,138,160,.9)','center',false,600); sans('持续性基线',W/2+40,490,19,C.dim,'center');
      serif('2.0125',W/2+490,400,100,C.gold,'center',false,600); sans('校准后 α=0.25',W/2+490,490,19,C.dim,'center');
      setFX('rmse','\\mathrm{RMSE}=2.1611',W/2,200,44);
      sans('仍差 1.8% —— 校准后才赢',W/2,620,26,C.red,'center');
      annotation('HONEST RESULT · CALIBRATION');
    } else {
      var tg=EX.target,n=tg.dates.length;
      var bx=280,by=660,bw=920,bh=360;
      var all=tg.cityTrue.concat(tg.p90,tg.p10,tg.cityPred);
      var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all);
      function yy(v){return by-(v-mn)/(mx-mn+1e-6)*bh;}
      axis(bx,by,bw,0);
      ctx.fillStyle='rgba(201,169,106,.12)';ctx.beginPath();
      for(var i=0;i<n;i++){var x=bx+i/(n-1)*bw;if(i===0)ctx.moveTo(x,yy(tg.p90[i]));else ctx.lineTo(x,yy(tg.p90[i]));}
      for(var j=n-1;j>=0;j--)ctx.lineTo(bx+j/(n-1)*bw,yy(tg.p10[j]));
      ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(234,234,242,.9)';ctx.lineWidth=2.5;ctx.beginPath();
      for(var k=0;k<n;k++){var x2=bx+k/(n-1)*bw;if(k===0)ctx.moveTo(x2,yy(tg.cityTrue[k]));else ctx.lineTo(x2,yy(tg.cityTrue[k]));}ctx.stroke();
      ctx.strokeStyle=C.gold;ctx.lineWidth=2.5;ctx.beginPath();
      for(var k2=0;k2<n;k2++){var x3=bx+k2/(n-1)*bw;if(k2===0)ctx.moveTo(x3,yy(tg.cityPred[k2]));else ctx.lineTo(x3,yy(tg.cityPred[k2]));}ctx.stroke();
      if(tl>10){ink(ease((tl-10)/.8));serif('6 → 12.3',1500,360,64,C.gold,'center',false,600);ink(1);}
      sans('假期陡升被低估',1500,430,20,C.red,'center');
      sans('预测约 6 例/日，真实升到 12.3',1500,468,16,C.dim,'center');
      setFX(null);
      annotation('FAILURE MODE · HOLIDAY SURGE');
    }
  }

  /* ---------- LANDING ---------- */
  function sceneLanding(tl){
    setFX(null);
    var cities=APP.meta.cities, deg=cities.map(function(c){return c.neighbors.length;});
    var Cm=[];
    for(var i=0;i<11;i++){var row=[];for(var j=0;j<11;j++){if(i===j)row.push(1/(deg[i]+1));else if(cities[i].neighbors.indexOf(cities[j].name)>=0)row.push(1/(deg[i]+1));else row.push(0);}Cm.push(row);}
    matrixHeat(220,300,34,26,Cm,{reveal:ease(tl/4),numbers:false,lo:0,hi:.34});
    sans('C · 11×11 行随机矩阵',220,700,18,C.gold,'left');
    serif('结构先验，准静态',1180,380,46,C.ivory,'left',false,600);
    sans('C 几乎不随时间变化，不是实时传播流量',1180,450,20,C.dim,'left');
    serif('15,385',1180,570,64,C.gold,'left',false,600);
    sans('个可学习参数',1180,630,20,C.dim,'left');
    sans('15 个种子集成',1180,690,20,C.cyan,'left');
    annotation('WHAT IT LEARNED · STRUCTURAL PRIOR');
  }
  function sceneReference(tl){
    setFX(null);
    var a=ease(tl/1.2); ink(a);
    spaced('REFERENCE',W/2,300,14,C.gold,6,'center');
    serif('WMEG-Net · 山西 11 市 · 2015—2019',W/2,400,40,C.ivory,'center');
    serif('一个数字的旅程',W/2,475,30,C.gold,'center',false,400);
    sans('真实数据；方法示意，不构成流行病学结论。',W/2,575,20,C.dim,'center');
    sans('VIBE 知识大赏',W/2,690,16,'rgba(201,169,106,.8)','center');
    ink(1);
  }

  var ACTS=[
    {start:0,end:12,label:'HOOK',draw:sceneHook},
    {start:12,end:17.5,label:'TITLE',draw:sceneTitle},
    {start:17.5,end:42,label:'DATA · 2015—2019',draw:sceneData},
    {start:42,end:70,label:'MATRIX',draw:sceneMatrix},
    {start:70,end:88,label:'ENCODER',draw:sceneEncoder},
    {start:88,end:112,label:'LEARNING',draw:sceneLearning},
    {start:112,end:132,label:'EVIDENCE',draw:sceneEvidence},
    {start:132,end:144,label:'LANDING',draw:sceneLanding},
    {start:144,end:150,label:'REFERENCE',draw:sceneReference}
  ];
  var ACT_SUBS=[
    [[0,'一条数据，能预测未来吗？','Can one number predict the future?'],[3.2,'2.04，一个标准化后的值。','2.04 — a standardized value.'],[6.8,'它凭什么预测未来？','Why can it predict?'],[9.6,'看它走过的每一步。','Watch every step it takes.']],
    [],
    [[.5,'1826 天，11 座城市。','1,826 days. Eleven cities.'],[4.8,'每天，用前 7 天做平均。','Each day averages the last seven.'],[8,'9+11+4+3+4+7+6 = 44。','Nine plus eleven … equals 44.'],[11.6,'44 ÷ 7 = 6.29。','Forty-four over seven is 6.29.'],[13.4,'再标准化：z = 2.04。','Standardize: z equals 2.04.'],[18,'16 个通道，拼成一行。','Sixteen channels form one row.']],
    [[.5,'20 天，就是一个矩阵。','Twenty days become a matrix.'],[6.2,'取最后一行：16 维输入。','Take the last row: sixteen inputs.'],[11.2,'权重矩阵：32 × 16。','The weight matrix: 32 by 16.'],[12.6,'取第 11 行：16 个权重。','Take row eleven: sixteen weights.'],[17.5,'16 次乘加 → pre。','Sixteen multiply-adds give pre.'],[23.5,'pre = −0.319。','pre equals minus 0.319.']],
    [[.5,'GELU 把 pre 变成 −0.120。','GELU turns pre into minus 0.120.'],[7.2,'编码器继续改写它。','The encoder keeps rewriting it.'],[10.5,'−0.332 → 0.639。','Minus 0.332, then 0.639.'],[13.5,'输出 6.57。','Output: 6.57.']],
    [[.5,'6.57 是怎么学会的？','But how did it learn 6.57?'],[3.5,'训练前，权重随机。','Before training, the weights are random.'],[7,'训练后，它们变了。','After training, they have changed.'],[10,'15 个种子，各自学习。','Fifteen seeds, each learning.'],[13.2,'损失一路下降。','The loss keeps falling.'],[17.5,'但等等——','But wait.']],
    [[.5,'模型 RMSE 2.1611。','Model RMSE 2.1611.'],[4.2,'仍比“照抄昨天”差 1.8%。','Still 1.8% worse than persistence.'],[7.8,'校准之后，2.0125。','After calibration: 2.0125.'],[11.5,'它失败在哪？','Where does it fail?'],[15,'假期陡升：预测 6，真实 12。','Holiday surge: predicted 6, actual 12.']],
    [[.5,'这不是 bug，是边界。','Not a bug — a boundary.'],[4,'15,385 个参数。','15,385 parameters.'],[7.5,'它学到的是结构先验。','What it learned is a structural prior.']],
    [[1,'一个数字的旅程。','The journey of one number.'],[4,'数据、公式、矩阵、权重。','Data, formulas, matrices, weights.']]
  ];
  function actAt(t){for(var i=ACTS.length-1;i>=0;i--)if(t>=ACTS[i].start)return ACTS[i];return ACTS[0];}
  function subtitle(t){
    var act=actAt(t); if(act.label==='TITLE')return;
    var idx=ACTS.indexOf(act), arr=ACT_SUBS[idx]||[], lt=t-act.start;
    var cur=null,ci=-1;
    for(var i=0;i<arr.length;i++)if(lt>=arr[i][0]){cur=arr[i];ci=i;}
    if(!cur)return;
    var next=ci+1<arr.length?arr[ci+1][0]:(act.end-act.start);
    var a=Math.min(1,(lt-cur[0])/.5,(next-lt)/.4); if(a<=0)return; a=clamp(a,0,1);
    ink(a*.96); sans(cur[1],W/2,916,40,C.ivory,'center',600); ink(1);
    ink(a*.9); serif(cur[2],W/2,962,22,'rgba(201,169,106,.92)','center',true); ink(1);
  }
  function render(){
    bg();
    var act=actAt(T);
    if(act.label!=='TITLE')topLabel(act.label);
    window.__curAct=act;
    act.draw(T-act.start);
    watermark();
    subtitle(T);
    ctx.fillStyle='rgba(201,169,106,.12)';ctx.fillRect(0,H-4,W,2);
    ctx.fillStyle=C.gold;ctx.fillRect(0,H-4,W*(T/DUR),2);
    var el=document.getElementById('time'); if(el)el.textContent=fmtTime(T)+' / '+fmtTime(DUR);
    var rg=document.getElementById('range'); if(rg)rg.value=T;
  }
  function fmtTime(t){var m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+(s<10?'0':'')+s;}
  function seek(t){T=clamp(t,0,DUR);render();}
  function tick(ts){
    if(!EX){requestAnimationFrame(tick);return;}
    if(playing){var dt=lastTs?(ts-lastTs)/1000:0;T+=dt;if(T>=DUR){T=DUR;playing=false;}}
    lastTs=ts;render();requestAnimationFrame(tick);
  }
  function bind(){
    var poster=document.getElementById('poster');
    poster.addEventListener('click',function(){poster.style.display='none';playing=true;T=0;});
    document.getElementById('play').addEventListener('click',function(){playing=!playing;this.textContent=playing?'PAUSE':'PLAY';});
    document.getElementById('range').addEventListener('input',function(){playing=false;document.getElementById('play').textContent='PLAY';seek(parseFloat(this.value));});
    document.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();playing=!playing;document.getElementById('play').textContent=playing?'PAUSE':'PLAY';}if(e.code==='ArrowRight')seek(T+3);if(e.code==='ArrowLeft')seek(T-3);});
  }
  function load(){
    Promise.all([
      fetch('data/explain_data.json').then(function(r){return r.json();}),
      fetch('data/journey_data.json').then(function(r){return r.json();}),
      fetch('data/app_data.json').then(function(r){return r.json();})
    ]).then(function(arr){
      EX=arr[0];JR=arr[1];APP=arr[2];
      if(RECORD){document.body.classList.add('record');}
      else{bind();}
      var qt=parseFloat(new URLSearchParams(location.search).get('t')||'0');
      seek(isNaN(qt)?0:qt);
      window.__vibe={
        ready:true,duration:DUR,
        seek:function(t){playing=false;seek(t);},
        captions:function(){var out=[];ACTS.forEach(function(a,i){(ACT_SUBS[i]||[]).forEach(function(s){out.push({t:a.start+s[0],cn:s[1],en:s[2]});});});return out;}
      };
      if(!RECORD)requestAnimationFrame(tick);
    }).catch(function(e){document.body.innerHTML='<pre style="color:#eaeaf2;padding:30px">data error: '+e+'</pre>';});
  }
  function init(){
    cv=document.getElementById('cv');
    dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=W*dpr;cv.height=H*dpr;
    ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
