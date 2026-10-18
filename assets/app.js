'use strict';
/* ============================================================
   WMEG-Net 山西省可视化 · 单页应用
   数据：data/app_data.json（原始病例/平滑病例/气象）、data/geo.json（行政边界）
   ============================================================ */
var DATA = null, GEO = null, FIT = null, MECH = null, V2X = null;
var CITY = {};            // name -> meta city
var SERIES = {};          // name -> series
var state = {
  idx: 0,                 // 0..1825
  mode: 'cases',          // cases | precip | tavg | rh
  view: 'map',            // map | network
  playing: false,
  speed: 5,
  city: null,
  edges: true,
  ctxRange: 120
};
var refs = {};            // 当前页面的 DOM 引用
var geoCache = null;
var animLast = 0, animAcc = 0;
var RAIN_LEVELS = [
  { name: '无降水', range: '0 mm', cls: 'lv0' },
  { name: '小雨', range: '0.1–2 mm', cls: 'lv1' },
  { name: '中雨', range: '2–5 mm', cls: 'lv2' },
  { name: '大雨', range: '5–10 mm', cls: 'lv3' },
  { name: '暴雨', range: '10–25 mm', cls: 'lv4' },
  { name: '大暴雨', range: '>25 mm', cls: 'lv5' }
];
var SVGNS = 'http://www.w3.org/2000/svg';

/* ---------- 基础工具 ---------- */
function $(sel) { return document.querySelector(sel); }
function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined && html !== null) e.innerHTML = html;
  return e;
}
function sEl(tag, attrs) {
  var e = document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function fmt(v, d) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(d === undefined ? 1 : d);
}
function fmtInt(v) { return v === null || v === undefined ? '—' : String(Math.round(v)); }
function dateAt(i) { return DATA.meta.dates[clamp(i, 0, DATA.meta.ndays - 1)]; }
function idxOf(str) { return DATA.meta.dates.indexOf(str); }
function dowName(i) {
  var d = new Date(DATA.meta.dates[i] + 'T00:00:00');
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
}
function gv(name, key, i) {
  var arr = SERIES[name][key];
  return (arr && i >= 0 && i < arr.length) ? arr[i] : null;
}
function rainLevel(p) {
  if (p === null || p === undefined) return 0;
  if (p <= 0.1) return 0;
  if (p <= 2) return 1;
  if (p <= 5) return 2;
  if (p <= 10) return 3;
  if (p <= 25) return 4;
  return 5;
}
function rainStrength(p) { return clamp(Math.sqrt(Math.max(0, p || 0) / 25), 0, 1); }
function tempColor(t) {
  if (t === null) return '#1b2b41';
  var x = clamp((t + 20) / 52, 0, 1);
  var cold = [12, 34, 62], mid = [22, 62, 92], warm = [122, 64, 24];
  var a, b, u;
  if (x < 0.55) { a = cold; b = mid; u = x / 0.55; }
  else { a = mid; b = warm; u = (x - 0.55) / 0.45; }
  return 'rgb(' + Math.round(lerp(a[0], b[0], u)) + ',' + Math.round(lerp(a[1], b[1], u)) + ',' + Math.round(lerp(a[2], b[2], u)) + ')';
}
function modeColor(mode, v) {
  if (v === null || v === undefined) return '#22344b';
  var t;
  if (mode === 'cases') t = clamp(Math.sqrt(Math.max(0, v) / 18), 0, 1);
  else if (mode === 'precip') t = clamp(Math.sqrt(Math.max(0, v) / 25), 0, 1);
  else if (mode === 'tavg') t = clamp((v + 20) / 52, 0, 1);
  else t = clamp(v / 100, 0, 1);
  var stops = {
    cases:  [[30,58,138],[14,116,144],[13,148,136],[101,163,13],[202,138,4],[220,38,38]],
    precip: [[30,41,59],[30,58,138],[14,116,144],[37,99,235],[99,179,237],[186,230,253]],
    tavg:   [[30,58,138],[56,132,189],[110,190,190],[250,204,21],[249,115,22],[239,68,68]],
    rh:     [[17,94,89],[13,148,136],[34,197,94],[163,230,53],[250,204,21],[249,115,22]]
  }[mode];
  var pos = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(pos)), u = pos - i;
  var a = stops[i], b = stops[i + 1];
  return 'rgb(' + Math.round(lerp(a[0],b[0],u)) + ',' + Math.round(lerp(a[1],b[1],u)) + ',' + Math.round(lerp(a[2],b[2],u)) + ')';
}
function modeValue(name, i) {
  if (state.mode === 'cases') return gv(name, 'casesSmooth', i);
  if (state.mode === 'precip') return gv(name, 'precip', i);
  if (state.mode === 'tavg') return gv(name, 'tavg', i);
  return gv(name, 'rh', i);
}
function modeFmt(v, mode) {
  if (v === null || v === undefined) return '—';
  if (mode === 'cases') return fmt(v, 1) + ' 例';
  if (mode === 'precip') return fmt(v, 1) + ' mm';
  if (mode === 'tavg') return fmt(v, 1) + ' °C';
  return fmt(v, 0) + ' %';
}
function modeName(mode) {
  return { cases: '平滑病例', precip: '降水量', tavg: '日均气温', rh: '相对湿度' }[mode];
}

/* ---------- 地图几何 ---------- */
function walkCoords(coords, fn) {
  if (!coords) return;
  if (typeof coords[0] === 'number') { fn(coords[0], coords[1]); return; }
  for (var i = 0; i < coords.length; i++) walkCoords(coords[i], fn);
}
function ringPath(ring) {
  var d = '';
  for (var i = 0; i < ring.length; i++) {
    var p = geoCache.proj(ring[i][0], ring[i][1]);
    d += (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
  }
  return d + 'Z';
}
function buildGeo() {
  var minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
  GEO.features.forEach(function (f) {
    walkCoords(f.geometry.coordinates, function (lon, lat) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    });
  });
  var W = 1000, H = 660, pad = 46;
  geoCache = { W: W, H: H, paths: {}, screen: {}, bbox: {} };
  geoCache.proj = function (lon, lat) {
    var x = pad + (lon - minLon) / (maxLon - minLon) * (W - 2 * pad);
    var y = H - pad - (lat - minLat) / (maxLat - minLat) * (H - 2 * pad);
    return [x, y];
  };
  GEO.features.forEach(function (f) {
    var name = f.properties.name;
    var polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    var d = '', minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    polys.forEach(function (poly) {
      poly.forEach(function (ring) {
        d += ringPath(ring);
        ring.forEach(function (pt) {
          var p = geoCache.proj(pt[0], pt[1]);
          if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        });
      });
    });
    geoCache.paths[name] = d;
    geoCache.bbox[name] = [minX, minY, maxX - minX, maxY - minY];
  });
  DATA.meta.cities.forEach(function (c) {
    geoCache.screen[c.name] = geoCache.proj(c.lon, c.lat);
  });
}

/* ---------- 图表（SVG 折线/柱状 + tooltip） ---------- */
function renderChart(container, cfg) {
  if (!container) return;
  container.innerHTML = '';
  var W = cfg.width || 980, H = cfg.height || 240;
  var m = { l: 52, r: 18, t: 16, b: 28 };
  var n = cfg.dates ? cfg.dates.length : 0;
  if (!n) return;
  var plotW = W - m.l - m.r, plotH = H - m.t - m.b;
  var svg = sEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart-svg' });
  container.appendChild(svg);
  // 值域
  var vals = [];
  (cfg.series || []).forEach(function (s) {
    if (s.type === 'band') {
      (s.upper || []).forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) vals.push(v); });
      (s.lower || []).forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) vals.push(v); });
      return;
    }
    (s.data || []).forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) vals.push(v); });
  });
  if (!vals.length) return;
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if (mn > 0) mn = 0;
  var pad = (mx - mn) * 0.1 || 1;
  mx += pad;
  var x = function (i) { return m.l + (n <= 1 ? 0 : i / (n - 1) * plotW); };
  var y = function (v) { return m.t + plotH - (v - mn) / (mx - mn) * plotH; };
  // 背景带（训练/验证/测试）
  (cfg.bands || []).forEach(function (b) {
    var f = Math.max(0, b.from), t = Math.min(n - 1, b.to);
    if (t < 0 || f > n - 1 || t < f) return;
    var x0 = x(f), x1 = x(t);
    svg.appendChild(sEl('rect', { x: x0, y: m.t, width: Math.max(1, x1 - x0), height: plotH, fill: b.color }));
    if (b.label && (x1 - x0) > 56) {
      var lb = sEl('text', { x: x0 + 4, y: m.t + 12, 'font-size': 10, fill: '#7c93ad' });
      lb.textContent = b.label;
      svg.appendChild(lb);
    }
  });
  // 网格与 y 轴
  var ticks = 4;
  for (var t = 0; t <= ticks; t++) {
    var v = mn + (mx - mn) * t / ticks;
    var yy = y(v);
    svg.appendChild(sEl('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, stroke: '#22344b', 'stroke-width': 1, 'stroke-dasharray': t === 0 ? '' : '2 4' }));
    var tx = sEl('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8fa3bb' });
    tx.textContent = cfg.yFmt ? cfg.yFmt(v) : fmt(v, 1);
    svg.appendChild(tx);
  }
  // 输入窗口阴影
  if (cfg.window && cfg.window.length === 2) {
    var wx0 = x(cfg.window[0]), wx1 = x(cfg.window[1]);
    svg.appendChild(sEl('rect', { x: wx0, y: m.t, width: Math.max(1, wx1 - wx0), height: plotH, fill: 'rgba(250,204,21,0.10)', stroke: 'rgba(250,204,21,0.45)', 'stroke-dasharray': '3 3' }));
    var wl = sEl('text', { x: wx0 + 4, y: m.t + plotH - 6, 'font-size': 10, fill: '#eab308' });
    wl.textContent = '输入窗口 20 天';
    svg.appendChild(wl);
  }
  // 序列
  (cfg.series || []).forEach(function (s) {
    if (s.type === 'bar') {
      var bw = Math.max(1, plotW / n * 0.62);
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined || isNaN(v)) return;
        var yy = y(Math.max(0, v));
        var hgt = Math.max(0, m.t + plotH - yy);
        svg.appendChild(sEl('rect', { x: x(i) - bw / 2, y: yy, width: bw, height: hgt, fill: s.color, rx: Math.min(2, bw / 2) }));
      });
    } else if (s.type === 'band') {
      var up = '', lo = '', startedB = false;
      for (var bi = 0; bi < n; bi++) {
        var uv = s.upper[bi], lv = s.lower[bi];
        if (uv === null || uv === undefined || isNaN(uv) || lv === null || lv === undefined || isNaN(lv)) continue;
        up += (startedB ? 'L' : 'M') + x(bi).toFixed(2) + ' ' + y(uv).toFixed(2) + ' ';
        startedB = true;
      }
      for (var bj = n - 1; bj >= 0; bj--) {
        var lv2 = s.lower[bj], uv2 = s.upper[bj];
        if (lv2 === null || lv2 === undefined || isNaN(lv2) || uv2 === null || uv2 === undefined || isNaN(uv2)) continue;
        lo += 'L' + x(bj).toFixed(2) + ' ' + y(lv2).toFixed(2) + ' ';
      }
      svg.appendChild(sEl('path', { d: up + lo + 'Z', fill: s.color, opacity: s.opacity || 0.25, stroke: 'none' }));
    } else {
      var d = '', started = false;
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined || isNaN(v)) { started = false; return; }
        d += (started ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(v).toFixed(2) + ' ';
        started = true;
      });
      svg.appendChild(sEl('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || '' }));
      if (s.dots) s.data.forEach(function (v, i) { if (v !== null && v !== undefined && !isNaN(v)) svg.appendChild(sEl('circle', { cx: x(i), cy: y(v), r: 2.4, fill: s.color })); });
    }
  });
  // x 轴标签
  var nlab = Math.min(7, n);
  for (var k = 0; k < nlab; k++) {
    var i = Math.round(k / (nlab - 1) * (n - 1));
    var lb2 = sEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#8fa3bb' });
    lb2.textContent = cfg.xFmt ? cfg.xFmt(cfg.dates[i], n) : String(cfg.dates[i]).slice(5);
    svg.appendChild(lb2);
  }
  // 选中日期竖线
  if (cfg.sel !== undefined && cfg.sel !== null) {
    var sx = x(clamp(cfg.sel, 0, n - 1));
    svg.appendChild(sEl('line', { x1: sx, x2: sx, y1: m.t, y2: m.t + plotH, stroke: '#f472b6', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }));
  }
  // 悬浮交互
  var tip = el('div', 'chart-tip');
  container.appendChild(tip);
  var hover = sEl('rect', { x: m.l, y: m.t, width: plotW, height: plotH, fill: 'transparent' });
  svg.appendChild(hover);
  var vline = sEl('line', { x1: 0, x2: 0, y1: m.t, y2: m.t + plotH, stroke: '#cbd5e1', 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: 0 });
  svg.appendChild(vline);
  hover.addEventListener('mousemove', function (ev) {
    var rect = svg.getBoundingClientRect();
    var px = (ev.clientX - rect.left) / rect.width * W;
    var i = Math.round((px - m.l) / plotW * (n - 1));
    i = clamp(i, 0, n - 1);
    vline.setAttribute('x1', x(i)); vline.setAttribute('x2', x(i)); vline.setAttribute('opacity', 0.75);
    tip.innerHTML = cfg.tip ? cfg.tip(i) : String(cfg.dates[i]);
    tip.style.opacity = 1;
    tip.style.left = Math.min(rect.width - 150, Math.max(6, (x(i) / W) * rect.width + 12)) + 'px';
    tip.style.top = Math.max(4, ev.clientY - rect.top - 40) + 'px';
  });
  hover.addEventListener('mouseleave', function () { tip.style.opacity = 0; vline.setAttribute('opacity', 0); });
}


/* ---------- 时间轴 ---------- */
function buildTimebar() {
  var bar = $('#timebar');
  bar.innerHTML =
    '<div class="date-label" id="tb-date">2015-01-01<span class="week">周四</span></div>' +
    '<button class="btn primary" id="tb-play">▶ 播放</button>' +
    '<button class="btn" id="tb-prev">◀ 前一天</button>' +
    '<button class="btn" id="tb-next">后一天 ▶</button>' +
    '<input type="range" id="tb-range" min="0" max="1825" value="0" step="1"/>' +
    '<input type="date" id="tb-input" min="2015-01-01" max="2019-12-31" value="2015-01-01"/>' +
    '<div class="sep"></div>' +
    '<div class="speed">速度<select id="tb-speed">' +
      '<option value="2">2 天/秒</option><option value="5" selected>5 天/秒</option><option value="10">10 天/秒</option><option value="20">20 天/秒</option>' +
    '</select></div>' +
    '<button class="btn" id="tb-flu">跳到流感季</button>';
  $('#tb-range').addEventListener('input', function () { setIdx(parseInt(this.value, 10)); });
  $('#tb-play').addEventListener('click', function () { togglePlay(); });
  $('#tb-prev').addEventListener('click', function () { setIdx(state.idx - 1); });
  $('#tb-next').addEventListener('click', function () { setIdx(state.idx + 1); });
  $('#tb-input').addEventListener('change', function () { var i = idxOf(this.value); if (i >= 0) setIdx(i); });
  $('#tb-speed').addEventListener('change', function () { state.speed = parseFloat(this.value); });
  $('#tb-flu').addEventListener('click', function () { var i = idxOf('2019-01-15'); if (i >= 0) setIdx(i); });
  document.addEventListener('keydown', function (ev) {
    if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key === 'ArrowLeft') { setIdx(state.idx - 1); ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { setIdx(state.idx + 1); ev.preventDefault(); }
    if (ev.key === ' ') { togglePlay(); ev.preventDefault(); }
  });
}
function updateTimebar() {
  var d = dateAt(state.idx);
  var lbl = $('#tb-date'); if (lbl) lbl.innerHTML = d + '<span class="week">' + dowName(state.idx) + '</span>';
  var r = $('#tb-range'); if (r) r.value = state.idx;
  var inp = $('#tb-input'); if (inp) inp.value = d;
  var btn = $('#tb-play'); if (btn) btn.innerHTML = state.playing ? '❚❚ 暂停' : '▶ 播放';
}
function setIdx(i) {
  i = clamp(Math.round(i), 0, DATA.meta.ndays - 1);
  if (i === state.idx) return;
  state.idx = i;
  updateTimebar();
  refreshDynamic();
}
function togglePlay() {
  state.playing = !state.playing;
  updateTimebar();
  if (state.playing && state.idx >= DATA.meta.ndays - 1) state.idx = 0;
}
function refreshDynamic() {
  if (state.city) updateCityDynamic(); else updateOverviewDynamic();
}

/* ---------- 主循环 ---------- */
function tick(ts) {
  var dt = animLast ? Math.min(120, ts - animLast) : 16;
  animLast = ts;
  if (state.playing) {
    animAcc += dt;
    var interval = 1000 / state.speed;
    var guard = 0;
    while (animAcc >= interval && guard < 40) {
      animAcc -= interval; guard++;
      if (state.idx >= DATA.meta.ndays - 1) { state.playing = false; updateTimebar(); break; }
      state.idx += 1;
      updateTimebar();
      refreshDynamic();
    }
  }
  drawMapWeather(ts);
  drawCityWeather(ts);
  if (typeof draw3D === 'function') draw3D(ts);
  requestAnimationFrame(tick);
}

/* ---------- 路由 ---------- */
function shortToFull(s) {
  if (CITY[s]) return s;
  return s + '市';
}
function route() {
  var h = location.hash || '#/';
  var m = h.match(/^#\/city\/(.+)$/);
  if (m) {
    var name = decodeURIComponent(m[1]);
    name = shortToFull(name);
    if (!CITY[name]) { location.hash = '#/'; return; }
    state.city = name;
    renderCity(name);
  } else {
    state.city = null;
    renderOverview();
  }
  window.scrollTo(0, 0);
}

/* ---------- 初始化 ---------- */
function boot() {
  var d = DATA, g = GEO;
  SERIES = d.series;
  d.meta.cities.forEach(function (c) { CITY[c.name] = c; });
  buildGeo();
  buildTimebar();
  var _defaultDate = '2019-01-15';
  if (V2X && V2X.province && V2X.province.peakDate) _defaultDate = V2X.province.peakDate;
  var i = idxOf(_defaultDate); state.idx = i >= 0 ? i : 0;
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('date')) { var qi = idxOf(qs.get('date')); if (qi >= 0) state.idx = qi; }
    var qm = qs.get('mode');
    if (qm === 'cases' || qm === 'precip' || qm === 'tavg' || qm === 'rh') state.mode = qm;
    if (qs.get('view') === 'network') state.view = 'network';
    if (qs.get('view') === '3d') state.view = '3d';
    if (qs.get('edges') === '0') state.edges = false;
    if (qs.get('play') === '1') state.playing = true;
    if (qs.get('city')) location.hash = '#/city/' + encodeURIComponent(shortToFull(qs.get('city')));
  } catch (e) {}
  updateTimebar();
  window.addEventListener('hashchange', route);
  route();
  requestAnimationFrame(tick);
}
window.addEventListener('DOMContentLoaded', function () {
  Promise.all([
    fetch('data/app_data.json').then(function (r) { return r.json(); }),
    fetch('data/geo.json').then(function (r) { return r.json(); }),
    fetch('data/fit_data.json').then(function (r) { return r.json(); }),
    fetch('data/mech_data.json').then(function (r) { return r.json(); }),
    fetch('data/viz_extra.json').then(function (r) { return r.json(); })
  ]).then(function (arr) {
    DATA = arr[0]; GEO = arr[1]; FIT = arr[2]; MECH = arr[3]; V2X = arr[4];
    boot();
  }).catch(function (err) {
    $('#page').innerHTML = '<div class="errbox">数据加载失败：' + err + '\n请用本地服务器打开（例如在 08_可视化网站 目录运行 python -m http.server 8788）。</div>';
  });
});


/* ---------- 全省总览 ---------- */
var MODES = [
  { id: 'cases', name: '平滑病例' },
  { id: 'precip', name: '降水量' },
  { id: 'tavg', name: '气温' },
  { id: 'rh', name: '湿度' }
];
function modeButtons() {
  var h = '<span class="muted small">指标</span>';
  MODES.forEach(function (m) {
    h += '<button class="btn' + (state.mode === m.id ? ' active' : '') + '" data-mode="' + m.id + '">' + m.name + '</button>';
  });
  return h;
}
function viewButtons() {
  return '<span class="muted small" style="margin-left:8px">视图</span>' +
    '<button class="btn' + (state.view === 'map' ? ' active' : '') + '" data-view="map">地图</button>' +
    '<button class="btn' + (state.view === 'network' ? ' active' : '') + '" data-view="network">网络</button>' +
    '<button class="btn' + (state.view === '3d' ? ' active' : '') + '" data-view="3d">3D 立体</button>';
}
function renderOverview() {
  var page = $('#page');
  page.innerHTML =
    '<div class="ov-grid">' +
      '<div>' +
        '<div class="panel">' +
          '<h2>山西省全景 <span class="sub" id="ov-sub"></span></h2>' +
          '<div class="tools" id="ov-tools">' + modeButtons() + viewButtons() +
            '<label class="small muted" style="display:flex;align-items:center;gap:6px;margin-left:6px"><input type="checkbox" id="ov-edges"' + (state.edges ? ' checked' : '') + '/> 显示接壤边</label>' +
          '</div>' +
          '<div class="map-wrap" id="map-wrap"></div>' +
          '<div class="legend"><span id="ov-legend-name">颜色</span><div class="ramp" id="ov-ramp"></div><span id="ov-legend-range"></span></div>' +
          '<div class="anim-note"><span id="ov-note"></span><span>🌧 雨滴密度与速度 ∝ 当日降水 · 雾效 ∝ 相对湿度 · 暖色 ∝ 气温</span></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px">' +
          '<h2>全省前 20 天（拟合输入窗口） <span class="sub" id="ov-win-sub"></span></h2>' +
          '<div class="chart-legend" id="ov-chart-legend"></div>' +
          '<div class="chart-wrap" id="ov-chart"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px">' +
          '<h2>模型拟合（测试集） <span class="sub">15 种子集成 · 逐日预测 vs 真实 + 逐步长 RMSE</span></h2>' +
          '<div class="chart-legend" id="ov-fit-legend"></div><div class="chart-wrap" id="ov-fit-chart"></div>' +
          '<div class="cards" id="ov-fit-cards" style="margin-top:10px"></div>' +
          '<div class="chart-legend" style="margin-top:12px">逐步长 RMSE（第 1–12 步，测试集）</div><div class="chart-wrap" id="ov-horizon-chart"></div>' +
          '<div style="overflow:auto;margin-top:10px"><table class="city-table"><thead><tr>' +
            '<th>城市</th><th>RMSE</th><th>PCC</th><th>第 1 步</th><th>第 12 步</th>' +
          '</tr></thead><tbody id="ov-fit-tbody"></tbody></table></div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="cards" id="ov-cards"></div>' +
        '<div class="panel"><h2>11 个地级市 <span class="sub">点击进入城市页</span></h2>' +
          '<div style="overflow:auto"><table class="city-table"><thead><tr>' +
            '<th>城市</th><th>平滑病例</th><th>原始</th><th>降水</th><th>气温</th><th>湿度</th>' +
          '</tr></thead><tbody id="ov-tbody"></tbody></table></div></div>' +
        '<div class="panel" style="margin-top:16px"><h2>动画强度图例</h2><div id="ov-anim-legend"></div></div>' +
      '</div>' +
    '</div>';
  refs = {};
  refs.mapWrap = $('#map-wrap'); refs.cards = $('#ov-cards'); refs.tbody = $('#ov-tbody');
  refs.chart = $('#ov-chart'); refs.legendName = $('#ov-legend-name'); refs.legendRange = $('#ov-legend-range');
  refs.animLegend = $('#ov-anim-legend'); refs.sub = $('#ov-sub'); refs.note = $('#ov-note');
  refs.winSub = $('#ov-win-sub'); refs.chartLegend = $('#ov-chart-legend');
  refs.fitChart = $('#ov-fit-chart'); refs.fitLegend = $('#ov-fit-legend');
  refs.fitCards = $('#ov-fit-cards'); refs.fitHorizon = $('#ov-horizon-chart'); refs.fitTbody = $('#ov-fit-tbody');
  $('#ov-tools').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-mode]');
    if (b) { state.mode = b.getAttribute('data-mode'); renderOverview(); return; }
    var v = ev.target.closest('button[data-view]');
    if (v) { state.view = v.getAttribute('data-view'); renderOverview(); return; }
  });
  var edgeBox = $('#ov-edges');
  if (edgeBox) edgeBox.addEventListener('change', function () {
    state.edges = this.checked;
    if (refs.edgeGroup) refs.edgeGroup.style.display = state.edges ? '' : 'none';
  });
  if (refs.tbody) refs.tbody.addEventListener('click', function (ev) {
    var tr = ev.target.closest('tr');
    if (tr && tr.getAttribute('data-city')) location.hash = '#/city/' + encodeURIComponent(tr.getAttribute('data-city'));
  });
  var lg = '<div class="anim-legend">';
  RAIN_LEVELS.forEach(function (l) {
    lg += '<div class="anim-row"><span class="lv ' + l.cls + '">' + l.name + '</span><span class="muted">' + l.range + '</span></div>';
  });
  lg += '</div><div class="small muted" style="margin-top:8px">城市页的雨滴数量 = clamp(降水 × 强度映射, 0, 600)，气温越低转为雪，湿度越高雾越浓。</div>';
  refs.animLegend.innerHTML = lg;
  if (state.view === 'map') buildMap(); else if (state.view === 'network') buildNetwork(); else build3D();
  updateOverviewDynamic();
}
function buildMap() {
  var wrap = refs.mapWrap;
  wrap.innerHTML = '';
  var W = geoCache.W, H = geoCache.H;
  var svg = sEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'map-svg' });
  wrap.appendChild(svg);
  refs.mapSvg = svg;
  refs.edgeGroup = sEl('g'); svg.appendChild(refs.edgeGroup);
  refs.cityGroup = sEl('g'); svg.appendChild(refs.cityGroup);
  refs.labelGroup = sEl('g'); svg.appendChild(refs.labelGroup);
  refs.paths = {}; refs.labels = {};
  DATA.meta.cities.forEach(function (c) {
    var p = sEl('path', { d: geoCache.paths[c.name], class: 'city-path', fill: '#22344b', stroke: '#0b111a', 'stroke-width': 1 });
    p.addEventListener('mousemove', function (ev) { showMapTip(c.name, ev); });
    p.addEventListener('mouseleave', hideMapTip);
    p.addEventListener('click', function () { location.hash = '#/city/' + encodeURIComponent(c.name); });
    refs.cityGroup.appendChild(p);
    refs.paths[c.name] = p;
  });
  DATA.meta.cities.forEach(function (c) {
    var s = geoCache.screen[c.name];
    var t = sEl('text', { x: s[0], y: s[1] + 4, class: 'city-label' });
    t.textContent = c.short;
    refs.labelGroup.appendChild(t);
    refs.labels[c.name] = t;
  });
  DATA.meta.cities.forEach(function (c) {
    c.neighbors.forEach(function (n) {
      if (c.name < n) {
        var a = geoCache.screen[c.name], b = geoCache.screen[n];
        refs.edgeGroup.appendChild(sEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'map-edge' }));
      }
    });
  });
  refs.edgeGroup.style.display = state.edges ? '' : 'none';
  var cv = el('canvas', 'map-canvas');
  wrap.appendChild(cv);
  cv.width = W; cv.height = H;
  refs.mapCanvas = cv; refs.mapCtx = cv.getContext('2d');
  refs.mapTip = el('div', 'map-tip');
  wrap.appendChild(refs.mapTip);
  refs.mapWrap.addEventListener('mouseleave', hideMapTip);
}
function showMapTip(name, ev) {
  if (!refs.mapTip) return;
  var i = state.idx;
  var html = '<b>' + name + '</b><div class="small muted">' + dateAt(i) + '</div>' +
    '<div>平滑病例 <b>' + fmt(gv(name, 'casesSmooth', i), 1) + '</b> 例 · 原始 ' + fmtInt(gv(name, 'casesRaw', i)) + '</div>' +
    '<div>降水 ' + fmt(gv(name, 'precip', i), 1) + ' mm · 气温 ' + fmt(gv(name, 'tavg', i), 1) + ' °C</div>' +
    '<div>相对湿度 ' + fmt(gv(name, 'rh', i), 0) + '% · 绝对湿度 ' + fmt(gv(name, 'AH', i), 1) + ' g/m³</div>';
  refs.mapTip.innerHTML = html;
  refs.mapTip.style.opacity = 1;
  var wrap = refs.mapWrap.getBoundingClientRect();
  refs.mapTip.style.left = Math.min(wrap.width - 190, Math.max(8, ev.clientX - wrap.left + 14)) + 'px';
  refs.mapTip.style.top = Math.min(wrap.height - 120, Math.max(8, ev.clientY - wrap.top + 14)) + 'px';
}
function hideMapTip() { if (refs.mapTip) refs.mapTip.style.opacity = 0; }

function buildNetwork() {
  var wrap = refs.mapWrap;
  wrap.innerHTML = '';
  var W = geoCache.W, H = geoCache.H;
  var svg = sEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'map-svg' });
  wrap.appendChild(svg);
  refs.mapSvg = svg; refs.mapCanvas = null; refs.mapTip = null;
  var eg = sEl('g'); svg.appendChild(eg); refs.edgeGroup = eg;
  DATA.meta.cities.forEach(function (c) {
    c.neighbors.forEach(function (n) {
      if (c.name < n) {
        var a = geoCache.screen[c.name], b = geoCache.screen[n];
        eg.appendChild(sEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'map-edge', 'stroke-width': 1.6, 'stroke-opacity': .5 }));
      }
    });
  });
  refs.nodes = {};
  var ng = sEl('g'); svg.appendChild(ng);
  var q99 = DATA.meta.stats.casesSmooth.q99 || 20;
  DATA.meta.cities.forEach(function (c) {
    var s = geoCache.screen[c.name];
    var v = gv(c.name, 'casesSmooth', state.idx) || 0;
    var r = 8 + 15 * Math.sqrt(clamp(v / q99, 0, 1));
    var g = sEl('g', { transform: 'translate(' + s[0] + ',' + s[1] + ')', style: 'cursor:pointer' });
    var halo = sEl('circle', { r: r + 7, fill: modeColor(state.mode, modeValue(c.name, state.idx)), opacity: .16 });
    var dot = sEl('circle', { r: r, fill: modeColor(state.mode, modeValue(c.name, state.idx)), stroke: '#0b111a', 'stroke-width': 2 });
    var label = sEl('text', { y: r + 16, 'text-anchor': 'middle', 'font-size': 12, fill: '#dbeafe', 'paint-order': 'stroke', stroke: '#08111d', 'stroke-width': 3 });
    label.textContent = c.short;
    g.appendChild(halo); g.appendChild(dot); g.appendChild(label);
    g.addEventListener('click', function () { location.hash = '#/city/' + encodeURIComponent(c.name); });
    ng.appendChild(g);
    refs.nodes[c.name] = { g: g, dot: dot, halo: halo, r: r };
  });
  refs.tipN = el('div', 'map-tip'); wrap.appendChild(refs.tipN);
  wrap.addEventListener('mouseleave', function () { if (refs.tipN) refs.tipN.style.opacity = 0; });
  Object.keys(refs.nodes).forEach(function (name) {
    var nd = refs.nodes[name];
    nd.g.addEventListener('mousemove', function (ev) {
      refs.tipN.innerHTML = '<b>' + name + '</b> · 度 ' + CITY[name].neighbors.length + '<div class="small muted">' + dateAt(state.idx) + '</div>' +
        '<div>平滑病例 <b>' + fmt(gv(name, 'casesSmooth', state.idx), 1) + '</b> 例</div>' +
        '<div>降水 ' + fmt(gv(name, 'precip', state.idx), 1) + ' mm · 气温 ' + fmt(gv(name, 'tavg', state.idx), 1) + ' °C</div>' +
        '<div>相对湿度 ' + fmt(gv(name, 'rh', state.idx), 0) + '%</div>';
      refs.tipN.style.opacity = 1;
      var wr = refs.mapWrap.getBoundingClientRect();
      refs.tipN.style.left = Math.min(wr.width - 190, Math.max(8, ev.clientX - wr.left + 14)) + 'px';
      refs.tipN.style.top = Math.max(8, ev.clientY - wr.top + 14) + 'px';
    });
    nd.g.addEventListener('mouseleave', function () { if (refs.tipN) refs.tipN.style.opacity = 0; });
  });
}
function updateOverviewDynamic() {
  if (!refs.paths && !refs.nodes && !refs.threeCanvas) return;
  var i = state.idx;
  var mode = state.mode;
  // 地图颜色/标签
  DATA.meta.cities.forEach(function (c) {
    var v = modeValue(c.name, i);
    if (refs.paths && refs.paths[c.name]) refs.paths[c.name].setAttribute('fill', modeColor(mode, v));
    if (refs.labels && refs.labels[c.name]) refs.labels[c.name].textContent = c.short + ' ' + (v === null ? '—' : fmt(v, 0));
  });
  if (refs.nodes) {
    DATA.meta.cities.forEach(function (c) {
      var col = modeColor(mode, modeValue(c.name, i));
      refs.nodes[c.name].dot.setAttribute('fill', col);
      refs.nodes[c.name].halo.setAttribute('fill', col);
    });
  }
  // 图例范围
  var st = DATA.meta.stats[mode === 'cases' ? 'casesSmooth' : (mode === 'tavg' ? 'tavg' : (mode === 'rh' ? 'rh' : 'precip'))];
  refs.legendName.textContent = '颜色：' + modeName(mode);
  var ramp = $('#ov-ramp');
  if (ramp) ramp.style.display = mode === 'tavg' ? 'block' : 'block';
  refs.legendRange.textContent = mode === 'cases' ? ('0 – ' + fmt(st.q99, 0) + ' 例')
    : mode === 'precip' ? '0 – 25 mm（>25 满色）'
    : mode === 'tavg' ? ('-20 – 32 °C')
    : '0 – 100 %';
  // 顶部副标题
  refs.sub.textContent = dateAt(i) + ' ' + dowName(i) + ' · ' + modeName(mode) + '分布';
  // 卡片 + 表格 + 全省窗口
  var raw = 0, smooth = 0, maxP = { v: -1, c: '' }, maxT = { v: -99, c: '' }, minT = { v: 99, c: '' }, rhSum = 0, coldN = 0;
  DATA.meta.cities.forEach(function (c) {
    var r = gv(c.name, 'casesRaw', i) || 0, s = gv(c.name, 'casesSmooth', i) || 0;
    raw += r; smooth += s;
    var p = gv(c.name, 'precip', i) || 0;
    if (p > maxP.v) { maxP.v = p; maxP.c = c.name; }
    var t = gv(c.name, 'tavg', i);
    if (t !== null) { if (t > maxT.v) { maxT.v = t; maxT.c = c.name; } if (t < minT.v) { minT.v = t; minT.c = c.name; } }
    rhSum += gv(c.name, 'rh', i) || 0;
    if (gv(c.name, 'coldWave', i)) coldN++;
  });
  refs.cards.innerHTML =
    card('全省原始病例', fmtInt(raw) + '<small>例</small>') +
    card('全省平滑合计', fmt(smooth, 1) + '<small>例</small>') +
    card('最大降水', fmt(maxP.v, 1) + '<small>mm</small>', maxP.v > 0.1 ? maxP.c : '全省无降水') +
    card('最高气温', fmt(maxT.v, 1) + '<small>°C</small>', maxT.c) +
    card('最低气温', fmt(minT.v, 1) + '<small>°C</small>', minT.c) +
    card('平均相对湿度', fmt(rhSum / 11, 0) + '<small>%</small>', coldN ? (coldN + ' 城冷空气') : '');
  var rows = '';
  DATA.meta.cities.forEach(function (c) {
    var sel = '';
    rows += '<tr data-city="' + c.name + '" class="' + sel + '"><td>' + c.short + '</td>' +
      '<td>' + fmt(gv(c.name, 'casesSmooth', i), 1) + '</td>' +
      '<td>' + fmtInt(gv(c.name, 'casesRaw', i)) + '</td>' +
      '<td>' + fmt(gv(c.name, 'precip', i), 1) + '</td>' +
      '<td>' + fmt(gv(c.name, 'tavg', i), 1) + '</td>' +
      '<td>' + fmt(gv(c.name, 'rh', i), 0) + '</td></tr>';
  });
  refs.tbody.innerHTML = rows;
  // 全省 20 天窗口
  var start = Math.max(0, i - 19);
  var dates = DATA.meta.dates.slice(start, i + 1);
  var pr = DATA.meta.province;
  var rawS = pr.casesRawSum.slice(start, i + 1);
  var smS = pr.casesSmoothSum.slice(start, i + 1);
  refs.winSub.textContent = '窗口 ' + dates[0] + ' ~ ' + dates[dates.length - 1] + '（W = 20 天）';
  refs.chartLegend.innerHTML = '<span><i style="background:rgba(96,165,250,.55)"></i>原始合计</span><span><i style="background:#38bdf8"></i>7 日平滑合计</span>';
  renderChart(refs.chart, {
    dates: dates, width: 980, height: 250, yFmt: function (v) { return fmt(v, 0); },
    series: [
      { type: 'bar', data: rawS, color: 'rgba(96,165,250,.45)' },
      { type: 'line', data: smS, color: '#38bdf8', width: 2.6, dots: true }
    ],
    sel: dates.length - 1,
    tip: function (k) {
      return '<b>' + dates[k] + '</b><br/>原始合计 ' + fmtInt(rawS[k]) + ' 例<br/>平滑合计 ' + fmt(smS[k], 1) + ' 例';
    }
  });
  // 动画说明
  var lv = rainLevel(maxP.v);
  refs.note.textContent = '当日全省最大降水：' + (maxP.v > 0 ? (maxP.c + ' ' + fmt(maxP.v, 1) + ' mm（' + RAIN_LEVELS[lv].name + '）') : '无');
  if (typeof renderFitOverview === 'function') renderFitOverview();
  if (state.view === '3d' && refs.note) refs.note.textContent = '3D 立体：柱高 = ' + modeName(mode) + ' · 拖动旋转 · 滚轮缩放 · 点击城市进入';
}
function card(k, v, sub) {
  return '<div class="card"><div class="k">' + k + (sub ? ' · ' + sub : '') + '</div><div class="v">' + v + '</div></div>';
}


/* ---------- 城市页 ---------- */
function renderCity(name) {
  var c = CITY[name];
  var page = $('#page');
  page.innerHTML =
    '<div class="crumbs"><a href="#/">山西省全景</a> / <b>' + name + '</b><span class="tag">地级市</span></div>' +
    '<div class="city-head">' +
      '<div><div class="title"><h2>' + name + '</h2><span class="sub">' + c.lon.toFixed(2) + '°E, ' + c.lat.toFixed(2) + '°N · ' + c.neighbors.length + ' 个接壤城市</span></div>' +
        '<div class="neighbors" id="neighbors"></div></div>' +
    '</div>' +
    '<div class="city-grid">' +
      '<div>' +
        '<div class="panel"><h2>当日天气动画 <span class="sub" id="sky-sub"></span></h2>' +
          '<div class="sky-wrap" id="sky-wrap"><canvas id="sky-canvas"></canvas>' +
            '<div class="sky-label"><div class="t" id="sky-t"></div><div class="d" id="sky-d"></div></div>' +
            '<div class="sky-notes" id="sky-notes"></div>' +
          '</div>' +
          '<div class="anim-note"><span id="sky-intensity"></span><span>雨滴数量与速度 ∝ 降水；色调 ∝ 气温；雾效 ∝ 相对湿度；低温降水转为雪</span></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px">' +
          '<h2>拟合输入窗口（最近 20 天） <span class="sub">真实病例 vs 7 日平移平均</span></h2>' +
          '<div class="chart-legend" id="cw-legend"></div><div class="chart-wrap" id="chart-window"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px"><h2>气象要素（20 天窗口）</h2>' +
          '<div class="mini-grid">' +
            '<div><div class="small muted">日均气温 (°C)</div><div class="chart-wrap" id="chart-tavg"></div></div>' +
            '<div><div class="small muted">相对湿度 (%)</div><div class="chart-wrap" id="chart-rh"></div></div>' +
            '<div><div class="small muted">降水 (mm)</div><div class="chart-wrap" id="chart-precip"></div></div>' +
          '</div></div>' +
        '<div class="panel" style="margin-top:16px"><h2>输入窗口明细</h2>' +
          '<div class="table-wrap"><table class="window-table"><thead><tr>' +
            '<th>日期</th><th>原始病例</th><th>平滑病例</th><th>气温</th><th>相对湿度</th><th>绝对湿度</th><th>降水</th>' +
          '</tr></thead><tbody id="window-tbody"></tbody></table></div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="cards" id="city-cards"></div>' +
        '<div class="panel"><h2>更长上下文 <span class="sub">选中日为输入窗口末端</span></h2>' +
          '<div class="tools"><button class="btn" data-range="90">90 天</button><button class="btn' + (state.ctxRange === 120 ? ' active' : '') + '" data-range="120">120 天</button><button class="btn' + (state.ctxRange === 240 ? ' active' : '') + '" data-range="240">240 天</button></div>' +
          '<div class="chart-legend" id="ctx-legend"></div><div class="chart-wrap" id="chart-context"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px"><h2>模型拟合（测试集） <span class="sub" id="fit-sub"></span></h2>' +
          '<div class="chart-legend" id="fit-legend"></div><div class="chart-wrap" id="chart-fit"></div>' +
          '<div class="cards" id="fit-cards" style="margin-top:10px"></div>' +
          '<div class="chart-legend" style="margin-top:12px">逐步长 RMSE：本城 vs 全省</div><div class="chart-wrap" id="chart-fit-horizon"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px"><h2>城市信息</h2><div id="city-info"></div></div>' +
      '</div>' +
    '</div>';
  refs = {};
  refs.cards = $('#city-cards'); refs.neighbors = $('#neighbors');
  refs.cw = $('#chart-window'); refs.cwLegend = $('#cw-legend');
  refs.chT = $('#chart-tavg'); refs.chR = $('#chart-rh'); refs.chP = $('#chart-precip');
  refs.ctx = $('#chart-context'); refs.ctxLegend = $('#ctx-legend');
  refs.tbody = $('#window-tbody'); refs.sky = $('#sky-canvas');
  refs.skyT = $('#sky-t'); refs.skyD = $('#sky-d'); refs.skyNotes = $('#sky-notes');
  refs.skyInt = $('#sky-intensity'); refs.skySub = $('#sky-sub'); refs.cityInfo = $('#city-info');
  refs.fitChart = $('#chart-fit'); refs.fitLegend = $('#fit-legend'); refs.fitCards = $('#fit-cards');
  refs.fitHorizon = $('#chart-fit-horizon'); refs.fitSub = $('#fit-sub');
  var nh = '';
  c.neighbors.forEach(function (n) { nh += '<span class="chip" data-city="' + n + '">' + n + '</span>'; });
  refs.neighbors.innerHTML = '<span class="small muted">接壤：</span>' + nh;
  refs.neighbors.addEventListener('click', function (ev) {
    var ch = ev.target.closest('.chip');
    if (ch) location.hash = '#/city/' + encodeURIComponent(ch.getAttribute('data-city'));
  });
  page.querySelectorAll('button[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.ctxRange = parseInt(this.getAttribute('data-range'), 10);
      renderCity(name);
    });
  });
  refs.cityInfo.innerHTML =
    '<div class="small">城市中心：' + c.lon.toFixed(3) + '°E, ' + c.lat.toFixed(3) + '°N</div>' +
    '<div class="small muted" style="margin-top:6px">接壤城市：' + c.neighbors.join('、') + '</div>' +
    '<div class="small muted" style="margin-top:6px">模型输入：该日及之前 20 天的 16 路观测（病例、气象异常、日历谐波）；预测目标为该日之后的 12 个预测步。</div>';
  updateCityDynamic();
}
function updateCityDynamic() {
  var name = state.city, i = state.idx;
  if (!name || !refs.cards) return;
  var raw = gv(name, 'casesRaw', i), sm = gv(name, 'casesSmooth', i);
  var t = gv(name, 'tavg', i), ta = gv(name, 'tavgAnom', i);
  var rh = gv(name, 'rh', i), ah = gv(name, 'AH', i), aha = gv(name, 'AHAnom', i);
  var p = gv(name, 'precip', i), pa = gv(name, 'precipAnom', i);
  var cold = gv(name, 'coldWave', i);
  refs.cards.innerHTML =
    card('原始病例', fmtInt(raw) + '<small>例</small>') +
    card('7 日平滑', fmt(sm, 1) + '<small>例</small>') +
    card('日均气温', fmt(t, 1) + '<small>°C</small>', ta === null ? '' : ('距平 ' + (ta > 0 ? '+' : '') + fmt(ta, 1) + '°C')) +
    card('相对湿度', fmt(rh, 0) + '<small>%</small>') +
    card('绝对湿度', fmt(ah, 1) + '<small>g/m³</small>', aha === null ? '' : ('距平 ' + (aha > 0 ? '+' : '') + fmt(aha, 1))) +
    card('降水量', fmt(p, 1) + '<small>mm</small>', cold ? '冷空气日' : (pa !== null && pa > 1 ? ('距平 +' + fmt(pa, 1) + ' mm') : ''));
  var lv = rainLevel(p);
  refs.skyT.textContent = fmt(t, 1) + ' °C · ' + fmt(p, 1) + ' mm';
  refs.skyD.textContent = dateAt(i) + ' ' + dowName(i) + ' · ' + name + ' · ' + RAIN_LEVELS[lv].name;
  var notes = '';
  notes += '<span class="sky-mini">💧 降水 ' + fmt(p, 1) + ' mm</span>';
  notes += '<span class="sky-mini">🌡 气温 ' + fmt(t, 1) + ' °C</span>';
  notes += '<span class="sky-mini">💦 湿度 ' + fmt(rh, 0) + '%</span>';
  if (cold) notes += '<span class="sky-mini">❄ 冷空气日</span>';
  refs.skyNotes.innerHTML = notes;
  refs.skyInt.innerHTML = '动画强度：<b class="badge">' + RAIN_LEVELS[lv].name + '（第 ' + lv + '/5 档）</b> · 雨滴数约 ' + Math.round(rainStrength(p) * 600) + '；气温 ' + (t <= 0.5 ? '低于 0.5°C → 雪' : '高于 0.5°C → 雨') + '；湿度 ' + fmt(rh, 0) + '% → 雾效' + (rh >= 68 ? '开启' : '关闭');
  refs.skySub.textContent = '雨/雪 · 雾 · 气温色调';
  var start = Math.max(0, i - 19);
  var dates = DATA.meta.dates.slice(start, i + 1);
  var rawArr = [], smArr = [], tArr = [], rhArr = [], pArr = [], ahArr = [], coldArr = [];
  for (var k = start; k <= i; k++) {
    rawArr.push(gv(name, 'casesRaw', k));
    smArr.push(gv(name, 'casesSmooth', k));
    tArr.push(gv(name, 'tavg', k));
    rhArr.push(gv(name, 'rh', k));
    pArr.push(gv(name, 'precip', k));
    ahArr.push(gv(name, 'AH', k));
    coldArr.push(gv(name, 'coldWave', k));
  }
  refs.cwLegend.innerHTML = '<span><i style="background:rgba(148,163,184,.6)"></i>原始病例</span><span><i style="background:#38bdf8"></i>7 日平滑</span>';
  renderChart(refs.cw, {
    dates: dates, width: 860, height: 230,
    series: [
      { type: 'bar', data: rawArr, color: 'rgba(148,163,184,.55)' },
      { type: 'line', data: smArr, color: '#38bdf8', width: 2.8, dots: true }
    ],
    sel: dates.length - 1,
    tip: function (k) { return '<b>' + dates[k] + '</b><br/>原始 ' + fmtInt(rawArr[k]) + ' 例<br/>平滑 ' + fmt(smArr[k], 1) + ' 例'; }
  });
  renderChart(refs.chT, { dates: dates, width: 280, height: 150, yFmt: function (v) { return fmt(v, 0); }, series: [{ type: 'line', data: tArr, color: '#f59e0b', width: 2 }], sel: dates.length - 1, tip: function (k) { return dates[k] + '<br/>气温 ' + fmt(tArr[k], 1) + ' °C'; } });
  renderChart(refs.chR, { dates: dates, width: 280, height: 150, yFmt: function (v) { return fmt(v, 0); }, series: [{ type: 'line', data: rhArr, color: '#22d3ee', width: 2 }], sel: dates.length - 1, tip: function (k) { return dates[k] + '<br/>相对湿度 ' + fmt(rhArr[k], 0) + '%'; } });
  renderChart(refs.chP, { dates: dates, width: 280, height: 150, yFmt: function (v) { return fmt(v, 1); }, series: [{ type: 'bar', data: pArr, color: '#60a5fa' }], sel: dates.length - 1, tip: function (k) { return dates[k] + '<br/>降水 ' + fmt(pArr[k], 1) + ' mm'; } });
  var rows = '';
  for (var j = 0; j < dates.length; j++) {
    var gidx = start + j;
    var hl = gidx === i ? ' class="hl"' : (coldArr[j] ? ' class="cold"' : '');
    rows += '<tr' + hl + '><td>' + dates[j] + ' ' + dowName(gidx) + '</td>' +
      '<td>' + fmtInt(rawArr[j]) + '</td><td>' + fmt(smArr[j], 1) + '</td>' +
      '<td>' + fmt(tArr[j], 1) + '</td><td>' + fmt(rhArr[j], 0) + '</td>' +
      '<td>' + fmt(ahArr[j], 1) + '</td><td>' + fmt(pArr[j], 1) + '</td></tr>';
  }
  refs.tbody.innerHTML = rows;
  var n = state.ctxRange;
  var cstart = Math.max(0, i - n + 1);
  var cdates = DATA.meta.dates.slice(cstart, i + 1);
  var craw = [], csm = [];
  for (var q = cstart; q <= i; q++) { craw.push(gv(name, 'casesRaw', q)); csm.push(gv(name, 'casesSmooth', q)); }
  var split = DATA.meta.split;
  var it = idxOf(split.trainEnd), iv0 = idxOf(split.valStart), iv1 = idxOf(split.valEnd), it0 = idxOf(split.testStart);
  function rel(x) { return x - cstart; }
  var bands = [
    { from: 0, to: rel(it), color: 'rgba(74,222,128,.06)', label: '训练集' },
    { from: rel(iv0), to: rel(iv1), color: 'rgba(250,204,21,.07)', label: '验证集' },
    { from: rel(it0), to: cdates.length - 1, color: 'rgba(244,114,182,.06)', label: '测试集' }
  ];
  refs.ctxLegend.innerHTML = '<span><i style="background:rgba(148,163,184,.6)"></i>原始</span><span><i style="background:#38bdf8"></i>平滑</span><span><i style="background:rgba(250,204,21,.5)"></i>输入窗口</span>';
  renderChart(refs.ctx, {
    dates: cdates, width: 520, height: 260, yFmt: function (v) { return fmt(v, 0); },
    bands: bands,
    series: [
      { type: 'bar', data: craw, color: 'rgba(148,163,184,.4)' },
      { type: 'line', data: csm, color: '#38bdf8', width: 2.4 }
    ],
    window: [rel(start), rel(i)],
    sel: cdates.length - 1,
    tip: function (k) { return '<b>' + cdates[k] + '</b><br/>原始 ' + fmtInt(craw[k]) + ' 例<br/>平滑 ' + fmt(csm[k], 1) + ' 例'; }
  });
  if (typeof renderFitCity === 'function') renderFitCity(name);
}

/* ---------- 天气动画：城市 ---------- */
function drawCityWeather(ts) {
  var cv = $('#sky-canvas');
  if (!cv || !state.city) return;
  var dpr = window.devicePixelRatio || 1;
  var w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var i = state.idx, name = state.city;
  var t = gv(name, 'tavg', i), p = gv(name, 'precip', i) || 0, rh = gv(name, 'rh', i) || 0;
  var st = rainStrength(p), lv = rainLevel(p);
  var g = ctx.createLinearGradient(0, 0, 0, h);
  if (t === null) { g.addColorStop(0, '#12233a'); g.addColorStop(1, '#0a1220'); }
  else if (t <= 0) { g.addColorStop(0, '#0a1a33'); g.addColorStop(1, '#17304c'); }
  else if (t <= 15) { g.addColorStop(0, '#123a52'); g.addColorStop(1, '#1d4d62'); }
  else if (t <= 26) { g.addColorStop(0, '#144a63'); g.addColorStop(1, '#2f6f76'); }
  else { g.addColorStop(0, '#5b3418'); g.addColorStop(1, '#8a4b1d'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (t !== null && t > 18) {
    var heat = clamp((t - 18) / 16, 0, 1);
    var sun = ctx.createRadialGradient(w * 0.8, h * 0.18, 4, w * 0.8, h * 0.18, 90);
    sun.addColorStop(0, 'rgba(255,214,120,' + (0.28 + heat * 0.35) + ')');
    sun.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.18, 90, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,' + (0.06 + heat * 0.1) + ')';
    ctx.lineWidth = 2;
    for (var s = 0; s < 4; s++) {
      ctx.beginPath();
      for (var x = 0; x <= w; x += 12) {
        var yy = h * (0.45 + s * 0.07) + Math.sin((x / w) * 6 + ts * 0.001 + s) * (4 + heat * 6);
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  var cloudN = Math.max(lv, rh >= 78 ? 3 : 0);
  for (var c = 0; c < cloudN; c++) {
    var cx = ((c * 173.7 + ts * 0.006) % (w + 200)) - 100;
    var cy = h * (0.16 + (c % 3) * 0.07);
    var rr = 44 + (c % 3) * 16;
    ctx.fillStyle = 'rgba(180,200,220,' + (0.10 + 0.03 * c) + ')';
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (rh >= 62) {
    var fogN = Math.round(clamp((rh - 62) / 38, 0, 1) * 26);
    for (var f = 0; f < fogN; f++) {
      var fx = ((f * 89.3 + ts * 0.012 * (0.4 + (f % 3) * 0.2)) % (w + 260)) - 130;
      var fy = h * (0.42 + ((f * 37) % 55) / 100);
      var rad = 36 + (f % 5) * 14;
      var gg = ctx.createRadialGradient(fx, fy, 1, fx, fy, rad);
      gg.addColorStop(0, 'rgba(220,232,245,' + (0.05 + 0.02 * (f % 3)) + ')');
      gg.addColorStop(1, 'rgba(220,232,245,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (p > 0.1) {
    var isSnow = (t !== null && t <= 0.5);
    if (isSnow) {
      var sn = Math.round(clamp(p * 8, 4, 280));
      ctx.fillStyle = 'rgba(241,245,249,0.85)';
      for (var k = 0; k < sn; k++) {
        var sx = ((k * 97.13 + ts * 0.02 * (0.3 + (k % 4) * 0.12)) % (w + 20)) - 10;
        var sy = ((k * 53.7 + ts * 0.03 * (0.4 + st)) % (h + 20)) - 10;
        var sr = 1.2 + (k % 3) * 0.7;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      var n = Math.round(clamp(p * 14, 3, 600));
      ctx.lineCap = 'round';
      for (var r = 0; r < n; r++) {
        var rx = ((r * 61.7 + ts * 0.015) % (w + 40)) - 20;
        var speed = 0.25 + st * 0.9;
        var ry = ((r * 39.1 + ts * speed) % (h + 40)) - 20;
        var len = 8 + st * 14;
        ctx.strokeStyle = 'rgba(125,211,252,' + (0.18 + 0.32 * st) + ')';
        ctx.lineWidth = 0.8 + st * 1.1;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + 2 + st * 5, ry + len);
        ctx.stroke();
      }
      if (st > 0.25) {
        ctx.strokeStyle = 'rgba(125,211,252,' + (0.10 + st * 0.15) + ')';
        for (var sp = 0; sp < 16; sp++) {
          var px = ((sp * 83.1 + ts * 0.05) % w);
          var pr = (ts * 0.06 + sp * 13) % 1;
          ctx.beginPath(); ctx.arc(px, h - 12 - pr * 8, 2 + pr * 10, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (p > 30 && Math.sin(ts * 0.004 + name.length) > 0.992) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(0, 0, w, h);
      }
    }
  }
  ctx.fillStyle = 'rgba(6,12,20,0.75)';
  var base = h - 6;
  for (var b = 0; b < 26; b++) {
    var bw = 16 + (b * 13) % 22;
    var bh = 14 + ((b * 37) % 58);
    ctx.fillRect(b * 38 - 8, base - bh, bw, bh);
  }
  ctx.fillStyle = 'rgba(6,12,20,0.9)';
  ctx.fillRect(0, base, w, 6);
}

/* ---------- 天气动画：地图 ---------- */
function drawMapWeather(ts) {
  if (!refs.mapCanvas) return;
  var ctx = refs.mapCtx, W = geoCache.W, H = geoCache.H;
  ctx.clearRect(0, 0, W, H);
  if (!geoCache.p2d) geoCache.p2d = {};
  DATA.meta.cities.forEach(function (c, ci) {
    var p = gv(c.name, 'precip', state.idx) || 0;
    var t = gv(c.name, 'tavg', state.idx);
    var rh = gv(c.name, 'rh', state.idx) || 0;
    if (p <= 0.1 && rh < 68 && (t === null || t <= 26)) return;
    var path = geoCache.p2d[c.name] || (geoCache.p2d[c.name] = new Path2D(geoCache.paths[c.name]));
    var bb = geoCache.bbox[c.name];
    ctx.save(); ctx.clip(path);
    if (t !== null && t > 26) {
      var sc = geoCache.screen[c.name];
      var alpha = clamp((t - 26) / 8, 0, 1) * 0.18;
      var gr = ctx.createRadialGradient(sc[0], sc[1], 8, sc[0], sc[1], Math.max(bb[2], bb[3]) * 0.7);
      gr.addColorStop(0, 'rgba(251,146,60,' + alpha + ')');
      gr.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(bb[0], bb[1], bb[2], bb[3]);
    }
    if (rh >= 68) {
      var fogN = Math.round(clamp((rh - 68) / 31, 0, 1) * 10);
      for (var f = 0; f < fogN; f++) {
        var fx = bb[0] + ((f * 53 + ci * 29) % 100) / 100 * bb[2] + Math.sin(ts * 0.0004 + f) * 12;
        var fy = bb[1] + ((f * 31 + ci * 17) % 100) / 100 * bb[3];
        var rad = 14 + (f % 4) * 8;
        var gg = ctx.createRadialGradient(fx, fy, 1, fx, fy, rad);
        gg.addColorStop(0, 'rgba(226,232,240,0.10)');
        gg.addColorStop(1, 'rgba(226,232,240,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (p > 0.1) {
      var st = rainStrength(p);
      var isSnow = (t !== null && t <= 0.5);
      var n = isSnow ? Math.round(clamp(p * 2, 2, 50)) : Math.round(clamp(4 + st * 66, 4, 70));
      for (var k = 0; k < n; k++) {
        var rx = bb[0] + ((k * 73.13 + ci * 41) % 1000) / 1000 * bb[2];
        if (isSnow) {
          var sy = bb[1] + (((k * 37.7 + ci * 23) / 100 + ts * 0.004) % 1) * bb[3];
          ctx.fillStyle = 'rgba(241,245,249,0.8)';
          ctx.beginPath(); ctx.arc(rx, sy, 1.1 + st * 1.2, 0, Math.PI * 2); ctx.fill();
        } else {
          var y = bb[1] + (((k * 37.7 + ci * 23) / 100 + ts * (0.006 + st * 0.012)) % 1) * bb[3];
          var len = 3 + st * 7;
          ctx.strokeStyle = 'rgba(125,211,252,' + (0.25 + st * 0.45) + ')';
          ctx.lineWidth = 0.7 + st * 0.9;
          ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + 1 + st * 2, y + len); ctx.stroke();
        }
      }
    }
    ctx.restore();
  });
}

/* ---------- 模型拟合（测试集） ---------- */
function fitTestIdx(d) { if (!FIT) return null; var k = FIT.testDates.indexOf(d); return k >= 0 ? k : null; }
function renderFitOverview() {
  if (!FIT || !refs.fitChart) return;
  var dates = FIT.testDates.slice();
  var truth = FIT.province.true, pred = FIT.province.pred;
  refs.fitLegend.innerHTML = '<span><i style="background:#cbd5e1"></i>真实（多窗口平均）</span><span><i style="background:#4ade80"></i>15 种子集成预测</span>';
  renderChart(refs.fitChart, {
    dates: dates, width: 980, height: 210, yFmt: function (v) { return fmt(v, 0); },
    series: [
      { type: 'line', data: truth, color: '#cbd5e1', width: 1.5 },
      { type: 'line', data: pred, color: '#4ade80', width: 2.1 }
    ],
    sel: fitTestIdx(dateAt(state.idx)),
    tip: function (k) { return '<b>' + dates[k] + '</b><br/>真实 ' + fmt(truth[k], 1) + ' 例<br/>预测 ' + fmt(pred[k], 1) + ' 例'; }
  });
  var m = FIT.metrics.province, bl = FIT.baselines;
  refs.fitCards.innerHTML =
    card('总体 RMSE', fmt(m.allRmse, 4)) +
    card('总体 PCC', fmt(m.allPcc, 3)) +
    card('第 1 步 RMSE', fmt(m.rmseH[0], 3)) +
    card('第 12 步 RMSE', fmt(m.rmseH[11], 3)) +
    card('持续性基线', fmt(bl.persistence, 4), '原始模型 +1.82%') +
    card('校准后（α=0.25）', fmt(bl.calibratedGlobal, 4), '相对原始 −6.88%');
  var hDates = []; for (var h = 1; h <= 12; h++) hDates.push(h + ' 步');
  renderChart(refs.fitHorizon, {
    dates: hDates, width: 980, height: 170, xFmt: function (d) { return d; }, yFmt: function (v) { return fmt(v, 1); },
    series: [{ type: 'bar', data: m.rmseH, color: 'rgba(96,165,250,.7)' }],
    tip: function (k) { return '第 ' + (k + 1) + ' 步<br/>RMSE ' + fmt(m.rmseH[k], 3); }
  });
  var rows = [];
  DATA.meta.cities.forEach(function (c) {
    var cm = FIT.metrics.cities[c.name];
    if (cm) rows.push({ name: c.name, short: c.short, v: cm });
  });
  rows.sort(function (a, b) { return a.v.allRmse - b.v.allRmse; });
  var html = '';
  rows.forEach(function (r) {
    html += '<tr data-city="' + r.name + '"><td>' + r.short + '</td><td>' + fmt(r.v.allRmse, 3) + '</td><td>' + fmt(r.v.allPcc, 3) + '</td><td>' + fmt(r.v.rmseH[0], 3) + '</td><td>' + fmt(r.v.rmseH[11], 3) + '</td></tr>';
  });
  refs.fitTbody.innerHTML = html;
  refs.fitTbody.onclick = function (ev) {
    var tr = ev.target.closest('tr');
    if (tr && tr.getAttribute('data-city')) location.hash = '#/city/' + encodeURIComponent(tr.getAttribute('data-city'));
  };
}
function renderFitCity(name) {
  if (!FIT || !refs.fitChart || !FIT.series[name]) return;
  var dates = FIT.testDates.slice();
  var truth = FIT.series[name].true, pred = FIT.series[name].pred;
  var cm = FIT.metrics.cities[name], pm = FIT.metrics.province;
  refs.fitLegend.innerHTML = '<span><i style="background:#cbd5e1"></i>真实</span><span><i style="background:#4ade80"></i>集成预测</span>';
  renderChart(refs.fitChart, {
    dates: dates, width: 520, height: 210, yFmt: function (v) { return fmt(v, 0); },
    series: [
      { type: 'line', data: truth, color: '#cbd5e1', width: 1.5 },
      { type: 'line', data: pred, color: '#4ade80', width: 2.1 }
    ],
    sel: fitTestIdx(dateAt(state.idx)),
    tip: function (k) { return '<b>' + dates[k] + '</b><br/>真实 ' + fmt(truth[k], 1) + ' 例<br/>预测 ' + fmt(pred[k], 1) + ' 例'; }
  });
  refs.fitCards.innerHTML =
    card('本城 RMSE', fmt(cm.allRmse, 3)) +
    card('本城 PCC', fmt(cm.allPcc, 3)) +
    card('第 1 步 RMSE', fmt(cm.rmseH[0], 3)) +
    card('第 12 步 RMSE', fmt(cm.rmseH[11], 3)) +
    card('相对全省', (cm.allRmse <= pm.allRmse ? '−' : '+') + fmt(Math.abs(cm.allRmse - pm.allRmse), 3), '全省 ' + fmt(pm.allRmse, 3)) +
    card('第 6 步 PCC', fmt(cm.pccH[5], 3));
  var hDates = []; for (var h = 1; h <= 12; h++) hDates.push(h + ' 步');
  renderChart(refs.fitHorizon, {
    dates: hDates, width: 520, height: 180, xFmt: function (d) { return d; }, yFmt: function (v) { return fmt(v, 2); },
    series: [
      { type: 'bar', data: cm.rmseH, color: 'rgba(96,165,250,.65)' },
      { type: 'line', data: pm.rmseH, color: '#f472b6', width: 2, dash: '4 3' }
    ],
    tip: function (k) { return '第 ' + (k + 1) + ' 步<br/>本城 ' + fmt(cm.rmseH[k], 3) + ' · 全省 ' + fmt(pm.rmseH[k], 3); }
  });
  refs.fitSub.textContent = '测试集 2018-12-23 ~ 2019-12-31 · 逐日多窗口平均';
}
