'use strict';
/* ============================================================
   v2 改版渲染层：故事条 + 11 城时间带 + 双通道地图 + 传播粒子
   通过覆盖 app.js 的全局函数实现，不改原文件结构
   ============================================================ */
(function () {
  var V2 = { displayIdx: 0, lastFull: 0, lastCity: 0, lastTs: 0, stripBase: null, storyBase: null, inited: false };
  var MODES2 = [
    { id: 'rate', name: '发病率' },
    { id: 'cases', name: '原始病例' },
    { id: 'growth', name: '7 日变化' },
    { id: 'precip', name: '降水' },
    { id: 'tavg', name: '气温' },
    { id: 'rh', name: '湿度' }
  ];
  var SEQ = [[26, 42, 74], [24, 72, 120], [20, 120, 150], [40, 170, 150], [150, 190, 60], [230, 160, 40], [220, 60, 60]];
  var DIVN = [[70, 140, 200], [110, 165, 195], [150, 165, 175]];
  var DIVP = [[150, 165, 175], [230, 160, 90], [220, 70, 60]];

  function $s(sel) { return document.querySelector(sel); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }
  function nd() { return DATA.meta.ndays; }
  function sm(name, i) { var a = DATA.series[name].casesSmooth; return (a && i >= 0 && i < a.length) ? a[i] : null; }
  function rateOf(name, i) { var a = V2X.rate[name]; return (a && i >= 0 && i < a.length) ? a[i] : null; }
  function growthOf(name, i) {
    var a = sm(name, i), b = sm(name, Math.max(0, i - 7));
    return (a === null || b === null) ? null : a - b;
  }
  function provSum(i) { var s = 0; for (var k = 0; k < DATA.meta.cities.length; k++) s += (sm(DATA.meta.cities[k].name, i) || 0); return s; }
  function modeVal(mode, name, i) {
    if (mode === 'rate') return rateOf(name, i);
    if (mode === 'cases') return sm(name, i);
    if (mode === 'growth') return growthOf(name, i);
    return gv(name, mode, i);
  }
  function seqColor(t) {
    t = clamp(t, 0, 1);
    var p = t * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(p)), u = p - i;
    var a = SEQ[i], b = SEQ[i + 1];
    return 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';
  }
  function divColor(t) {
    t = clamp(t, -1, 1);
    var a, b, u;
    if (t < 0) { a = DIVN[0]; b = DIVN[1]; u = -t; }
    else { a = DIVP[0]; b = DIVP[1]; u = t; }
    if (t < 0 && u > 0.5) { a = DIVN[1]; b = DIVN[2]; u = (u - 0.5) * 2; }
    if (t > 0 && u > 0.5) { a = DIVP[1]; b = DIVP[2]; u = (u - 0.5) * 2; }
    return 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';
  }
  function colorFor(mode, v) {
    if (v === null || v === undefined || isNaN(v)) return '#22344b';
    if (mode === 'growth') {
      var maxA = V2X.stats.growth.maxAbs || 10;
      return divColor(v / maxA);
    }
    if (mode !== 'rate' && mode !== 'cases' && v < 0.02) return '#22344b';
    if (mode === 'rate') return seqColor(Math.sqrt(clamp(v / (V2X.stats.rate.q97 || 0.34), 0, 1)));
    if (mode === 'cases') return seqColor(Math.sqrt(clamp(v / (V2X.stats.cases.q97 || 18), 0, 1)));
    if (mode === 'precip') return seqColor(Math.sqrt(clamp(v / 25, 0, 1)));
    if (mode === 'tavg') return seqColor(clamp((v + 20) / 52, 0, 1));
    return seqColor(clamp(v / 100, 0, 1));
  }
  function fmtVal(mode, v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (mode === 'rate') return v.toFixed(2);
    if (mode === 'cases') return v.toFixed(1);
    if (mode === 'growth') return (v >= 0 ? '+' : '') + v.toFixed(1);
    if (mode === 'precip') return v.toFixed(1);
    if (mode === 'tavg') return v.toFixed(1);
    return v.toFixed(0);
  }
  function modeUnit(mode) {
    return { rate: '例/10 万', cases: '例', growth: '例', precip: 'mm', tavg: '°C', rh: '%' }[mode] || '';
  }
  function modeButtons2() {
    var h = '<span class="muted small">指标</span>';
    MODES2.forEach(function (m) {
      h += '<button class="btn' + (state.mode === m.id ? ' active' : '') + '" data-mode="' + m.id + '">' + m.name + '</button>';
    });
    return h;
  }
  function viewButtons2() {
    return '<span class="muted small" style="margin-left:8px">视图</span>' +
      '<button class="btn' + (state.view === 'map' ? ' active' : '') + '" data-view="map">地图</button>' +
      '<button class="btn' + (state.view === 'network' ? ' active' : '') + '" data-view="network">网络</button>' +
      '<button class="btn' + (state.view === '3d' ? ' active' : '') + '" data-view="3d">3D 立体</button>';
  }
  function legendHTML(mode) {
    if (mode === 'growth') {
      return '<span class="small muted">下降</span><span class="v2-ramp div"></span><span class="small muted">上升</span>' +
        '<span class="small muted">（±' + fmt(V2X.stats.growth.maxAbs, 1) + ' 例 / 7 天）</span>';
    }
    var st = mode === 'rate' ? V2X.stats.rate : (mode === 'cases' ? V2X.stats.cases : null);
    var unit = modeUnit(mode);
    if (st) {
      return '<span class="v2-ramp seq"></span><span class="small muted">0 → ' + fmt(st.q97, mode === 'rate' ? 2 : 0) + ' ' + unit + '（q97）</span>';
    }
    var ranges = { precip: '0 → 25 mm', tavg: '-20 → 32 °C', rh: '0 → 100 %' };
    return '<span class="v2-ramp seq"></span><span class="small muted">' + ranges[mode] + '</span>';
  }
  function kpi(label, value, sub) {
    return '<div class="v2-kpi"><div class="k">' + label + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>';
  }

  /* ---------- 故事条 / 时间带 ---------- */
  function buildStoryBase() {
    var cv = $s('#st-curve');
    if (!cv) return;
    var w = cv.width, h = cv.height;
    var base = document.createElement('canvas');
    base.width = w; base.height = h;
    var c = base.getContext('2d');
    var vals = [], i;
    for (i = 0; i < nd(); i++) vals.push(provSum(i));
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var x = function (i) { return 4 + i / (nd() - 1) * (w - 8); };
    var y = function (v) { return h - 8 - (v - mn) / (mx - mn) * (h - 16); };
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(244,185,66,.55)'); g.addColorStop(1, 'rgba(244,185,66,0)');
    c.beginPath(); c.moveTo(x(0), h);
    for (i = 0; i < nd(); i++) c.lineTo(x(i), y(vals[i]));
    c.lineTo(x(nd() - 1), h); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath();
    for (i = 0; i < nd(); i++) { if (i === 0) c.moveTo(x(i), y(vals[i])); else c.lineTo(x(i), y(vals[i])); }
    c.strokeStyle = '#f4b942'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = 'rgba(140,160,180,.65)'; c.font = '9px "Segoe UI",sans-serif'; c.textAlign = 'center';
    for (var yr = 2015; yr <= 2019; yr++) {
      var idx = DATA.meta.dates.indexOf(yr + '-01-01');
      if (idx < 0) continue;
      c.fillRect(x(idx), h - 5, 1, 5);
      c.fillText(String(yr), x(idx) + 8, h - 1);
    }
    V2.storyBase = base;
  }
  function drawStory(ts) {
    var cv = $s('#st-curve');
    if (!cv || !V2.storyBase) return;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(V2.storyBase, 0, 0);
    var px = 4 + state.idx / (nd() - 1) * (cv.width - 8);
    c.strokeStyle = '#fff'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(px, 2); c.lineTo(px, cv.height - 2); c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(px, 2, 2.2, 0, Math.PI * 2); c.fill();
  }
  function buildStripBase() {
    var cv = $s('#ov-strip');
    if (!cv) return;
    var W = cv.width, H = cv.height;
    var padL = 58, padR = 10, padT = 8, padB = 22;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var order = V2X.seasonOrder;
    var n = nd();
    var img = document.createElement('canvas'); img.width = n; img.height = order.length;
    var ic = img.getContext('2d');
    var data = ic.createImageData(n, order.length);
    order.forEach(function (name, row) {
      var q98 = (function () {
        var v = DATA.series[name].casesSmooth.filter(function (x) { return x !== null; }).sort(function (a, b) { return a - b; });
        return v.length ? v[Math.floor(v.length * 0.98)] : 1;
      })();
      for (var d = 0; d < n; d++) {
        var v = sm(name, d);
        var t = v === null ? 0 : Math.sqrt(clamp(v / (q98 || 1), 0, 1));
        var col = seqColor(t);
        var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(col);
        var k = (row * n + d) * 4;
        data.data[k] = +m[1]; data.data[k + 1] = +m[2]; data.data[k + 2] = +m[3]; data.data[k + 3] = 255;
      }
    });
    ic.putImageData(data, 0, 0);
    var base = document.createElement('canvas');
    base.width = W; base.height = H;
    var c = base.getContext('2d');
    c.fillStyle = '#0b1624'; c.fillRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    c.drawImage(img, padL, padT, plotW, plotH);
    c.font = '10.5px "Microsoft YaHei",sans-serif';
    c.textAlign = 'right'; c.fillStyle = '#a9bdd2';
    order.forEach(function (name, row) {
      c.fillText(name.replace('市', ''), padL - 6, padT + (row + 0.62) * plotH / order.length);
    });
    c.textAlign = 'center'; c.fillStyle = '#7f95ad';
    for (var yr = 2015; yr <= 2019; yr++) {
      var idx = DATA.meta.dates.indexOf(yr + '-01-01');
      if (idx < 0) continue;
      var x = padL + idx / (n - 1) * plotW;
      c.fillStyle = 'rgba(140,170,200,.35)';
      c.fillRect(x, padT, 1, plotH);
      c.fillStyle = '#7f95ad';
      c.fillText(String(yr), x + 10, H - 6);
    }
    c.fillStyle = 'rgba(140,170,200,.25)';
    for (var r = 0; r <= order.length; r++) c.fillRect(padL, padT + r * plotH / order.length, plotW, 1);
    V2.stripBase = base;
    V2.stripOrder = order;
  }
  function drawStrip(ts) {
    var cv = $s('#ov-strip');
    if (!cv || !V2.stripBase) return;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(V2.stripBase, 0, 0);
    var padL = 58, padR = 10, padT = 8, padB = 22;
    var plotW = cv.width - padL - padR;
    var px = padL + state.idx / (nd() - 1) * plotW;
    c.strokeStyle = '#f4b942'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(px, padT - 4); c.lineTo(px, cv.height - padB + 4); c.stroke();
    c.fillStyle = '#f4b942';
    c.beginPath(); c.moveTo(px, padT - 8); c.lineTo(px - 5, padT - 15); c.lineTo(px + 5, padT - 15); c.closePath(); c.fill();
  }
  function buildStripRows() {
    var tb = $s('#ov-strip-rows');
    if (!tb) return;
    var html = '';
    V2X.seasonOrder.forEach(function (name) {
      html += '<tr data-city="' + name + '">' +
        '<td>' + name.replace('市', '') + '</td>' +
        '<td class="v-cur"></td><td class="v-d7"></td><td class="v-rate"></td><td class="v-peak">' + (V2X.seasonPeak[name] || '').slice(5) + '</td></tr>';
    });
    tb.innerHTML = html;
    tb.onclick = function (ev) {
      var tr = ev.target.closest('tr');
      if (tr) location.hash = '#/city/' + encodeURIComponent(tr.dataset.city);
    };
  }
  function updateStripRows() {
    var tb = $s('#ov-strip-rows');
    if (!tb) return;
    var rows = tb.querySelectorAll('tr');
    for (var k = 0; k < rows.length; k++) {
      var name = rows[k].dataset.city;
      var v = sm(name, state.idx), g = growthOf(name, state.idx), r = rateOf(name, state.idx);
      rows[k].querySelector('.v-cur').textContent = fmt(v, 1);
      var d7 = rows[k].querySelector('.v-d7');
      d7.textContent = (g === null ? '—' : (g >= 0 ? '+' : '') + fmt(g, 1));
      d7.style.color = g === null ? '' : (g >= 0 ? '#ff8a8a' : '#7fd4ff');
      rows[k].querySelector('.v-rate').textContent = fmt(r, 2);
    }
  }

  /* ---------- 3D 时空立方体（iframe 嵌入，父页时间轴驱动） ---------- */
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d && d.type === 'cubeReady' && state.view === '3d') sendCubeDay(true);
  });
  function sendCubeDay(force) {
    if (state.view !== '3d' || !refs.cubeFrame) return;
    var d = state.playing ? V2.displayIdx : state.idx;
    var key = Math.round(d * 4) / 4;
    if (!force && V2.cubeDay === key) return;
    V2.cubeDay = key;
    try { refs.cubeFrame.contentWindow.postMessage({ type: 'setDay', day: d }, '*'); } catch (e) {}
  }

  /* ---------- 传播粒子 ---------- */
  function growthCache() {
    if (!V2.growthCacheDay) V2.growthCacheDay = -1;
    if (V2.growthCacheDay === state.idx) return;
    V2.growthCacheDay = state.idx;
    V2.growth = {};
    DATA.meta.cities.forEach(function (c) { V2.growth[c.name] = growthOf(c.name, state.idx) || 0; });
  }
  function drawFlows(ts) {
    if (state.view !== 'map' || !state.flows) return;
    var cv = refs.mapCanvas;
    if (!cv || !MECH) return;
    var c = cv.getContext('2d');
    var scale = cv.width / geoCache.W;
    c.save(); c.scale(scale, scale);
    growthCache();
    var W = geoCache.W;
    var pairs = MECH.flowPairs, flow = MECH.flowDaily;
    if (!V2.pairMean) {
      V2.pairMean = pairs.map(function (_, pi) {
        var s = 0, n = 0;
        for (var d = 0; d < flow.length; d++) { if (flow[d] && flow[d][pi] !== null) { s += flow[d][pi]; n++; } }
        return n ? s / n : 0.22;
      });
      var lo = Math.min.apply(null, V2.pairMean), hi = Math.max.apply(null, V2.pairMean);
      V2.pairMean = V2.pairMean.map(function (v) { return (v - lo) / Math.max(1e-6, hi - lo); });
      V2.lead = {};
      (MECH.leadLag || []).forEach(function (x) {
        V2.lead[x.i + '|' + x.j] = x.lag;
        V2.lead[x.j + '|' + x.i] = -x.lag;
      });
    }
    pairs.forEach(function (pair, pi) {
      var a = geoCache.screen[pair[0]], b = geoCache.screen[pair[1]];
      if (!a || !b) return;
      var t = V2.pairMean[pi];
      c.strokeStyle = 'rgba(120,170,215,' + (0.18 + 0.28 * t) + ')';
      c.lineWidth = 1.0 + 2.4 * t;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      var lag = V2.lead[pair[0] + '|' + pair[1]] || 0;
      var forward = lag >= 0;
      var leader = forward ? pair[0] : pair[1];
      var gl = V2.growth[leader] || 0;
      if (gl <= 0.3) return;
      var nP = 1 + Math.round(clamp(gl / 3, 0, 1) * 2);
      for (var k = 0; k < nP; k++) {
        var phase = ((ts * 0.00012 * (35 + Math.abs(lag) * 6) + k / nP + pi * 0.17) % 1);
        var p0 = forward ? a : b, p1 = forward ? b : a;
        var x = p0[0] + (p1[0] - p0[0]) * phase;
        var y = p0[1] + (p1[1] - p0[1]) * phase;
        c.beginPath(); c.arc(x, y, 2.6 + t * 2, 0, Math.PI * 2);
        c.fillStyle = lag >= 0 ? 'rgba(255,150,130,' + (0.45 + t * 0.45) + ')' : 'rgba(120,200,255,' + (0.45 + t * 0.45) + ')';
        c.fill();
      }
    });
    // 变化脉冲（升/降）
    DATA.meta.cities.forEach(function (city) {
      var sc = geoCache.screen[city.name];
      var g = V2.growth[city.name] || 0;
      if (Math.abs(g) < 0.8) return;
      var v = sm(city.name, state.idx) || 0;
      var base = 8 + 18 * Math.sqrt(clamp(v / 20, 0, 1));
      var phase = (ts * 0.00035) % 1;
      var r = base + 6 + phase * 16;
      c.beginPath(); c.arc(sc[0], sc[1], r, 0, Math.PI * 2);
      c.strokeStyle = (g >= 0 ? 'rgba(255,95,109,' : 'rgba(76,201,240,') + (0.65 * (1 - phase)) + ')';
      c.lineWidth = 2.6; c.stroke();
    });
    c.restore();
  }

  /* ---------- 总览 ---------- */
  function renderOverview2() {
    if (state.view !== 'map' && (state.mode === 'rate' || state.mode === 'growth')) state.mode = 'cases';
    var page = $s('#page');
    var prov = V2X.province;
    page.innerHTML =
      '<div class="v2-story">' +
        '<div class="v2-story-txt"><div class="lab">核心结论</div>' +
          '<div class="txt" id="st-concl">2015→2019，山西流感样病例的年内峰值扩大了 ' + fmt(prov.peakRatio, 1) + ' 倍；' + prov.peakDate + ' 达到 ' + fmt(prov.peakValue, 1) + ' 例。</div>' +
        '</div>' +
        '<div class="v2-story-kpis" id="st-kpis">' +
          kpi('2019 峰值', fmt(prov.peakValue, 1) + ' 例', prov.peakDate) +
          kpi('较 2015 峰值', '×' + fmt(prov.peakRatio, 1), '2015 峰值 ' + fmt(V2X.province.yearPeak['2015'].value, 1) + ' 例') +
          kpi('当前全省', '—', '7 日平滑合计') +
          kpi('7 日变化', '—', '较 7 天前') +
        '</div>' +
        '<canvas id="st-curve" width="360" height="56"></canvas>' +
      '</div>' +
      '<div class="ov-grid">' +
        '<div>' +
          '<div class="panel">' +
            '<h2>山西省全景 <span class="sub" id="ov-sub"></span></h2>' +
            '<div class="tools" id="ov-tools">' +
              (state.view === '3d'
                ? viewButtons2() + '<span class="small muted" style="margin-left:8px">时空立方体：y 轴=时间 · 管径=病例 · 管色=增长率</span>'
                : modeButtons2() + viewButtons2() +
                  '<label class="small muted" style="display:flex;align-items:center;gap:6px;margin-left:6px"><input type="checkbox" id="ov-edges"' + (state.edges ? ' checked' : '') + '/> 接壤边</label>' +
                  '<label class="small muted" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ov-flows"' + (state.flows ? ' checked' : '') + '/> 传播粒子</label>')
            + '</div>' +
            '<div class="map-wrap" id="map-wrap"></div>' +
            '<div class="legend" id="ov-legend">' + legendHTML(state.mode) + '</div>' +
            '<div class="anim-note"><span id="ov-note"></span><span>圆环脉冲 = 7 日变化（红升蓝降）· 粒子方向 = 数据滞后相关（非因果）</span></div>' +
          '</div>' +
          '<div class="panel" style="margin-top:16px">' +
            '<h2>全省前 20 天（拟合输入窗口） <span class="sub" id="ov-win-sub"></span></h2>' +
            '<div class="chart-legend" id="ov-chart-legend"></div><div class="chart-wrap" id="ov-chart"></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="panel">' +
            '<h2>11 城 × 5 年 <span class="sub">行序 = 2018–19 季峰值日期（最早在上）</span></h2>' +
            '<canvas id="ov-strip" width="560" height="300" style="width:100%;height:auto;border-radius:8px"></canvas>' +
            '<div class="v2-strip-note">颜色 = 7 日平滑病例（各行独立归一）；竖线 = 当前日期；点击城市进入详情。</div>' +
            '<div style="overflow:auto;margin-top:8px"><table class="city-table v2-table"><thead><tr><th>城市</th><th>当前</th><th>7 日变化</th><th>发病率</th><th>峰值日</th></tr></thead><tbody id="ov-strip-rows"></tbody></table></div>' +
          '</div>' +
          '<div class="panel" style="margin-top:16px">' +
            '<h2>模型表现 <span class="sub">测试集口径（132 个城×步长单元格等权）</span></h2>' +
            '<div class="v2-model-cards">' +
              '<div class="v2-kpi"><div class="k">原始 RMSE</div><div class="v">2.1611</div><div class="s">比持续性差 1.8%</div></div>' +
              '<div class="v2-kpi"><div class="k">校准后 RMSE</div><div class="v">2.0125</div><div class="s">比持续性好 5.2%</div></div>' +
              '<div class="v2-kpi"><div class="k">持续性基线</div><div class="v">2.1225</div><div class="s">零参数参照</div></div>' +
              '<div class="v2-kpi"><div class="k">总体 PCC</div><div class="v">0.8143</div><div class="s">15 种子集成</div></div>' +
            '</div>' +
            '<div class="small muted" style="margin-top:8px">预测扇形与逐城误差在city页；机理数据（β/C）在 mech_data 中，后续接模型页。</div>' +
          '</div>' +
          '<div class="panel" style="margin-top:16px"><h2>天气动画图例</h2><div id="ov-anim-legend"></div></div>' +
        '</div>' +
      '</div>';
    refs = {};
    refs.mapWrap = $s('#map-wrap');
    refs.legend = $s('#ov-legend'); refs.note = $s('#ov-note'); refs.sub = $s('#ov-sub');
    refs.provChart = $s('#ov-chart'); refs.provLegend = $s('#ov-chart-legend'); refs.winSub = $s('#ov-win-sub');
    // 事件
    $s('#ov-tools').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-mode]');
      if (b) { state.mode = b.getAttribute('data-mode'); if (state.view !== 'map') state.view = 'map'; renderOverview2(); return; }
      var v = ev.target.closest('button[data-view]');
      if (v) { state.view = v.getAttribute('data-view'); renderOverview2(); return; }
    });
    var eb = $s('#ov-edges');
    if (eb) eb.addEventListener('change', function () { state.edges = this.checked; if (refs.edgeGroup) refs.edgeGroup.style.display = state.edges ? '' : 'none'; });
    var fb = $s('#ov-flows');
    if (fb) fb.addEventListener('change', function () { state.flows = this.checked; });
    // 图例/动画图例
    var lg = '<div class="anim-legend">';
    RAIN_LEVELS.forEach(function (l) { lg += '<div class="anim-row"><span class="lv ' + l.cls + '">' + l.name + '</span><span class="muted">' + l.range + '</span></div>'; });
    lg += '</div>';
    $s('#ov-anim-legend').innerHTML = lg;
    // 地图/网络/3D
    if (state.view === 'map') {
      buildMap();
    } else if (state.view === 'network') {
      buildNetwork();
    } else {
      var wrap3 = refs.mapWrap;
      wrap3.innerHTML = '';
      var fr = document.createElement('iframe');
      fr.id = 'cube-frame';
      fr.src = 'design/proto3d_v2.html?embed=1';
      fr.style.cssText = 'display:block;width:100%;height:560px;border:0;border-radius:12px;background:#050a12;';
      fr.addEventListener('load', function () {
        V2.cubeDay = null; sendCubeDay(true);
        setTimeout(function () { sendCubeDay(true); }, 400);
        setTimeout(function () { sendCubeDay(true); }, 1200);
        setTimeout(function () { sendCubeDay(true); }, 2600);
      });
      wrap3.appendChild(fr);
      refs.cubeFrame = fr;
      if (refs.legend) refs.legend.innerHTML = '<span class="v2-ramp div"></span><span class="small muted">管径 = 7 日平滑病例；管色 = 14 日增长率（蓝=下降 → 红=上升）</span>';
      sendCubeDay(true);
    }
    buildStoryBase();
    buildStripBase();
    buildStripRows();
    updateFull();
    updateFast();
  }

  /* ---------- 更新 ---------- */
  function updateFast() {
    // 地图填色/标签
    if (refs.paths) {
      DATA.meta.cities.forEach(function (c) {
        var v = modeVal(state.mode, c.name, state.idx);
        if (refs.paths[c.name]) refs.paths[c.name].setAttribute('fill', colorFor(state.mode, v));
        if (refs.labels && refs.labels[c.name]) refs.labels[c.name].textContent = c.short + ' ' + fmtVal(state.mode, v);
      });
    }
    if (refs.nodes) {
      var q99n = (DATA.meta.stats.casesSmooth.q99 || 20);
      DATA.meta.cities.forEach(function (c) {
        var vv = sm(c.name, state.idx) || 0;
        var rr = 8 + 15 * Math.sqrt(clamp(vv / q99n, 0, 1));
        refs.nodes[c.name].dot.setAttribute('r', rr);
        refs.nodes[c.name].halo.setAttribute('r', rr + 7);
        refs.nodes[c.name].dot.setAttribute('fill', colorFor(state.mode, modeVal(state.mode, c.name, state.idx)));
      });
    }
    if (refs.sub) refs.sub.textContent = dateAt(state.idx) + ' ' + dowName(state.idx) + (state.view === '3d' ? ' · 时空立方体' : ' · ' + ((MODES2.filter(function (m) { return m.id === state.mode; })[0] || {}).name || ''));
    // KPI
    var total = provSum(state.idx);
    var prev = provSum(Math.max(0, state.idx - 7));
    var growth = total - prev;
    var kpis = $s('#st-kpis');
    if (kpis) {
      var cells = kpis.querySelectorAll('.v2-kpi .v');
      var subs = kpis.querySelectorAll('.v2-kpi .s');
      cells[2].textContent = fmt(total, 1) + ' 例';
      subs[2].textContent = dateAt(state.idx);
      cells[3].innerHTML = '<span style="color:' + (growth >= 0 ? '#ff8a8a' : '#7fd4ff') + '">' + (growth >= 0 ? '+' : '') + fmt(growth, 1) + '</span>';
      subs[3].textContent = '较 ' + dateAt(Math.max(0, state.idx - 7));
    }
    drawStory(0);
    drawStrip(0);
    updateStripRows();
    sendCubeDay(false);
    // 顶部提示
    if (refs.note) {
      var maxP = { v: -1, c: '' };
      DATA.meta.cities.forEach(function (c) { var p = gv(c.name, 'precip', state.idx) || 0; if (p > maxP.v) { maxP.v = p; maxP.c = c.name; } });
      var lv = rainLevel(maxP.v);
      if (state.view === '3d') {
        refs.note.innerHTML = '时空立方体：y 轴 = 时间（2015→2019）· 拖动旋转 · 滚轮缩放 · 时间由上方时间轴/播放控制';
      } else {
        refs.note.textContent = '当日最大降水：' + (maxP.v > 0.1 ? maxP.c + ' ' + fmt(maxP.v, 1) + ' mm（' + RAIN_LEVELS[lv].name + '）' : '全省无降水');
      }
    }
  }
  function updateFull() {
    if (!refs.provChart) return;
    var start = Math.max(0, state.idx - 19);
    var dates = DATA.meta.dates.slice(start, state.idx + 1);
    var pr = DATA.meta.province;
    var rawS = pr.casesRawSum.slice(start, state.idx + 1);
    var smS = pr.casesSmoothSum.slice(start, state.idx + 1);
    if (refs.winSub) refs.winSub.textContent = dates[0] + ' ~ ' + dates[dates.length - 1] + '（W = 20 天）';
    if (refs.provLegend) refs.provLegend.innerHTML = '<span><i style="background:rgba(96,165,250,.55)"></i>原始合计</span><span><i style="background:#38bdf8"></i>7 日平滑合计</span>';
    renderChart(refs.provChart, {
      dates: dates, width: 980, height: 240, yFmt: function (v) { return fmt(v, 0); },
      series: [
        { type: 'bar', data: rawS, color: 'rgba(96,165,250,.4)' },
        { type: 'line', data: smS, color: '#38bdf8', width: 2.4 }
      ],
      sel: dates.length - 1,
      tip: function (k) { return '<b>' + dates[k] + '</b><br/>原始合计 ' + fmt(rawS[k], 0) + ' 例<br/>平滑合计 ' + fmt(smS[k], 1) + ' 例'; }
    });
  }

  /* ---------- 主循环 ---------- */
  function tick2(ts) {
    if (!DATA) { requestAnimationFrame(tick2); return; }
    if (!V2.inited) { V2.displayIdx = state.idx; V2.inited = true; }
    var dt = V2.lastTs ? Math.min(100, ts - V2.lastTs) : 16;
    V2.lastTs = ts;
    if (state.playing) {
      V2.displayIdx += dt / 1000 * state.speed;
      if (V2.displayIdx >= nd() - 1) { V2.displayIdx = nd() - 1; state.playing = false; updateTimebar(); }
      var ni = clamp(Math.round(V2.displayIdx), 0, nd() - 1);
      if (ni !== state.idx) {
        state.idx = ni; updateTimebar();
        if (!state.city) updateFast();
      }
    }
    if (state.city) {
      if (state.idx !== V2.lastCityIdx && ts - (V2.lastCityTs || 0) > 110) {
        V2.lastCityIdx = state.idx; V2.lastCityTs = ts; updateCityDynamic();
      }
    } else if (state.idx !== V2.lastFullIdx) {
      V2.lastFullIdx = state.idx; updateFull();
    }
    if (state.view === '3d') sendCubeDay(false);
    if (state.weather !== false) drawMapWeather(ts);
    drawFlows(ts);
    drawCityWeather(ts);
    if (typeof draw3D === 'function') draw3D(ts);
    requestAnimationFrame(tick2);
  }

  /* ---------- 时间控件覆盖 ---------- */
  window.setIdx = function (i) {
    i = clamp(Math.round(i), 0, nd() - 1);
    V2.displayIdx = i;
    state.idx = i;
    updateTimebar();
    if (state.city) updateCityDynamic(); else { updateFast(); updateFull(); }
  };
  window.togglePlay = function () {
    state.playing = !state.playing;
    if (state.playing && state.idx >= nd() - 1) { state.idx = 0; V2.displayIdx = 0; }
    updateTimebar();
  };

  /* ---------- 城市页扩展 ---------- */
  function addCityExtras(name) {
    var grid = $s('.city-grid');
    if (!grid || $s('#v2-city-extras')) return;
    var right = grid.children[1];
    if (!right) return;
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.marginTop = '16px';
    panel.id = 'v2-city-extras';
    panel.innerHTML =
      '<h2>模型与邻城 <span class="sub">15 种子预测轨道 · 邻城对照 · β 时序</span></h2>' +
      '<div class="chart-legend" id="v2-fan-legend"></div><div class="chart-wrap" id="v2-fan-chart"></div>' +
      '<div class="chart-legend" style="margin-top:10px" id="v2-neigh-legend"></div><div class="chart-wrap" id="v2-neigh-chart"></div>' +
      '<div class="chart-legend" style="margin-top:10px" id="v2-beta-legend"></div><div class="chart-wrap" id="v2-beta-chart"></div>' +
      '<div class="small muted" style="margin-top:8px">扇形 = 15 个种子的逐日预测范围（训练随机性，不是置信区间）；β = 模型内部相对强度（非流行病学传播率）；邻城均值按接壤边等权。</div>';
    var lastPanel = right.lastElementChild;
    if (lastPanel) right.insertBefore(panel, lastPanel); else right.appendChild(panel);
  }
  function updateCityExtras(name) {
    if (!$s('#v2-fan-chart') || !MECH) return;
    var testDates = MECH.testDates;
    var ci = DATA.meta.cities.map(function (c) { return c.name; }).indexOf(name);
    if (!V2.fanSel) V2.fanSel = -1;
    var sel = testDates.indexOf(dateAt(state.idx));
    var truth = (typeof FIT !== 'undefined' && FIT && FIT.series[name]) ? FIT.series[name].true : null;
    var fanP10 = MECH.fan.p10.map(function (r) { return r[ci]; });
    var fanP50 = MECH.fan.p50.map(function (r) { return r[ci]; });
    var fanP90 = MECH.fan.p90.map(function (r) { return r[ci]; });
    $s('#v2-fan-legend').innerHTML = '<span><i style="background:rgba(244,185,66,.35)"></i>P10–P90（15 种子）</span><span><i style="background:#f4b942"></i>种子中位</span><span><i style="background:#cbd5e1"></i>真实</span>';
    renderChart($s('#v2-fan-chart'), {
      dates: testDates, width: 520, height: 200, yFmt: function (v) { return fmt(v, 1); },
      series: [
        { type: 'band', upper: fanP90, lower: fanP10, color: 'rgba(244,185,66,0.28)' },
        { type: 'line', data: fanP50, color: '#f4b942', width: 1.8 },
        { type: 'line', data: truth, color: '#cbd5e1', width: 1.2, dash: '3 3' }
      ],
      sel: sel >= 0 ? sel : null,
      tip: function (k) { return '<b>' + testDates[k] + '</b><br/>P10 ' + fmt(fanP10[k], 1) + ' · P50 ' + fmt(fanP50[k], 1) + ' · P90 ' + fmt(fanP90[k], 1); }
    });
    // 邻城对照
    var start = Math.max(0, state.idx - 119);
    var dates = DATA.meta.dates.slice(start, state.idx + 1);
    var city = CITY[name];
    var myArr = [], neighArr = [], provArr = [];
    for (var i = start; i <= state.idx; i++) {
      myArr.push(sm(name, i));
      var s = 0, n = 0;
      city.neighbors.forEach(function (nn) { var v = sm(nn, i); if (v !== null) { s += v; n++; } });
      neighArr.push(n ? s / n : null);
      var ps = 0, pn = 0;
      DATA.meta.cities.forEach(function (c) { var v = sm(c.name, i); if (v !== null) { ps += v; pn++; } });
      provArr.push(pn ? ps / pn : null);
    }
    $s('#v2-neigh-legend').innerHTML = '<span><i style="background:#38bdf8"></i>' + name.replace('市', '') + '</span><span><i style="background:#f472b6"></i>邻城均值</span><span><i style="background:#94a3b8"></i>全省均值</span>';
    renderChart($s('#v2-neigh-chart'), {
      dates: dates, width: 520, height: 190, yFmt: function (v) { return fmt(v, 1); },
      series: [
        { type: 'line', data: provArr, color: '#94a3b8', width: 1.3 },
        { type: 'line', data: neighArr, color: '#f472b6', width: 1.5 },
        { type: 'line', data: myArr, color: '#38bdf8', width: 2.2 }
      ],
      sel: dates.length - 1,
      tip: function (k) { return '<b>' + dates[k] + '</b><br/>本城 ' + fmt(myArr[k], 1) + '<br/>邻城均值 ' + fmt(neighArr[k], 1); }
    });
    // β 曲线
    var bstart = Math.max(0, state.idx - 364);
    var bdates = DATA.meta.dates.slice(bstart, state.idx + 1);
    var beta = MECH.betaH1 ? MECH.betaH1.map(function (row) { return row ? row[DATA.meta.cities.map(function (c) { return c.name; }).indexOf(name)] : null; }) : [];
    var bArr = beta.slice(bstart, state.idx + 1);
    $s('#v2-beta-legend').innerHTML = '<span><i style="background:#a78bfa"></i>β(t)（模型内部相对强度，近 365 天）</span>';
    renderChart($s('#v2-beta-chart'), {
      dates: bdates, width: 520, height: 160, yFmt: function (v) { return fmt(v, 2); },
      series: [{ type: 'line', data: bArr, color: '#a78bfa', width: 1.8 }],
      sel: bdates.length - 1,
      tip: function (k) { return bdates[k] + '<br/>β ' + fmt(bArr[k], 3); }
    });
  }
  var origRenderCity = window.renderCity;
  window.renderCity = function (name) {
    origRenderCity(name);
    addCityExtras(name);
    updateCityExtras(name);
  };
  var origUpdateCity = window.updateCityDynamic;
  window.updateCityDynamic = function () {
    origUpdateCity();
    if (state.city) updateCityExtras(state.city);
  };

  /* ---------- 覆盖主函数 ---------- */
  window.renderOverview = renderOverview2;
  window.updateOverviewDynamic = function () { updateFast(); updateFull(); };
  window.tick = tick2;
  window.V2 = V2;
  // 初始化 state 扩展
  window.addEventListener('DOMContentLoaded', function () {
    if (state.weather === undefined) state.weather = true;
    if (state.flows === undefined) state.flows = true;
    try {
      var q = new URLSearchParams(location.search);
      if (!q.get('mode')) state.mode = 'rate';
    } catch (e) { state.mode = 'rate'; }
  });
})();
