'use strict';
/* ============================================================
   3D 立体视图：纯 Canvas 软件渲染（无外部依赖）
   - 11 个城市按行政区边界挤出为立体柱体，柱高 = 当前指标值
   - 拖动旋转 / 滚轮缩放 / 点击城市进入城市页
   - 降水粒子、湿度雾效、气温热浪叠加
   ============================================================ */
var S3 = { yaw: -0.62, pitch: 0.92, dist: 205, dragging: false, lastX: 0, lastY: 0, moved: 0, hover: null };
var G3 = null;
var W3 = 1000, H3 = 690, FOCAL3 = 950;

function c3parse(c) {
  var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c || '');
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  return [120, 140, 160];
}
function c3shade(c, f) {
  var p = c3parse(c);
  return 'rgb(' + Math.round(p[0] * f) + ',' + Math.round(p[1] * f) + ',' + Math.round(p[2] * f) + ')';
}
function c3rgba(c, a) {
  var p = c3parse(c);
  return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
}
function project3(x, y, z) {
  var cy = Math.cos(S3.yaw), sy = Math.sin(S3.yaw);
  var x1 = x * cy - z * sy;
  var z1 = x * sy + z * cy;
  var cp = Math.cos(S3.pitch), sp = Math.sin(S3.pitch);
  var y2 = y * cp - z1 * sp;
  var z2 = y * sp + z1 * cp;
  var zc = z2 + S3.dist;
  if (zc < 12) zc = 12;
  var s = FOCAL3 / zc;
  return [W3 / 2 + x1 * s, H3 * 0.56 - y2 * s, zc];
}
function height3(name) {
  var v = modeValue(name, state.idx);
  if (v === null || v === undefined) return 1.2;
  var m = state.mode;
  if (m === 'cases') return 2.0 + Math.sqrt(clamp(v / (DATA.meta.stats.casesSmooth.q99 || 18), 0, 1)) * 16;
  if (m === 'precip') return 2.0 + Math.sqrt(clamp(v / 25, 0, 1)) * 20;
  if (m === 'tavg') return 2.0 + clamp((v + 20) / 52, 0, 1) * 16;
  return 2.0 + clamp(v / 100, 0, 1) * 15;
}
function buildGeometry3D() {
  var minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
  GEO.features.forEach(function (f) {
    walkCoords(f.geometry.coordinates, function (lon, lat) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    });
  });
  var lonC = (minLon + maxLon) / 2, latC = (minLat + maxLat) / 2;
  var K = 78 / ((maxLon - minLon) * Math.cos(latC * Math.PI / 180));
  var g = { cities: {}, bbox: [1e9, 1e9, -1e9, -1e9] };
  GEO.features.forEach(function (f) {
    var name = f.properties.name;
    var polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    var rings = [];
    var bb = [1e9, 1e9, -1e9, -1e9];
    polys.forEach(function (poly) {
      poly.forEach(function (ring, ri) {
        if (ri > 0) return;
        var pts = [];
        for (var i = 0; i < ring.length; i++) {
          var x = (ring[i][0] - lonC) * Math.cos(latC * Math.PI / 180) * K;
          var z = -(ring[i][1] - latC) * K;
          pts.push([x, z]);
          if (x < bb[0]) bb[0] = x; if (z < bb[1]) bb[1] = z;
          if (x > bb[2]) bb[2] = x; if (z > bb[3]) bb[3] = z;
          if (x < g.bbox[0]) g.bbox[0] = x; if (z < g.bbox[1]) g.bbox[1] = z;
          if (x > g.bbox[2]) g.bbox[2] = x; if (z > g.bbox[3]) g.bbox[3] = z;
        }
        var area = 0;
        for (var ai = 0; ai < pts.length; ai++) {
          var aj = (ai + 1) % pts.length;
          area += pts[ai][0] * pts[aj][1] - pts[aj][0] * pts[ai][1];
        }
        if (area < 0) pts.reverse();
        rings.push(pts);
      });
    });
    var meta = CITY[name];
    g.cities[name] = {
      rings: rings, bbox: bb,
      cx: (bb[0] + bb[2]) / 2, cz: (bb[1] + bb[3]) / 2,
      meta: meta
    };
  });
  return g;
}
function build3D() {
  var wrap = refs.mapWrap;
  wrap.innerHTML = '';
  var cv = document.createElement('canvas');
  cv.className = 'map-3d';
  cv.width = W3; cv.height = H3;
  wrap.appendChild(cv);
  refs.threeCanvas = cv;
  refs.threeCtx = cv.getContext('2d');
  refs.mapCanvas = null;
  refs.mapSvg = null;
  var tip = document.createElement('div');
  tip.className = 'map-tip';
  wrap.appendChild(tip);
  refs.threeTip = tip;
  if (!G3) G3 = buildGeometry3D();
  bind3D(wrap, cv);
}
function bind3D(wrap, cv) {
  cv.addEventListener('mousedown', function (ev) {
    S3.dragging = true; S3.lastX = ev.clientX; S3.lastY = ev.clientY; S3.moved = 0;
    ev.preventDefault();
  });
  window.addEventListener('mousemove', function (ev) {
    if (S3.dragging) {
      var dx = ev.clientX - S3.lastX, dy = ev.clientY - S3.lastY;
      S3.lastX = ev.clientX; S3.lastY = ev.clientY;
      S3.moved += Math.abs(dx) + Math.abs(dy);
      S3.yaw += dx * 0.008;
      S3.pitch = clamp(S3.pitch - dy * 0.006, 0.28, 1.35);
      return;
    }
    if (refs.threeCanvas !== cv) return;
    var name = pick3D(ev, cv);
    S3.hover = name;
    if (name) {
      var i = state.idx;
      refs.threeTip.innerHTML = '<b>' + name + '</b><div class="small muted">' + dateAt(i) + '</div>' +
        '<div>平滑病例 <b>' + fmt(gv(name, 'casesSmooth', i), 1) + '</b> 例 · 原始 ' + fmtInt(gv(name, 'casesRaw', i)) + '</div>' +
        '<div>降水 ' + fmt(gv(name, 'precip', i), 1) + ' mm · 气温 ' + fmt(gv(name, 'tavg', i), 1) + ' °C</div>' +
        '<div>相对湿度 ' + fmt(gv(name, 'rh', i), 0) + '%</div>';
      refs.threeTip.style.opacity = 1;
      var wr = wrap.getBoundingClientRect();
      refs.threeTip.style.left = Math.min(wr.width - 190, Math.max(8, ev.clientX - wr.left + 14)) + 'px';
      refs.threeTip.style.top = Math.min(wr.height - 120, Math.max(8, ev.clientY - wr.top + 14)) + 'px';
    } else if (refs.threeTip) {
      refs.threeTip.style.opacity = 0;
    }
  });
  window.addEventListener('mouseup', function (ev) {
    if (!S3.dragging) return;
    S3.dragging = false;
    if (S3.moved < 5) {
      var name = pick3D(ev, cv);
      if (name) location.hash = '#/city/' + encodeURIComponent(name);
    }
  });
  cv.addEventListener('wheel', function (ev) {
    S3.dist = clamp(S3.dist * (1 + ev.deltaY * 0.0012), 80, 340);
    ev.preventDefault();
  }, { passive: false });
}
function pick3D(ev, cv) {
  if (!G3) return null;
  var r = cv.getBoundingClientRect();
  var px = (ev.clientX - r.left) / r.width * W3;
  var py = (ev.clientY - r.top) / r.height * H3;
  var names = Object.keys(G3.cities);
  for (var n = 0; n < names.length; n++) {
    var polys = G3.hit[names[n]];
    if (!polys) continue;
    for (var p = 0; p < polys.length; p++) {
      if (pointInPoly(px, py, polys[p])) return names[n];
    }
  }
  return null;
}
function pointInPoly(x, y, pts) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function draw3D(ts) {
  var cv = refs.threeCanvas;
  if (!cv) return;
  var ctx = refs.threeCtx;
  ctx.clearRect(0, 0, W3, H3);
  var bg = ctx.createLinearGradient(0, 0, 0, H3);
  bg.addColorStop(0, '#0a1424'); bg.addColorStop(1, '#0d1a2b');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W3, H3);
  if (!G3) return;
  if (!G3.hit) G3.hit = {};
  drawGround3(ctx);
  var faces = [];
  var tops = {};
  DATA.meta.cities.forEach(function (c) {
    var g = G3.cities[c.name];
    if (!g) return;
    var h = height3(c.name);
    var col = modeColor(state.mode, modeValue(c.name, state.idx));
    var topCol = c3shade(col, 1.08);
    var cityHits = [];
    g.rings.forEach(function (ring) {
      var top = [];
      for (var i = 0; i < ring.length; i++) top.push(project3(ring[i][0], h, ring[i][1]));
      var depth = 0;
      for (var d = 0; d < top.length; d++) depth += top[d][2];
      depth /= top.length;
      faces.push({ pts: top, fill: topCol, stroke: 'rgba(255,255,255,0.28)', depth: depth, city: c.name, kind: 'top' });
      if (ring.length < 200) cityHits.push(top);
      for (var e = 0; e < ring.length; e++) {
        var a = ring[e], b = ring[(e + 1) % ring.length];
        var pa0 = project3(a[0], 0, a[1]), pb0 = project3(b[0], 0, b[1]);
        var pa1 = top[e], pb1 = top[(e + 1) % ring.length];
        var ex = b[0] - a[0], ez = b[1] - a[1];
        var len = Math.sqrt(ex * ex + ez * ez) || 1;
        var nx = ez / len, nz = -ex / len;
        var facing = nx * -0.55 + nz * -0.83;
        if (facing < 0) facing = 0;
        var fdepth = (pa0[2] + pb0[2] + pa1[2] + pb1[2]) / 4;
        faces.push({ pts: [pa0, pb0, pb1, pa1], fill: c3shade(col, 0.38 + 0.52 * facing), depth: fdepth, city: c.name, kind: 'side' });
      }
    });
    G3.hit[c.name] = cityHits;
    tops[c.name] = project3(g.cx, h + 3, g.cz);
  });
  faces.sort(function (a, b) { return b.depth - a.depth; });
  for (var f = 0; f < faces.length; f++) {
    var fc = faces[f];
    ctx.beginPath();
    ctx.moveTo(fc.pts[0][0], fc.pts[0][1]);
    for (var k = 1; k < fc.pts.length; k++) ctx.lineTo(fc.pts[k][0], fc.pts[k][1]);
    ctx.closePath();
    ctx.fillStyle = fc.fill;
    ctx.fill();
    if (fc.kind === 'top') { ctx.strokeStyle = fc.stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  // 天气粒子（降水/雪）+ 热浪 + 雾
  DATA.meta.cities.forEach(function (c) {
    var g = G3.cities[c.name];
    if (!g) return;
    var p = gv(c.name, 'precip', state.idx) || 0;
    var t = gv(c.name, 'tavg', state.idx);
    var rh = gv(c.name, 'rh', state.idx) || 0;
    var h = height3(c.name);
    if (p > 0.1) {
      var st = rainStrength(p);
      var isSnow = (t !== null && t <= 0.5);
      var n = isSnow ? Math.round(clamp(p * 1.2, 2, 30)) : Math.round(clamp(3 + st * 30, 3, 34));
      var bw = g.bbox[2] - g.bbox[0], bd = g.bbox[3] - g.bbox[1];
      for (var i = 0; i < n; i++) {
        var fx = g.bbox[0] + ((i * 73.13 + 11) % 100) / 100 * bw;
        var fz = g.bbox[1] + ((i * 37.7 + 23) % 100) / 100 * bd;
        var phase = ((i * 0.13 + ts * 0.00022 * (isSnow ? 0.55 : 1 + st * 1.6)) % 1);
        var y = h + 5 - phase * (h + 8);
        var pt = project3(fx, y, fz);
        if (isSnow) {
          ctx.fillStyle = 'rgba(241,245,249,0.85)';
          ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.4 + st * 0.8, 0, Math.PI * 2); ctx.fill();
        } else {
          var pt2 = project3(fx, y - 2.2 - st * 2, fz);
          ctx.strokeStyle = 'rgba(125,211,252,' + (0.3 + st * 0.5) + ')';
          ctx.lineWidth = 1 + st * 0.8;
          ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(pt2[0], pt2[1]); ctx.stroke();
        }
      }
    }
    if (rh >= 68) {
      var tp = tops[c.name];
      var rad = 30 + (rh - 68) * 1.6;
      var gg = ctx.createRadialGradient(tp[0], tp[1], 2, tp[0], tp[1], rad);
      gg.addColorStop(0, 'rgba(226,232,240,' + (0.05 + (rh - 68) / 31 * 0.12) + ')');
      gg.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(tp[0], tp[1], rad, 0, Math.PI * 2); ctx.fill();
    }
    if (t !== null && t > 26) {
      var tp2 = tops[c.name];
      var rad2 = 26 + (t - 26) * 3;
      var hg = ctx.createRadialGradient(tp2[0], tp2[1], 2, tp2[0], tp2[1], rad2);
      hg.addColorStop(0, 'rgba(251,146,60,' + (0.10 + (t - 26) / 8 * 0.18) + ')');
      hg.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(tp2[0], tp2[1], rad2, 0, Math.PI * 2); ctx.fill();
    }
  });
  // 接壤边（可选）
  if (state.edges) {
    ctx.strokeStyle = 'rgba(148,197,255,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    DATA.meta.cities.forEach(function (c) {
      var a = G3.cities[c.name];
      if (!a) return;
      c.neighbors.forEach(function (n) {
        var b = G3.cities[n];
        if (!b || c.name > n) return;
        var ha = height3(c.name), hb = height3(n);
        var pa = project3(a.cx, ha + 1, a.cz);
        var pb = project3(b.cx, hb + 1, b.cz);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      });
    });
    ctx.setLineDash([]);
  }
  // 标签
  DATA.meta.cities.forEach(function (c) {
    var g = G3.cities[c.name];
    if (!g) return;
    var h = height3(c.name);
    var pt = project3(g.cx, h + 6, g.cz);
    ctx.font = '600 13px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(6,12,20,0.9)';
    ctx.strokeText(c.short, pt[0], pt[1]);
    ctx.fillStyle = S3.hover === c.name ? '#fff' : '#dbeafe';
    ctx.fillText(c.short, pt[0], pt[1]);
    if (S3.hover === c.name) {
      ctx.fillStyle = '#facc15';
      ctx.font = '11px "Segoe UI",sans-serif';
      ctx.fillText(modeFmt(modeValue(c.name, state.idx), state.mode), pt[0], pt[1] + 15);
    }
  });
  // 操作提示
  ctx.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.fillText('拖动旋转 · 滚轮缩放 · 点击城市进入 · 柱高 = ' + modeName(state.mode), 14, H3 - 14);
}
function drawGround3(ctx) {
  var b = G3.bbox, m = 8;
  ctx.strokeStyle = 'rgba(148,163,184,0.07)';
  ctx.lineWidth = 1;
  for (var i = 0; i <= 8; i++) {
    var x = b[0] - m + (b[2] - b[0] + 2 * m) * i / 8;
    var p1 = project3(x, -0.4, b[1] - m), p2 = project3(x, -0.4, b[3] + m);
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
  }
  for (var j = 0; j <= 8; j++) {
    var z = b[1] - m + (b[3] - b[1] + 2 * m) * j / 8;
    var q1 = project3(b[0] - m, -0.4, z), q2 = project3(b[2] + m, -0.4, z);
    ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
  }
}
if (typeof window !== 'undefined') { window.build3D = build3D; window.draw3D = draw3D; }
