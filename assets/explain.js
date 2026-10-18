'use strict';
/* ============================================================
   explain.js · 5 分钟动画讲解页
   数据：data/explain_data.json（真实样本）、data/app_data.json（地图/城市）、data/geo.json
   ============================================================ */
(function () {
  var W = 1440, H = 740;
  var cv, ctx, dpr = 1;
  var EX = null, APP = null, GEO = null, CITYMETA = null;
  var T = 0, DUR = 300, playing = false, speed = 1, lastTs = 0, lastCaptionKey = '';
  var COL = { bg1: '#08111d', bg2: '#050a12', txt: '#e6eef8', muted: '#8ba2bd', line: '#1d3049', gold: '#f4b942', cyan: '#38bdf8', red: '#ff6b6b', green: '#4ade80', purple: '#a78bfa' };
  var CH = [];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function fmt(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }
  function txt(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 400) + ' ' + size + 'px "Microsoft YaHei","Segoe UI",sans-serif';
    ctx.fillStyle = color || COL.txt;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function bg() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bg1); g.addColorStop(1, COL.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,220,0.035)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function panel(x, y, w, h, title) {
    ctx.fillStyle = 'rgba(11,22,36,0.82)';
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    if (title) txt(title, x + 14, y + 20, 13, COL.muted, 'left', 600);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function chartBox(box, ymin, ymax, dates) {
    ctx.strokeStyle = 'rgba(120,170,220,0.18)'; ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    for (var i = 0; i <= 4; i++) {
      var yy = box.y + box.h * i / 4;
      ctx.beginPath(); ctx.moveTo(box.x, yy); ctx.lineTo(box.x + box.w, yy); ctx.stroke();
      var val = ymax - (ymax - ymin) * i / 4;
      txt(fmt(val, val > 10 ? 0 : 1), box.x - 8, yy, 10.5, COL.muted, 'right');
    }
  }
  function mapPoint(lon, lat, box) {
    var minLon = 110.2296, maxLon = 114.5689, minLat = 34.5835, maxLat = 40.7399;
    var s = Math.min(box.w / (maxLon - minLon), box.h / (maxLat - minLat));
    return [box.x + (lon - minLon) * s + (box.w - (maxLon - minLon) * s) / 2,
            box.y + (maxLat - lat) * s + (box.h - (maxLat - minLat) * s) / 2];
  }

  /* ---------- 场景 0：封面 ---------- */
  function drawIntro(tl) {
    bg();
    var box = { x: 330, y: 130, w: 780, h: 470 };
    if (GEO) {
      GEO.features.forEach(function (f) {
        var polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
        ctx.beginPath();
        polys.forEach(function (poly) {
          poly.forEach(function (ring) {
            ring.forEach(function (pt, i) {
              var p = mapPoint(pt[0], pt[1], box);
              if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
            });
            ctx.closePath();
          });
        });
        ctx.fillStyle = 'rgba(30,60,95,0.35)';
        ctx.strokeStyle = 'rgba(90,150,210,0.5)'; ctx.lineWidth = 1.1;
        ctx.fill(); ctx.stroke();
      });
      CITYMETA.forEach(function (c, i) {
        var p = mapPoint(c.lon, c.lat, box);
        var phase = (tl * 0.6 + i * 0.4) % 1;
        ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 10 * phase, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56,189,248,' + (0.5 * (1 - phase)) + ')'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#7dd3fc'; ctx.fill();
        txt(c.short, p[0], p[1] - 12, 11, '#cfe3f7', 'center');
      });
    }
    var a = ease(tl / 2);
    ctx.globalAlpha = a;
    txt('从一个样本看懂 WMEG-Net', W / 2, 90, 30, '#e6f3ff', 'center', 700);
    ctx.globalAlpha = 1;
    txt('山西 11 个地级市 · 2015–2019 · 一条数据从原始计数到 12 步预测的完整旅程', W / 2, 128, 14, COL.muted, 'center');
    var stats = [['11', '个城市'], ['1826', '天数据'], ['20', '天输入窗口'], ['12', '步预测']];
    stats.forEach(function (s, i) {
      var x = W / 2 - 330 + i * 220;
      var p = ease((tl - 2 - i * 0.4) / 1.2);
      ctx.globalAlpha = p;
      txt(s[0], x, 648, 34, COL.gold, 'center', 700);
      txt(s[1], x, 682, 13, COL.muted, 'center');
      ctx.globalAlpha = 1;
    });
    txt('样本：太原市 · 输入 2019-11-27 ~ 12-16 · 预测 12-17 ~ 12-28', W / 2, 710, 12, '#64748b', 'center');
  }

  /* ---------- 场景 1：原始计数 → 7 日平滑 ---------- */
  function drawSmooth(tl) {
    bg();
    var s = EX.series, n = s.dates.length;
    var box = { x: 120, y: 150, w: 900, h: 400 };
    panel(70, 92, 1000, 520, '');
    chartBox(box, 0, Math.max.apply(null, s.raw.map(function (v) { return v || 0; })) * 1.15, s.dates);
    var bw = box.w / n * 0.62;
    for (var i = 0; i < n; i++) {
      var x = box.x + i / (n - 1) * box.w;
      var v = s.raw[i] || 0;
      var h = v / (Math.max.apply(null, s.raw.map(function (z) { return z || 0; })) * 1.15) * box.h;
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.fillRect(x - bw / 2, box.y + box.h - h, bw, h);
    }
    var p = clamp((tl - 4) / 24, 0, 1);
    var wi = Math.floor(p * (n - 7));
    // 滑动 7 天窗口
    var x0 = box.x + wi / (n - 1) * box.w, x1 = box.x + (wi + 6) / (n - 1) * box.w;
    ctx.fillStyle = 'rgba(244,185,66,0.13)';
    ctx.fillRect(x0, box.y, x1 - x0, box.h);
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.6;
    ctx.strokeRect(x0, box.y, x1 - x0, box.h);
    for (var j = wi; j <= wi + 6 && j < n; j++) {
      var xj = box.x + j / (n - 1) * box.w;
      var vj = s.raw[j] || 0;
      var hj = vj / (Math.max.apply(null, s.raw.map(function (z) { return z || 0; })) * 1.15) * box.h;
      ctx.fillStyle = 'rgba(244,185,66,0.75)';
      ctx.fillRect(xj - bw / 2, box.y + box.h - hj, bw, hj);
    }
    // 平滑线逐步画出
    var upto = Math.min(n - 1, wi + 6);
    ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2.6;
    ctx.beginPath();
    var started = false;
    for (var k = 0; k <= upto; k++) {
      if (s.smooth[k] === null || s.smooth[k] === undefined) continue;
      var xk = box.x + k / (n - 1) * box.w;
      var yk = box.y + box.h - s.smooth[k] / (Math.max.apply(null, s.raw.map(function (z) { return z || 0; })) * 1.15) * box.h;
      if (!started) { ctx.moveTo(xk, yk); started = true; } else ctx.lineTo(xk, yk);
    }
    ctx.stroke();
    txt('原始逐日计数', box.x + 6, box.y + 16, 12, '#94a3b8', 'left', 600);
    txt('7 日平移平均', box.x + 120, box.y + 16, 12, COL.cyan, 'left', 600);
    // 日期标签
    [0, Math.floor(n / 2), n - 1].forEach(function (k) {
      txt(s.dates[k], box.x + k / (n - 1) * box.w, box.y + box.h + 16, 11, COL.muted, 'center');
    });
    // 右侧公式板
    panel(1090, 150, 300, 400, '');
    txt('7 日平移平均', 1108, 182, 15, COL.gold, 'left', 600);
    txt('ȳ(t) = (1/7) Σ y(t−k)', 1108, 222, 16, '#bfe3ff');
    txt('k = 0 … 6', 1108, 246, 13, COL.muted);
    txt('为什么：报告延迟、周末效应、', 1108, 292, 12.5, COL.muted);
    txt('节假日漏报 → 原始计数有尖刺', 1108, 312, 12.5, COL.muted);
    txt('与空档；7 日平滑只使用过去，', 1108, 332, 12.5, COL.muted);
    txt('不引入未来信息。', 1108, 352, 12.5, COL.muted);
    var first = s.smooth.findIndex(function (v) { return v !== null && v !== undefined; });
    txt('第一个有效点：第 7 天（' + s.dates[first] + '）', 1108, 398, 12.5, COL.cyan);
    txt('当前窗口：' + s.dates[Math.min(wi, n - 1)] + ' 起 7 天', 1108, 430, 12.5, '#cfe3f7');
  }

  /* ---------- 场景 2：气象异常与标准化 ---------- */
  function drawWeather(tl) {
    bg();
    var s = EX.series, n = s.dates.length;
    panel(70, 92, 1000, 560, '');
    var parts = [
      { key: 'tavg', name: '日均气温 (°C)', color: COL.cyan, base: 'baseTavg' },
      { key: 'AH', name: '绝对湿度 (g/m³)', color: COL.green, base: 'baseAH' },
      { key: 'precip', name: '降水 (mm)', color: COL.purple, base: null }
    ];
    var pAn = ease((tl - 10) / 10);
    parts.forEach(function (pt, pi) {
      var bx = { x: 130, y: 150 + pi * 165, w: 780, h: 120 };
      var vals = s[pt.key].map(function (v) { return v || 0; });
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      if (pt.base) {
        var bv = s[pt.base].map(function (v) { return v === null ? null : v; });
        var bmn = Math.min.apply(null, bv.filter(function (v) { return v !== null; }));
        mn = Math.min(mn, bmn);
      }
      var pad = (mx - mn) * 0.15 || 1;
      var ymin = mn - pad, ymax = mx + pad;
      ctx.strokeStyle = 'rgba(120,170,220,0.15)'; ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
      var stepX = bx.w / (n - 1);
      function yOf(v) { return bx.y + bx.h - (v - ymin) / (ymax - ymin) * bx.h; }
      // 观测
      ctx.strokeStyle = pt.color; ctx.lineWidth = 2;
      ctx.beginPath(); var st = false;
      for (var i = 0; i < n; i++) {
        var x = bx.x + i * stepX, y = yOf(vals[i]);
        if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 气候基线 + 异常填充
      if (pt.base) {
        ctx.strokeStyle = 'rgba(148,163,184,0.75)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); st = false;
        for (var j = 0; j < n; j++) {
          if (s[pt.base][j] === null) continue;
          var xb = bx.x + j * stepX, yb = yOf(s[pt.base][j]);
          if (!st) { ctx.moveTo(xb, yb); st = true; } else ctx.lineTo(xb, yb);
        }
        ctx.stroke(); ctx.setLineDash([]);
        if (pAn > 0) {
          ctx.fillStyle = 'rgba(244,185,66,0.22)';
          for (var k = 0; k < n; k++) {
            if (s[pt.base][k] === null) continue;
            var xa = bx.x + k * stepX, ya = yOf(vals[k]), ybase = yOf(s[pt.base][k]);
            ctx.fillRect(xa - stepX * 0.5, Math.min(ya, ybase), stepX, Math.abs(ya - ybase) * pAn);
          }
        }
      }
      txt(pt.name, bx.x + 6, bx.y + 14, 12, COL.muted, 'left', 600);
      txt('观测', bx.x + bx.w - 130, bx.y + 14, 11, pt.color, 'left');
      if (pt.base) txt('气候基线（2015–18 同日序均值）', bx.x + bx.w - 130, bx.y + 30, 10.5, '#94a3b8', 'left');
    });
    // 右侧：标准化与通道
    var px = 1090;
    panel(px, 150, 300, 210, '');
    txt('第一步：去掉季节 → 异常', px + 18, 182, 13.5, COL.gold, 'left', 600);
    txt('a(t) = x(t) − clim(day)', px + 18, 214, 15, '#bfe3ff');
    txt('第二步：按训练段标准化', px + 18, 250, 13.5, COL.gold, 'left', 600);
    txt('z(t) = (x(t) − μ) / σ', px + 18, 282, 15, '#bfe3ff');
    txt('μ、σ 只统计训练段（2015-01 ~ 2018-06）', px + 18, 310, 11.5, COL.muted);
    // 16 通道条
    var q = ease((tl - 26) / 10);
    panel(px, 380, 300, 240, '');
    txt('每天每城 16 维输入', px + 18, 410, 13.5, COL.gold, 'left', 600);
    var chs = ['z(病例)', '温度距平', '湿度距平', '降水 z', '日历谐波 1..12'];
    chs.forEach(function (nm, i) {
      var y = 442 + i * 30;
      ctx.globalAlpha = clamp(q * 1.4 - i * 0.15, 0, 1);
      ctx.fillStyle = i === 4 ? 'rgba(167,139,250,0.55)' : 'rgba(56,189,248,0.45)';
      ctx.fillRect(px + 18, y - 9, 240, 18);
      txt(nm, px + 24, y, 11.5, '#0b1624', 'left', 600);
      ctx.globalAlpha = 1;
    });
    txt('C = 1 + 3 + 12 = 16', px + 18, 600, 12.5, COL.cyan, 'left', 600);
  }

  /* ---------- 场景 3：滑动窗口 + batch ---------- */
  function drawBatch(tl) {
    bg();
    // 顶部 5 年时间轴
    var app = APP, n = app.meta.ndays;
    var prov = app.meta.province.casesSmoothSum;
    var mx = Math.max.apply(null, prov) || 1;
    var tlBox = { x: 120, y: 130, w: 1200, h: 90 };
    panel(70, 92, 1300, 150, '');
    ctx.strokeStyle = 'rgba(120,170,220,0.2)'; ctx.strokeRect(tlBox.x, tlBox.y, tlBox.w, tlBox.h);
    ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.4; ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = tlBox.x + i / (n - 1) * tlBox.w;
      var y = tlBox.y + tlBox.h - (prov[i] || 0) / mx * tlBox.h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    var endIdx = app.meta.dates.indexOf('2019-12-16');
    var t0 = endIdx - 19;
    var wx0 = tlBox.x + t0 / (n - 1) * tlBox.w, wx1 = tlBox.x + endIdx / (n - 1) * tlBox.w;
    ctx.fillStyle = 'rgba(244,185,66,0.22)'; ctx.fillRect(wx0, tlBox.y, wx1 - wx0, tlBox.h);
    var fx1 = tlBox.x + Math.min(n - 1, endIdx + 12) / (n - 1) * tlBox.w;
    ctx.fillStyle = 'rgba(255,107,107,0.18)'; ctx.fillRect(wx1, tlBox.y, fx1 - wx1, tlBox.h);
    txt('2015', tlBox.x + 2, tlBox.y + tlBox.h + 14, 11, COL.muted, 'left');
    txt('2019', tlBox.x + tlBox.w - 2, tlBox.y + tlBox.h + 14, 11, COL.muted, 'right');
    txt('输入窗口 20 天', wx0 + 4, tlBox.y - 10, 11, COL.gold, 'left', 600);
    txt('未来 12 步（标签）', wx1 + 4, tlBox.y - 10, 11, COL.red, 'left', 600);
    var box = { x: 130, y: 300, w: 660, h: 380 };
    panel(70, 280, 760, 420, '');
    txt('一个样本 = 20 天 × 11 城 × 16 通道', box.x, 300, 13.5, COL.gold, 'left', 600);
    // 11×20 热图
    var heat = EX.window.zCasesAll, rows = heat.length, cols = heat[0].length;
    var hw = 560 / cols, hh = 220 / rows;
    var q = ease((tl - 8) / 8);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = heat[r][c];
        var t = clamp((v + 1) / 3, 0, 1);
        var col = 'rgb(' + Math.round(26 + 200 * t) + ',' + Math.round(80 + 90 * t) + ',' + Math.round(150 - 90 * t) + ')';
        ctx.globalAlpha = q;
        ctx.fillStyle = col;
        ctx.fillRect(box.x + c * hw, box.y + 40 + r * hh, hw - 1, hh - 1);
      }
    }
    ctx.globalAlpha = 1;
    txt('城市', box.x - 18, box.y + 40 + 110, 11, COL.muted, 'right');
    txt('20 天', box.x + 280, box.y + 40 + 220 + 14, 11, COL.muted, 'center');
    txt('× 16 通道（此处只画病例 z）', box.x + 4, box.y + 40 + 220 + 32, 11, COL.muted, 'left');
    // 右侧 batch 堆叠
    panel(850, 280, 500, 420, '');
    txt('B 个样本叠成 batch = 32', 870, 310, 13.5, COL.gold, 'left', 600);
    var bk = ease((tl - 20) / 8);
    for (var b = 0; b < 32; b++) {
      var bx = 890 + b * 9, by = 360 + b * 7;
      ctx.globalAlpha = clamp(bk * 1.3 - b * 0.02, 0, 1);
      ctx.fillStyle = b === 0 ? 'rgba(244,185,66,0.95)' : 'rgba(56,189,248,0.22)';
      ctx.strokeStyle = b === 0 ? '#f4b942' : 'rgba(56,189,248,0.5)';
      ctx.fillRect(bx, by, 150, 70); ctx.strokeRect(bx, by, 150, 70);
    }
    ctx.globalAlpha = 1;
    txt('我们这个样本', 890, 640, 11.5, COL.gold, 'left', 600);
    txt('X ∈ R^(32×20×11×16)', 870, 680, 15, '#bfe3ff', 'left');
    txt('y ∈ R^(32×11×12)', 870, 706, 15, '#bfe3ff', 'left');
  }

  /* ---------- 场景 4：模型前向 ---------- */
  function drawModel(tl) {
    bg();
    var phase = tl < 30 ? 0 : (tl < 56 ? 1 : 2);
    if (phase === 0) {
      // 因果卷积
      panel(70, 92, 1300, 560, '');
      txt('多尺度因果卷积：只看过去，不看未来', 100, 132, 16, COL.gold, 'left', 700);
      var N = 20, cellW = 44, x0 = 180, y0 = 260;
      for (var i = 0; i < N; i++) {
        var x = x0 + i * cellW;
        ctx.fillStyle = 'rgba(56,189,248,0.28)';
        ctx.fillRect(x, y0, cellW - 6, 40);
        txt(String(i + 1), x + (cellW - 6) / 2, y0 + 20, 10.5, '#cfe3f7', 'center');
      }
      // 因果遮罩
      ctx.fillStyle = 'rgba(255,107,107,0.16)';
      ctx.fillRect(x0 + 15 * cellW, y0 - 8, 5 * cellW, 56);
      txt('不可见（未来）', x0 + 17 * cellW, y0 - 20, 11, COL.red, 'center');
      var dils = [1, 2, 4];
      var prog = clamp((tl - 2) / 26, 0, 1);
      dils.forEach(function (d, di) {
        var yy = 350 + di * 86;
        txt('dilation = ' + d, x0 - 16, yy + 20, 12.5, COL.cyan, 'right', 600);
        var pos = Math.floor(prog * (N - 1));
        for (var p = 0; p < N; p++) {
          var x2 = x0 + p * cellW;
          ctx.fillStyle = 'rgba(148,163,184,0.18)';
          ctx.fillRect(x2, yy, cellW - 6, 40);
        }
        // 输出位置
        var outX = x0 + pos * cellW;
        ctx.fillStyle = 'rgba(244,185,66,0.35)';
        ctx.fillRect(outX, yy, cellW - 6, 40);
        // 感受野
        for (var k = -2; k <= 0; k++) {
          var src = pos + k * d;
          if (src < 0) continue;
          var sx = x0 + src * cellW;
          ctx.strokeStyle = 'rgba(56,189,248,0.55)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(sx + (cellW - 6) / 2, yy); ctx.lineTo(outX + (cellW - 6) / 2, yy + 40); ctx.stroke();
        }
      });
      txt('K = 2（二阶核），dilations = 1, 2, 4 → 感受野 8 天 + 全局分支补齐 20 天', x0, 700, 12.5, COL.muted, 'left');
      txt('矩阵形式：h^(d) = Σ_m S_{d·m} · h^(0) · w_m', 820, 132, 15, '#bfe3ff', 'left');
      txt('S_m：第 m 个移位矩阵（只把过去移到当前位置）', 820, 162, 12, COL.muted, 'left');
      txt('三种 dilation 并行 → 拼接 → 1×1 卷积融合', 820, 186, 12, COL.muted, 'left');
    } else if (phase === 1) {
      // 城际图
      panel(70, 92, 1300, 560, '');
      txt('城际传播图：19 条行政接壤边，行随机注意权重 C', 100, 132, 16, COL.gold, 'left', 700);
      var box = { x: 260, y: 150, w: 520, h: 430 };
      var nodes = CITYMETA.map(function (c) { return { name: c.name, p: mapPoint(c.lon, c.lat, box) }; });
      var idx = {}; nodes.forEach(function (n2, i) { idx[n2.name] = i; });
      ctx.strokeStyle = 'rgba(120,170,220,0.35)'; ctx.lineWidth = 1.3;
      CITYMETA.forEach(function (c) {
        c.neighbors.forEach(function (nb) {
          if (c.name < nb) {
            var a = nodes[idx[c.name]].p, b = nodes[idx[nb]].p;
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          }
        });
      });
      nodes.forEach(function (n2, i) {
        ctx.beginPath(); ctx.arc(n2.p[0], n2.p[1], 7, 0, Math.PI * 2);
        ctx.fillStyle = '#0ea5e9'; ctx.fill();
        txt(CITYMETA[i].short, n2.p[0], n2.p[1] - 16, 11, '#cfe3f7', 'center');
        var ph = (tl * 0.8 + i * 0.3) % 1;
        ctx.beginPath(); ctx.arc(n2.p[0], n2.p[1], 8 + ph * 20, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56,189,248,' + (0.5 * (1 - ph)) + ')'; ctx.lineWidth = 1.6; ctx.stroke();
      });
      panel(830, 180, 480, 370, '');
      txt('消息传递', 860, 216, 15, COL.gold, 'left', 600);
      txt("h'_i = Σ_j C_ij · h_j", 860, 260, 20, '#bfe3ff', 'left');
      txt('C 行和 = 1（行随机）', 860, 304, 12.5, COL.muted, 'left');
      txt('受 19 条接壤边掩码约束', 860, 328, 12.5, COL.muted, 'left');
      txt('C 随时间几乎不变（准静态）', 860, 352, 12.5, COL.muted, 'left');
      txt('因此图模块提供"结构先验"，', 860, 392, 12.5, COL.cyan, 'left');
      txt('传播方向由数据滞后相关另行展示。', 860, 416, 12.5, COL.cyan, 'left');
      txt('每层参数量很小：图模块 212 / 15,385', 860, 470, 12, COL.muted, 'left');
    } else {
      // 投影 + 双头
      panel(70, 92, 1300, 560, '');
      txt('时间投影与双头：12 步预测', 100, 132, 16, COL.gold, 'left', 700);
      var steps = [
        { y: 210, label: '时空特征  [B,N,W=20,E=32]', color: 'rgba(56,189,248,0.35)' },
        { y: 300, label: '时间投影  W=20 → H=12', color: 'rgba(167,139,250,0.35)' },
        { y: 390, label: '直接头：输出 [B,N,H=12] 病例', color: 'rgba(244,185,66,0.45)' }
      ];
      steps.forEach(function (s2, i) {
        var x = 200, w = 440 + i * 120;
        ctx.fillStyle = s2.color; ctx.strokeStyle = 'rgba(200,230,255,0.4)';
        roundRect(x, s2.y - 34, w, 68, 10); ctx.fill(); ctx.stroke();
        txt(s2.label, x + 20, s2.y, 13.5, '#e6f3ff', 'left', 600);
        if (i < 2) {
          ctx.strokeStyle = 'rgba(148,197,255,0.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + w / 2, s2.y + 34); ctx.lineTo(x + w / 2, s2.y + 56); ctx.stroke();
        }
      });
      // 机理分支
      ctx.strokeStyle = 'rgba(167,139,250,0.8)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(640, 300); ctx.lineTo(760, 300); ctx.lineTo(760, 480); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.25)';
      roundRect(760, 446, 420, 68, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(167,139,250,0.6)'; ctx.stroke();
      txt('机理头（仅训练时辅助）：β 解码 + SC-SIRS', 780, 480, 13, '#e6f3ff', 'left', 600);
      txt('fused = direct（机理头不参与前向预测）', 780, 540, 12.5, COL.cyan, 'left');
      txt('总可学习参数：15,385', 1000, 610, 15, COL.gold, 'left', 600);
      txt('训练目标：L = L_fuse + λ_aux · L_mech（λ_aux = 0.1）', 200, 610, 14, '#bfe3ff', 'left');
    }
  }

  /* ---------- 场景 5：训练 ---------- */
  function drawTraining(tl) {
    bg();
    panel(70, 92, 1300, 560, '');
    txt('训练：在 1,213 个训练窗口上最小化误差', 100, 132, 16, COL.gold, 'left', 700);
    var curves = EX.loss.curves;
    var seeds = Object.keys(curves);
    var maxEp = 0, maxV = 0, minV = 1;
    seeds.forEach(function (s) { curves[s].forEach(function (p) { maxEp = Math.max(maxEp, p[0]); maxV = Math.max(maxV, p[2]); minV = Math.min(minV, p[2]); }); });
    var box = { x: 160, y: 180, w: 900, h: 380 };
    chartBox(box, minV * 0.95, maxV * 1.05, null);
    var prog = clamp((tl - 2) / 26, 0, 1);
    var cols = [COL.gold, 'rgba(56,189,248,0.55)', 'rgba(74,222,128,0.55)'];
    seeds.forEach(function (s, si) {
      var arr = curves[s];
      ctx.strokeStyle = cols[si]; ctx.lineWidth = si === 0 ? 2.6 : 1.4;
      ctx.beginPath();
      var upto = Math.floor(prog * (arr.length - 1));
      for (var i = 0; i <= upto; i++) {
        var x = box.x + arr[i][0] / maxEp * box.w;
        var y = box.y + box.h - (arr[i][2] - minV * 0.95) / (maxV * 1.05 - minV * 0.95) * box.h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    // 最佳点
    var best = curves[seeds[0]].reduce(function (a, b) { return b[2] < a[2] ? b : a; }, curves[seeds[0]][0]);
    var bx = box.x + best[0] / maxEp * box.w, by = box.y + box.h - (best[2] - minV * 0.95) / (maxV * 1.05 - minV * 0.95) * box.h;
    ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fillStyle = COL.gold; ctx.fill();
    txt('best epoch ' + best[0] + ' · val ' + fmt(best[2], 3), bx + 12, by - 14, 12, COL.gold, 'left', 600);
    txt('epoch', box.x + box.w / 2, box.y + box.h + 18, 11, COL.muted, 'center');
    txt('验证损失', box.x - 60, box.y - 14, 11, COL.muted, 'left');
    txt('seed 0', box.x + box.w - 200, box.y + 14, 12, COL.gold, 'left');
    txt('seed 1 / 2', box.x + box.w - 200, box.y + 34, 12, 'rgba(56,189,248,0.7)', 'left');
    panel(1100, 180, 260, 380, '');
    txt('优化设置', 1118, 214, 14, COL.gold, 'left', 600);
    txt('AdamW · lr 5e-4', 1118, 250, 12.5, COL.muted, 'left');
    txt('batch = 32', 1118, 276, 12.5, COL.muted, 'left');
    txt('epochs ≤ 400', 1118, 302, 12.5, COL.muted, 'left');
    txt('early stop patience 20', 1118, 328, 12.5, COL.muted, 'left');
    txt('峰值加权：1 + 5·1[y>Q90]', 1118, 372, 12.5, COL.cyan, 'left');
    txt('15 个随机种子 → 集成', 1118, 416, 12.5, COL.cyan, 'left');
    txt('集成后 RMSE 2.1611', 1118, 452, 12.5, COL.gold, 'left', 600);
    txt('不是"背答案"：每个 epoch 只更新参数，', 100, 660, 13, COL.muted, 'left');
    txt('验证损失用来选最佳断点，测试段从不参与训练。', 100, 686, 13, COL.muted, 'left');
  }

  /* ---------- 场景 6：预测与评估 ---------- */
  function drawEval(tl) {
    bg();
    panel(70, 92, 1300, 560, '');
    txt('预测一个真实样本：太原市 2019-12-17 ~ 12-28', 100, 132, 16, COL.gold, 'left', 700);
    var tg = EX.target, n = tg.dates.length;
    var box = { x: 160, y: 190, w: 780, h: 340 };
    var all = tg.cityTrue.concat(tg.p90, tg.p10, tg.cityPred);
    var ymin = Math.min.apply(null, all) * 0.9, ymax = Math.max.apply(null, all) * 1.08;
    chartBox(box, ymin, ymax, null);
    var stepX = box.w / (n - 1);
    function yOf(v) { return box.y + box.h - (v - ymin) / (ymax - ymin) * box.h; }
    var q = clamp((tl - 1) / 10, 0, 1);
    // 扇形
    ctx.fillStyle = 'rgba(244,185,66,0.20)';
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = box.x + i * stepX;
      if (i === 0) ctx.moveTo(x, yOf(tg.p90[i] * q + tg.cityPred[i] * (1 - q))); else ctx.lineTo(x, yOf(lerp(tg.cityPred[i], tg.p90[i], q)));
    }
    for (var j = n - 1; j >= 0; j--) {
      var x2 = box.x + j * stepX;
      ctx.lineTo(x2, yOf(lerp(tg.cityPred[j], tg.p10[j], q)));
    }
    ctx.closePath(); ctx.fill();
    // 折线
    function line(vals, color, w, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var xx = box.x + k * stepX, yy = yOf(vals[k]);
        if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    line(tg.cityTrue, '#e6eef8', 2.6);
    line(tg.cityPred, COL.gold, 2.6);
    [0, 5, 11].forEach(function (k) { txt(tg.dates[k], box.x + k * stepX, box.y + box.h + 16, 11, COL.muted, 'center'); });
    txt('真实', box.x + 10, box.y + 16, 12, '#e6eef8', 'left', 600);
    txt('集成预测', box.x + 70, box.y + 16, 12, COL.gold, 'left', 600);
    txt('15 种子 P10–P90', box.x + 160, box.y + 16, 12, 'rgba(244,185,66,0.8)', 'left');
    // 指标卡
    var mx = 990;
    var cards = [
      ['总体 RMSE', '2.1611', '比持续性基线差 1.8%'],
      ['校准后（α=0.25）', '2.0125', '比持续性基线好 5.2%'],
      ['总体 PCC', '0.8143', '15 种子集成'],
      ['第 1 / 12 步 RMSE', '0.78 / 3.32', '逐步长误差']
    ];
    cards.forEach(function (c, i) {
      var y = 190 + i * 92;
      ctx.fillStyle = 'rgba(11,22,36,0.8)'; ctx.strokeStyle = COL.line;
      roundRect(mx, y, 330, 78, 10); ctx.fill(); ctx.stroke();
      txt(c[0], mx + 14, y + 18, 11.5, COL.muted, 'left');
      txt(c[1], mx + 14, y + 44, 20, COL.gold, 'left', 700);
      txt(c[2], mx + 14, y + 64, 11, COL.muted, 'left');
    });
    txt('诚实提示：这个样本的假期陡升被低估（预测约 6，真值到 12），', 160, 640, 12.5, COL.muted, 'left');
    txt('但校准后的整体误差仍低于"照抄昨天"的持续性基线。', 160, 664, 12.5, COL.muted, 'left');
    // 流程 recap
    var chain = ['数据', '平滑', '异常', '窗口', '卷积', '图', '投影', '预测', '训练', '校准'];
    var bx2 = 160, by2 = 600;
    chain.forEach(function (c, i) {
      var x = bx2 + i * 112;
      ctx.fillStyle = i <= Math.floor(ease(tl / 12) * chain.length) ? 'rgba(56,189,248,0.35)' : 'rgba(60,80,100,0.2)';
      roundRect(x, by2 - 16, 96, 30, 8); ctx.fill();
      txt(c, x + 48, by2, 12, '#e6f3ff', 'center');
    });
  }

  /* ---------- 章节定义 ---------- */
  var CH_META = [
    { start: 0, end: 15, name: '0 · 项目与数据', draw: drawIntro,
      steps: [{ at: 0, ttl: 'WMEG-Net · 结题可视化', txt: '这是一个真实项目的 5 分钟数据旅程：从一条原始病例记录，到一个 12 步预测。', fml: '' }] },
    { start: 15, end: 62, name: '1 · 原始计数 → 7 日平滑', draw: drawSmooth,
      steps: [
        { at: 0, ttl: '原始逐日计数', txt: '先看 2019 年秋季到年底太原的每日报告数：有尖刺、有 0 值——周末与报告延迟都会造成这种形态。', fml: 'y(1..T)：城市逐日报告病例数' },
        { at: 8, ttl: '7 日平移平均', txt: '为降低报告噪声，用过去 7 天（含当天）的算术平均；它只使用历史，不会引入未来信息。', fml: 'ȳ(t) = (1/7) · Σ_{k=0}^{6} y(t−k)' },
        { at: 26, ttl: '先损失 6 天', txt: '窗口不满 7 天时没有定义，所以每个城市的前 6 天是 NaN——有效数据从第 7 天开始。', fml: 't ≥ 7 时 ȳ(t) 有定义' }
      ] },
    { start: 62, end: 108, name: '2 · 气象异常与标准化', draw: drawWeather,
      steps: [
        { at: 0, ttl: '气象原始序列', txt: '温度、绝对湿度、降水与病例同步观察；但冬季本来就冷、湿度本来就低，直接用原始值会把"季节"误当成"气象影响"。', fml: 'x(t) = 观测值' },
        { at: 10, ttl: '第一步：去季节 → 距平', txt: '用 2015–2018 年同日序平均值作为气候基线，观测减基线得到距平：正=比常年暖/湿，负=比常年冷/干。', fml: 'a(t) = x(t) − clim(day-of-year)' },
        { at: 22, ttl: '第二步：标准化', txt: '病例用训练段的均值/标准差做 z 标准化；μ、σ 只来自训练段，避免测试信息泄漏。', fml: 'z(t) = (x(t) − μ_train) / σ_train' },
        { at: 34, ttl: '组成 16 维输入', txt: '每个城市每天：病例 z + 温度距平 + 湿度距平 + 降水 z + 12 个日历傅里叶谐波。', fml: 'C = 1 + 3 + 12 = 16' }
      ] },
    { start: 108, end: 152, name: '3 · 滑动窗口与一个 batch', draw: drawBatch,
      steps: [
        { at: 0, ttl: '滑动窗口', txt: '在 1826 天时间轴上取连续 20 天作为输入，预测之后 12 天——标签永远在窗口之外。', fml: 'X_t = [x_{t−19}, …, x_t] ∈ R^{20×11×16}' },
        { at: 10, ttl: '一个样本', txt: '本例：输入 2019-11-27 ~ 12-16，预测 12-17 ~ 12-28；太原的病例在 12 月下旬快速上升。', fml: 'y = [y_{t+1}, …, y_{t+12}] ∈ R^{11×12}' },
        { at: 22, ttl: '叠成 batch = 32', txt: '训练时一次取 32 个窗口并行前向/反向；下方这个样本只是 batch 里的第 1 个。', fml: 'X ∈ R^{32×20×11×16}，y ∈ R^{32×11×12}' }
      ] },
    { start: 152, end: 232, name: '4 · 模型前向', draw: drawModel,
      steps: [
        { at: 0, ttl: '多尺度因果卷积', txt: '三种 dilation 并行，每个输出只看见当前位置及以前的输入（右侧未来被遮住）；矩阵形式是"移位 + 加权求和"。', fml: 'h^(d) = Σ_m S_{m} · h^(0) · w_m，d = 1,2,4' },
        { at: 14, ttl: '感受野', txt: 'K=2、dilation=1/2/4 叠加后覆盖 8 天，再配合全局分支覆盖完整 20 天窗口。', fml: 'R_d = d·(K−1) + 1' },
        { at: 30, ttl: '城际传播图', txt: '11 个城市、19 条行政接壤边；每个城市聚合邻居表示。注意：C 行随机、受边掩码约束、时间上近似准静态，是结构先验而非实时流量。', fml: "h'_i = Σ_j C_{ij} · h_j" },
        { at: 56, ttl: '时间投影与双头', txt: '时间维 20 → 12，直接头输出 12 步病例；机理头只作为训练时的辅助正则（β + SC-SIRS），不进前向预测。', fml: 'fused = direct = f(X)，L = L_fuse + λ_aux·L_mech' }
      ] },
    { start: 232, end: 272, name: '5 · 训练：损失如何下降', draw: drawTraining,
      steps: [
        { at: 0, ttl: '训练起点', txt: '一个 epoch = 把 1,213 个训练窗口过一遍；验证损失用于早停，测试段完全不参与。', fml: 'L = L_fuse + 0.1 · L_mech' },
        { at: 8, ttl: '损失下降', txt: '验证损失在前几十个 epoch 快速下降，之后进入平台；最佳断点被保存，用于最终集成。', fml: 'AdamW，lr = 5×10⁻⁴，batch = 32' },
        { at: 20, ttl: '多随机种子', txt: '重复训练 15 个随机种子并平均，降低单次初始化/采样带来的波动（这是"集成"，不是"置信区间"）。', fml: 'ŷ_ens = (1/15) Σ_s ŷ_s' }
      ] },
    { start: 272, end: 300, name: '6 · 预测、评估与校准', draw: drawEval,
      steps: [
        { at: 0, ttl: '这个样本的 12 步预测', txt: '太原 12-17 ~ 12-28：集成预测约 6 例/日，真实值一路升到 12 例/日——本样本的假期陡升被低估。', fml: 'ŷ = [ŷ_{t+1}, …, ŷ_{t+12}]' },
        { at: 10, ttl: '整体水平与校准', txt: '测试段整体 RMSE 2.1611（比持续性差 1.8%）；α=0.25 的收缩校准后 2.0125，比持续性基线好 5.2%。', fml: 'ŷ_cal = y(t_last) + α·(ŷ − y(t_last))，α = 0.25' },
        { at: 20, ttl: '诚实结论', txt: '模型并非"处处更好"：它能抓住季节波形，但对假期陡升不敏感；校准是必要的后处理。这也是项目报告里如实写出的边界。', fml: '数据 → 平滑 → 异常 → 窗口 → 卷积/图 → 投影 → 训练 → 校准' }
      ] }
  ];

  /* ---------- 章节/字幕/时间 ---------- */
  function buildChapters() {
    var box = document.getElementById('chapters');
    CH.forEach(function (c, i) {
      var d = document.createElement('div');
      d.className = 'ch'; d.setAttribute('data-i', i);
      d.innerHTML = '<b>' + c.name + '</b><span>' + fmt(c.start, 0) + '–' + fmt(c.end, 0) + ' s</span>';
      d.addEventListener('click', function () { seek(c.start + 0.01); });
      box.appendChild(d);
    });
  }
  function chapterAt(t) {
    for (var i = CH.length - 1; i >= 0; i--) if (t >= CH[i].start) return i;
    return 0;
  }
  function updateCaption(t) {
    var i = chapterAt(t), c = CH[i], tl = t - c.start;
    var step = c.steps[0];
    for (var k = 0; k < c.steps.length; k++) if (tl >= c.steps[k].at) step = c.steps[k];
    var key = i + '|' + step.at;
    if (key === lastCaptionKey) return;
    lastCaptionKey = key;
    var cap = document.getElementById('caption');
    cap.querySelector('.ttl').textContent = step.ttl;
    cap.querySelector('.txt').textContent = step.txt;
    cap.querySelector('.fml').textContent = step.fml || '';
    var chs = document.querySelectorAll('#chapters .ch');
    for (var j = 0; j < chs.length; j++) chs[j].classList.toggle('on', j === i);
  }
  function render() {
    var i = chapterAt(T), c = CH[i];
    ctx.clearRect(0, 0, W, H);
    c.draw(T - c.start, t0Global(T));
    // 章节标签
    ctx.fillStyle = 'rgba(5,10,18,0.72)';
    roundRect(20, 20, 330, 40, 10); ctx.fill();
    txt(c.name, 38, 42, 15, COL.gold, 'left', 600);
    // 底部信息条 + 全局进度
    ctx.fillStyle = 'rgba(5,10,18,0.72)';
    ctx.fillRect(0, H - 46, W, 46);
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.fillRect(0, H - 4, W, 4);
    ctx.fillStyle = COL.gold;
    ctx.fillRect(0, H - 4, W * (T / DUR), 4);
    txt('第 ' + (i + 1) + ' / 7 章 · 真实数据样本 · 讲解动画 5:00', 20, H - 24, 11, COL.muted, 'left');
    txt('WMEG-Net · 山西 11 市 · 15,385 参数', W - 20, H - 24, 11, COL.muted, 'right');
    updateCaption(T);
    document.getElementById('time').textContent = fmtTime(T) + ' / ' + fmtTime(DUR);
    document.getElementById('range').value = T;
  }
  function t0Global(T) { return T; }
  function fmtTime(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function tick(ts) {
    if (!EX) { requestAnimationFrame(tick); return; }
    if (playing) {
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      T += dt * speed;
      if (T >= DUR) { T = DUR; playing = false; syncPlayBtn(); }
    }
    lastTs = ts;
    render();
    requestAnimationFrame(tick);
  }
  function syncPlayBtn() { document.getElementById('play').textContent = playing ? '❚❚ 暂停' : '▶ 播放'; }
  function seek(t) { T = clamp(t, 0, DUR); lastCaptionKey = ''; render(); }
  function bind() {
    document.getElementById('play').addEventListener('click', function () {
      if (T >= DUR - 0.05) T = 0;
      playing = !playing; syncPlayBtn();
    });
    document.getElementById('range').addEventListener('input', function () { playing = false; syncPlayBtn(); seek(parseFloat(this.value)); });
    document.getElementById('speed').addEventListener('change', function () { speed = parseFloat(this.value); });
    document.getElementById('prev').addEventListener('click', function () { var i = chapterAt(T); seek(i > 0 ? CH[i - 1].start + 0.01 : 0); });
    document.getElementById('next').addEventListener('click', function () { var i = chapterAt(T); seek(i < CH.length - 1 ? CH[i + 1].start + 0.01 : DUR); });
    document.getElementById('full').addEventListener('click', function () {
      var el = document.documentElement;
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (T >= DUR) T = 0; syncPlayBtn(); }
      else if (e.code === 'ArrowRight') { seek(T + 5); }
      else if (e.code === 'ArrowLeft') { seek(T - 5); }
    });
  }
  function load() {
    Promise.all([
      fetch('data/explain_data.json').then(function (r) { return r.json(); }),
      fetch('data/app_data.json').then(function (r) { return r.json(); }),
      fetch('data/geo.json').then(function (r) { return r.json(); })
    ]).then(function (arr) {
      EX = arr[0]; APP = arr[1]; GEO = arr[2];
      CITYMETA = APP.meta.cities.map(function (c) { return { name: c.name, short: c.short, lon: c.lon, lat: c.lat, neighbors: c.neighbors }; });
      CH = CH_META.map(function (c) { return c; });
      buildChapters(); bind();
      var qt = parseFloat(new URLSearchParams(location.search).get('t') || '0');
      seek(isNaN(qt) ? 0 : qt);
      requestAnimationFrame(tick);
    }).catch(function (e) {
      document.getElementById('caption').querySelector('.txt').textContent = '数据加载失败：' + e + '（请通过本地服务器打开）';
    });
  }
  function init() {
    cv = document.getElementById('cv');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.aspectRatio = W + ' / ' + H;
    ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
