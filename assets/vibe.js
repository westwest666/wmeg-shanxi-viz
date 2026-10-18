'use strict';
/* VIBE 知识大赏 · 一个数字的旅程 · 1920×1080 / 30fps / 2:30 */
(function () {
  var W = 1920, H = 1080, DUR = 150;
  var cv, ctx, dpr = 1;
  var EX = null, JR = null, APP = null;
  var T = 0, playing = false, lastTs = 0, RECORD = false;
  try { RECORD = /[?&]record=1/.test(location.search); } catch (e) {}
  var C = { bg0: '#050510', bg1: '#0b0b20', gold: '#c9a96a', ivory: '#e9e4d6', dim: '#8f8a7c', cyan: '#7fc8d6', red: '#d97a66' };
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function fmt(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }
  function serif(s, x, y, size, color, align, italic, weight) {
    ctx.font = (italic ? 'italic ' : '') + (weight || 400) + ' ' + size + 'px Georgia,"Times New Roman","SimSun",serif';
    ctx.fillStyle = color || C.ivory; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function sans(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 400) + ' ' + size + 'px "Microsoft YaHei","Segoe UI",sans-serif';
    ctx.fillStyle = color || C.ivory; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function mono(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 400) + ' ' + size + 'px Consolas,"Courier New",monospace';
    ctx.fillStyle = color || C.ivory; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function spaced(s, x, y, size, color, spacing, align) {
    ctx.font = '400 ' + size + 'px Georgia,"Times New Roman","SimSun",serif';
    ctx.fillStyle = color || C.dim; ctx.textBaseline = 'middle';
    var chars = s.split('');
    var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * (chars.length - 1);
    var cx = align === 'left' ? x : (align === 'right' ? x - total : x - total / 2);
    ctx.textAlign = 'left';
    for (var i = 0; i < chars.length; i++) { ctx.fillText(chars[i], cx, y); cx += widths[i] + spacing; }
  }
  function ink(a) { ctx.globalAlpha = a; }
  function line(x1, y1, x2, y2, color, w, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }
  function bg(t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bg0); g.addColorStop(0.55, '#080818'); g.addColorStop(1, '#0b0b20');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 暗角
    var v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // 细网格
    ctx.strokeStyle = 'rgba(140,150,180,0.035)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += 96) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // 漂浮数字（持续微动）
    ctx.font = '14px Consolas,monospace';
    for (var k = 0; k < 26; k++) {
      var px = (k * 269 + 71) % W;
      var py = ((k * 137 + t * (12 + (k % 5) * 4)) % (H + 80)) - 40;
      ink(0.035 + 0.02 * Math.sin(t + k));
      ctx.fillStyle = '#9fb3d1';
      ctx.fillText((Math.sin(k * 9.1 + t * 0.5) * 2).toFixed(2), px, py);
    }
    ink(1);
  }
  function topLabel(s) {
    line(282, 42, 322, 42, C.gold, 2);
    spaced(s, 334, 42, 12, C.gold, 4, 'left');
  }
  function watermark() {
    mono('WMEG-NET', 90, 42, 14, C.dim, 'left', 600);
    line(90, 52, 186, 52, 'rgba(201,169,106,0.45)', 1);
    mono('SHANXI · 11 CITIES', 90, 66, 9, 'rgba(143,138,124,0.75)', 'left');
    spaced('VIBE 知识大赏', W - 90, 52, 12, 'rgba(201,169,106,0.75)', 3, 'right');
  }
  function annotation(s) {
    line(W / 2 - 30, 782, W / 2 - 14, 782, C.gold, 2);
    sans(s, W / 2, 782, 15, C.dim, 'center');
    line(W / 2 + 30, 782, W / 2 + 14, 782, C.gold, 2);
  }
  function kinetic(s, x, y, size, color, t0, t1, align, weight, italic) {
    var a = ease((T - t0) / 0.7) * (1 - ease((T - t1) / 0.5));
    if (a <= 0.001) return;
    var dy = (1 - ease((T - t0) / 0.8)) * 18;
    ink(a);
    if (italic) serif(s, x, y + dy, size, color, align, true, weight);
    else serif(s, x, y + dy, size, color, align, false, weight);
    ink(1);
  }
  var SUBS = [];
  function buildSubs() {}
  function subtitle(t) {
    var act = actAt(t);
    if (act.label === 'TITLE') return;
    var idx = ACTS.indexOf(act);
    var arr = ACT_SUBS[idx] || [];
    var lt = t - act.start;
    var cur = null, ci = -1;
    for (var i = 0; i < arr.length; i++) if (lt >= arr[i][0]) { cur = arr[i]; ci = i; }
    if (!cur) return;
    var next = ci + 1 < arr.length ? arr[ci + 1][0] : (act.end - act.start);
    var a = Math.min(1, (lt - cur[0]) / 0.5, (next - lt) / 0.4);
    if (a <= 0) return;
    a = clamp(a, 0, 1);
    ink(a * 0.95);
    sans(cur[1], W / 2, 900, 30, C.ivory, 'center', 400);
    serif(cur[2], W / 2, 948, 19, 'rgba(201,169,106,0.85)', 'center', true);
    ink(1);
  }
  function progress(t) {
    ctx.fillStyle = 'rgba(201,169,106,0.12)'; ctx.fillRect(0, H - 5, W, 2);
    ctx.fillStyle = C.gold; ctx.fillRect(0, H - 5, W * (t / DUR), 2);
  }
  function drawChartAxis(x, y, w, h) {
    line(x, y, x + w, y, 'rgba(143,138,124,0.4)', 1);
    line(x, y, x, y - h, 'rgba(143,138,124,0.4)', 1);
  }
  function bigNumber(v, x, y, size, color, t0, t1) {
    var a = ease((T - t0) / 0.5) * (1 - ease((T - t1) / 0.5));
    if (a <= 0.001) return;
    ink(a);
    serif(v, x, y, size, color || C.ivory, 'center', false, 600);
    ink(1);
  }

  function matrixHeat(x, y, cw, ch, vals, opts) {
    opts = opts || {};
    var r = vals.length, c = vals[0].length;
    var lo = opts.lo !== undefined ? opts.lo : Math.min.apply(null, vals.map(function (row) { return Math.min.apply(null, row); }));
    var hi = opts.hi !== undefined ? opts.hi : Math.max.apply(null, vals.map(function (row) { return Math.max.apply(null, row); }));
    var rev = opts.reveal === undefined ? 1 : opts.reveal;
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        var a = clamp(rev * (r + c) - (i + j), 0, 1); if (a <= 0) continue;
        var v = vals[i][j];
        var q = clamp((v - lo) / (hi - lo + 1e-9), 0, 1);
        ink(a);
        ctx.fillStyle = opts.fixed || ('rgba(' + Math.round(18 + 230 * q) + ',' + Math.round(30 + 150 * q) + ',' + Math.round(42 + 90 * q) + ',' + (0.25 + 0.7 * q) + ')');
        ctx.fillRect(x + j * cw, y + i * ch, cw - 1, ch - 1);
        if (opts.numbers) {
          ctx.fillStyle = q > 0.62 ? '#1a1408' : 'rgba(233,228,214,0.88)';
          ctx.font = (opts.font || 9) + 'px Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(fmt(v, opts.digits === undefined ? 2 : opts.digits), x + j * cw + cw / 2 - 0.5, y + i * ch + ch / 2);
        }
        ink(1);
      }
    }
    if (opts.highlightRow !== undefined) {
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y + opts.highlightRow * ch - 2, c * cw + 3, ch + 3);
    }
  }

  /* ---------- 0 · HOOK ---------- */
  function sceneHook(tl) {
    ink(ease(tl / 1.5));
    serif('真实数据 · 山西 · 2015—2019', W / 2, 250, 20, C.dim, 'center', true);
    ink(1);
    kinetic('一条数据，能预测未来吗？', W / 2, 360, 62, C.ivory, 2.2, 99, 'center', 400);
    if (tl > 5.2) {
      var a = ease((tl - 5.2) / 1.2);
      ink(a);
      ctx.strokeStyle = 'rgba(201,169,106,' + (0.35 + 0.25 * Math.sin(tl * 2)) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(W / 2, 620, 150 + 14 * Math.sin(tl * 1.4), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, 620, 190 + 8 * Math.sin(tl * 1.1 + 1), 0, Math.PI * 2); ctx.stroke();
      serif('2.04', W / 2, 620, 220, C.gold, 'center', false, 600);
      ink(1);
    }
    kinetic('一个数字，穿过 15,385 个参数。', W / 2, 690, 26, C.dim, 9.2, 99, 'center', 400);
    kinetic('最后变成一条预测。', W / 2, 736, 26, C.dim, 11.6, 99, 'center', 400);
    annotation('REAL DATA · TAIYUAN · 2019-12-16');
  }

  /* ---------- 1 · TITLE ---------- */
  function sceneTitle(tl) {
    ctx.fillStyle = 'rgba(5,5,16,0.82)'; ctx.fillRect(0, 0, W, H);
    var a = ease(tl / 0.8);
    ink(a);
    spaced('VIBE 知识大赏', W / 2, 380, 16, C.gold, 7, 'center');
    line(W / 2 - 60, 412, W / 2 + 60, 412, C.gold, 1.5);
    serif('一个数字的旅程', W / 2, 500, 96, C.ivory, 'center', false, 400);
    serif('The Journey of a Number', W / 2, 570, 30, 'rgba(201,169,106,0.9)', 'center', true);
    sans('WMEG-Net · 山西 11 个地级市 · 2015—2019', W / 2, 650, 18, C.dim, 'center');
    ink(1);
    var scan = (tl * 0.6) % 1;
    line(0, 760 + scan * 12, W, 760 + scan * 12, 'rgba(201,169,106,0.12)', 1);
  }

  /* ---------- 2 · DATA ---------- */
  function sceneData(tl) {
    var prov = APP.meta.province.casesSmoothSum, n = prov.length;
    var dates = APP.meta.dates;
    var endIdx = dates.indexOf('2019-12-16'), t0 = endIdx - 19;
    var x0 = 150, x1 = 1770, y = 380, hh = 120;
    if (tl < 8) {
      // 时间轴 + 全省曲线
      var mx = Math.max.apply(null, prov) || 1;
      ctx.strokeStyle = 'rgba(127,200,214,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var x = x0 + i / (n - 1) * (x1 - x0);
        var yy = y + hh - (prov[i] || 0) / mx * hh;
        if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      var wx0 = x0 + t0 / (n - 1) * (x1 - x0), wx1 = x0 + endIdx / (n - 1) * (x1 - x0);
      var fx1 = x0 + Math.min(n - 1, endIdx + 12) / (n - 1) * (x1 - x0);
      ctx.fillStyle = 'rgba(127,200,214,0.16)'; ctx.fillRect(wx0, y - 8, wx1 - wx0, hh + 16);
      ctx.fillStyle = 'rgba(217,122,102,0.16)'; ctx.fillRect(wx1, y - 8, fx1 - wx1, hh + 16);
      line(wx0, y + hh + 16, wx0, y + hh + 26, C.cyan, 1);
      sans('20 天输入', (wx0 + wx1) / 2, y + hh + 40, 13, C.cyan, 'center');
      sans('12 步输出', (wx1 + fx1) / 2, y + hh + 40, 13, C.red, 'center');
      for (var yr = 2015; yr <= 2019; yr++) {
        var xi = dates.indexOf(yr + '-01-01');
        if (xi >= 0) sans(String(yr), x0 + xi / (n - 1) * (x1 - x0), y + hh + 70, 13, C.dim, 'center');
      }
      sans('11 座城市 · 1826 天', W / 2, 210, 28, C.ivory, 'center');
      annotation('DATA · SHANXI · 2015—2019');
    } else if (tl < 16) {
      // 7 日平滑
      var raw = EX.window.matrix.raw, dates2 = EX.window.matrix.dates;
      var bx = 170, by = 690, bw = 760, bh = 260;
      var mxr = Math.max.apply(null, raw);
      for (var k = 0; k < raw.length; k++) {
        var h = raw[k] / mxr * bh;
        var isW = k >= raw.length - 7;
        ctx.fillStyle = isW ? 'rgba(201,169,106,0.9)' : 'rgba(143,138,124,0.35)';
        ctx.fillRect(bx + k * (bw / raw.length), by - h, bw / raw.length - 6, h);
        if (isW) mono(fmt(raw[k], 0), bx + k * (bw / raw.length) + bw / 32, by - h - 14, 13, C.gold);
      }
      serif('ȳ(t) = [ y(t−6) + … + y(t) ] / 7', 170, 260, 36, C.ivory, 'left', true);
      mono('9+11+4+3+4+7+6 = 44', 1160, 300, 30, C.ivory, 'left');
      mono('44 / 7 = 6.29', 1160, 360, 44, C.gold, 'left', 600);
      sans('7 天一个窗口，逐日滚动', 1160, 430, 18, C.dim, 'left');
      annotation('FORMULA · 7-DAY MOVING AVERAGE');
    } else if (tl < 23) {
      // 标准化
      serif('z = ( x − μ ) / σ', W / 2, 300, 64, C.ivory, 'center');
      mono('= (6.29 − 1.20) / 2.49', W / 2, 400, 32, C.dim, 'center');
      if (tl > 16.5) { ink(ease((tl - 16.5) / 0.8)); serif('2.04', W / 2, 560, 200, C.gold, 'center', false, 600); ink(1); }
      sans('真实值 · 太原 · 2019-12-16', W / 2, 690, 16, C.dim, 'center');
      annotation('STANDARDIZE · z-SCORE');
    } else {
      // 16 通道向量
      var lr = EX.window.matrix.X[EX.window.matrix.X.length - 1];
      var labels = ['z(x)', 'T′', 'AH′', 'z(P)', 's1', 'c1', 's2', 'c2', 's3', 'c3', 's4', 'c4', 's5', 'c5', 's6', 'c6'];
      for (var j = 0; j < 16; j++) {
        var cx = 160 + j * 100, cy = 470;
        var a = ease((tl - 23) / 2 - j * 0.04);
        if (a <= 0) continue;
        ink(a);
        ctx.fillStyle = lr[j] >= 0 ? 'rgba(201,169,106,' + (0.25 + Math.min(0.6, Math.abs(lr[j]) / 2)) + ')' : 'rgba(127,200,214,' + (0.18 + Math.min(0.5, Math.abs(lr[j]) / 4)) + ')';
        ctx.fillRect(cx, cy, 86, 70);
        mono(fmt(lr[j], 2), cx + 43, cy + 30, 14, C.ivory);
        sans(labels[j], cx + 43, cy + 58, 11, C.dim);
        ink(1);
      }
      sans('16 个通道 = 病例 z + 温度/湿度距平 + 降水 z + 12 个日历谐波', W / 2, 630, 20, C.dim, 'center');
      annotation('FEATURES · 16 CHANNELS');
    }
  }

  /* ---------- 3 · MATRIX ---------- */
  function sceneMatrix(tl) {
    var X = EX.window.matrix.X, dates = EX.window.matrix.dates;
    if (tl < 4) {
      var reveal = ease(tl / 3);
      matrixHeat(150, 230, 44, 21, X, { reveal: reveal, numbers: true, digits: 2, font: 7.5, lo: -1.2, hi: 2.4 });
      sans('X · 20 天 × 16 通道', 150, 205, 16, C.gold, 'left');
      sans('2019-12-16', 150, 700, 13, C.dim, 'left');
      annotation('INPUT MATRIX · 20 × 16');
    } else if (tl < 7.5) {
      matrixHeat(150, 230, 44, 21, X, { reveal: 1, numbers: true, digits: 2, font: 7.5, lo: -1.2, hi: 2.4 });
      var WT = JR.WTrained;
      matrixHeat(1450, 230, 18, 11, WT, { reveal: 1, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
      sans('W · 32 × 16', 1450, 205, 16, C.gold, 'left');
      sans('权重矩阵（可学习参数）', 1450, 660, 13, C.dim, 'left');
      // 第 11 行权重条
      var row = JR.WTrained[10];
      for (var j = 0; j < 16; j++) {
        var x = 300 + j * 82, y = 640;
        ctx.fillStyle = row[j] >= 0 ? 'rgba(201,169,106,0.85)' : 'rgba(127,200,214,0.75)';
        var bh = Math.min(110, Math.abs(row[j]) * 200 + 5);
        ctx.fillRect(x, y - bh / 2, 56, bh);
        mono(fmt(row[j], 2), x + 28, y - bh / 2 - 16, 12, C.ivory);
        sans('w' + (j + 1), x + 28, y + 72, 10, C.dim);
      }
      annotation('WEIGHTS · 32 × 16');
    } else {
      // 点积 → pre → GELU
      var xv = JR.x, wv = JR.featureTrace.wTrained;
      var done = clamp(Math.floor((tl - 7.5) / 0.24), 0, 16);
      var sum = 0;
      for (var i = 0; i < 16; i++) {
        var r = Math.floor(i / 8), c = i % 8;
        var xx = 180 + c * 120, yy = 300 + r * 110;
        if (i <= done) {
          sum += xv[i] * wv[i];
          ink(0.9);
          sans('x' + (i + 1) + ' ' + fmt(xv[i], 2), xx, yy, 13, C.dim, 'left');
          sans('w ' + fmt(wv[i], 2), xx, yy + 24, 13, C.cyan, 'left');
          mono('= ' + fmt(xv[i] * wv[i], 2), xx, yy + 50, 18, C.gold, 'left', 600);
          ink(1);
        }
      }
      mono('Σ = ' + fmt(sum, 2), 1300, 360, 34, C.ivory, 'left');
      mono('+ b = ' + fmt(JR.biasTrained[10], 2), 1300, 415, 24, C.dim, 'left');
      mono('pre = ' + fmt(JR.featureTrace.preTrained, 3), 1300, 490, 44, C.cyan, 'left', 600);
      // GELU 曲线
      var gx = 1300, gy = 760, gw = 420, gh = 180;
      line(gx, gy, gx + gw, gy, 'rgba(143,138,124,0.4)', 1);
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath();
      function gelu(z) { return 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z))); }
      for (var p = -4; p <= 4; p += 0.03) {
        var gx2 = gx + (p + 4) / 8 * gw, gy2 = gy - gelu(p) * 42;
        if (p === -4) ctx.moveTo(gx2, gy2); else ctx.lineTo(gx2, gy2);
      }
      ctx.stroke();
      mono('GELU(pre) = ' + fmt(JR.featureTrace.postTrained, 3), gx, gy + 40, 20, C.gold, 'left');
      annotation('DOT PRODUCT → PRE → GELU');
    }
  }

  /* ---------- 4 · ENCODER ---------- */
  function sceneEncoder(tl) {
    if (tl < 6) {
      var stages = [
        ['GELU', JR.featureTrace.postTrained],
        ['编码器', JR.chain.stages[1].trained],
        ['时间投影', JR.chain.stages[2].trained],
        ['输出', JR.chain.stages[3].trained]
      ];
      var pos = clamp((tl - 0.5) / 5, 0, 1) * 3;
      for (var i = 0; i < 4; i++) {
        var x = 150 + i * 440, y = 470;
        sans(stages[i][0], x + 160, y - 80, 18, C.dim, 'center');
        mono(fmt(stages[i][1], 3), x + 160, y, i === 3 ? 58 : 42, i === 3 ? C.gold : C.ivory, 'center', 600);
        if (i < 3) line(x + 340, y, x + 440, y, 'rgba(201,169,106,0.35)', 1);
      }
      var dx = 150 + pos * 440 + 160;
      ctx.beginPath(); ctx.arc(dx, 580, 5, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
      sans('同一个特征值，被逐层改写', W / 2, 700, 20, C.dim, 'center');
      annotation('SAME FEATURE · FOUR STAGES');
    } else {
      // 图 + 因果卷积（短）
      var box = { x: 240, y: 250, w: 560, h: 400 };
      var cities = APP.meta.cities;
      var minLon = 110.2, maxLon = 114.6, minLat = 34.6, maxLat = 40.8;
      var sc = Math.min(box.w / (maxLon - minLon), box.h / (maxLat - minLat));
      function pt(c) { return [box.x + (c.lon - minLon) * sc + (box.w - (maxLon - minLon) * sc) / 2, box.y + (maxLat - c.lat) * sc + (box.h - (maxLat - minLat) * sc) / 2]; }
      var idx = {}; cities.forEach(function (c, i) { idx[c.name] = i; });
      cities.forEach(function (c) {
        c.neighbors.forEach(function (nb) { if (c.name < nb) { var a = pt(c), b = pt(cities[idx[nb]]); line(a[0], a[1], b[0], b[1], 'rgba(143,138,124,0.32)', 1); } });
      });
      cities.forEach(function (c, i) {
        var pp = pt(c), ph = (tl * 0.9 + i * 0.3) % 1;
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 5, 0, Math.PI * 2); ctx.fillStyle = C.cyan; ctx.fill();
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 6 + ph * 16, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(127,200,214,' + (0.55 * (1 - ph)) + ')'; ctx.lineWidth = 1; ctx.stroke();
      });
      sans('11 座城市 · 接壤边消息传递', 520, 720, 18, C.dim, 'center');
      var cx = 1050, cy = 300;
      for (var d = 0; d < 3; d++) {
        var dial = [1, 2, 4][d];
        sans('dilation ' + dial, cx - 20, cy + d * 110 + 22, 14, C.gold, 'right');
        for (var t2 = 0; t2 < 14; t2++) { ctx.fillStyle = 'rgba(233,228,214,0.08)'; ctx.fillRect(cx + t2 * 46, cy + d * 110, 42, 42); }
        var pos2 = Math.floor(clamp((tl - 6) / 5, 0, 1) * 11);
        ctx.fillStyle = 'rgba(201,169,106,0.45)'; ctx.fillRect(cx + pos2 * 46, cy + d * 110, 42, 42);
        for (var k = -2; k <= 0; k++) { var src = pos2 + k * dial; if (src < 0) continue; line(cx + src * 46 + 21, cy + d * 110 + 42, cx + pos2 * 46 + 21, cy + d * 110 + 42, 'rgba(127,200,214,0.45)', 1); }
      }
      sans('因果卷积：只看过去', 1400, 650, 18, C.dim, 'center');
      annotation('GRAPH + CAUSAL CONVOLUTION');
    }
  }

  /* ---------- 5 · LEARNING ---------- */
  function sceneLearning(tl) {
    if (tl < 9) {
      var WI = JR.WInit, WT = JR.WTrained;
      matrixHeat(200, 250, 10, 8, WI, { reveal: 1, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
      matrixHeat(470, 250, 10, 8, WT, { reveal: 1, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
      sans('初始化 W', 280, 550, 16, C.dim, 'center');
      sans('训练后 W', 550, 550, 16, C.gold, 'center');
      var rowW = JR.featureTrace.wTrained, rowI = JR.featureTrace.wInit;
      var p = ease((tl - 2) / 5);
      for (var j = 0; j < 16; j++) {
        var y = 640 + j * 20;
        var v = lerp(rowI[j], rowW[j], p);
        line(880, y, 1480, y, 'rgba(143,138,124,0.18)', 1);
        ctx.fillStyle = v >= 0 ? 'rgba(201,169,106,0.75)' : 'rgba(127,200,214,0.7)';
        ctx.fillRect(880 + 300 * clamp((v + 0.8) / 1.6, 0, 1) - 2, y - 4, 4, 8);
        mono(fmt(rowI[j], 2) + ' → ' + fmt(rowW[j], 2), 1520, y, 11, j === 0 ? C.gold : C.dim, 'left');
      }
      sans('第 11 行：16 个权重从随机走向训练值', 1200, 210, 18, C.ivory, 'center');
      sans('pre 0.899 → −0.319　　GELU 0.733 → −0.120', 1200, 600, 18, C.dim, 'center');
      annotation('θ 从随机初始化 → 训练后');
    } else {
      var curves = JR.loss.curves, keys = Object.keys(curves);
      var maxEp = 0, lo = Infinity, hi = -Infinity;
      keys.forEach(function (s) { curves[s].forEach(function (q) { maxEp = Math.max(maxEp, q[0]); var lv = Math.log10(Math.max(q[2], 0.02)); lo = Math.min(lo, lv); hi = Math.max(hi, lv); }); });
      var bx = 160, by = 660, bw = 760, bh = 340;
      line(bx, by, bx + bw, by, 'rgba(143,138,124,0.35)', 1);
      var prog = ease((tl - 9) / 7);
      keys.forEach(function (s, si) {
        var arr = curves[s];
        ctx.strokeStyle = si === 0 ? C.gold : 'rgba(127,200,214,' + (0.16 + 0.03 * (si % 4)) + ')';
        ctx.lineWidth = si === 0 ? 2 : 1;
        ctx.beginPath();
        var up = Math.floor(prog * (arr.length - 1));
        for (var i = 0; i <= up; i++) { var x = bx + arr[i][0] / maxEp * bw; var lv2 = Math.log10(Math.max(arr[i][2], 0.02)); var y = by - (lv2 - lo) / (hi - lo + 1e-6) * bh; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      });
      sans('15 个种子 · 验证损失（log）', 540, 240, 20, C.ivory, 'center');
      var O = JR.output, n = O.dates.length;
      var ox = 1080, oy = 660, ow = 620, oh = 300;
      var all = O.true.concat(O.trained, O.init);
      var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
      function yy2(v) { return oy - (v - mn) / (mx - mn + 1e-6) * oh; }
      function line3(vals, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); for (var i = 0; i < n; i++) { var x = ox + i / (n - 1) * ow; if (i === 0) ctx.moveTo(x, yy2(vals[i])); else ctx.lineTo(x, yy2(vals[i])); } ctx.stroke(); }
      line3(O.true, 'rgba(233,228,214,0.8)', 2);
      line3(O.init, 'rgba(143,138,124,0.7)', 1.5);
      line3(O.trained, C.gold, 2.5);
      sans('12 步输出：真值 / 初始化 / 训练后', 1390, 240, 18, C.ivory, 'center');
      annotation('TRAINING · 15 SEEDS');

    }
  }

  /* ---------- 6 · EVIDENCE ---------- */
  function sceneEvidence(tl) {
    if (tl < 8) {
      // 指标与诚实结论
      serif('2.1611', W / 2 - 400, 380, 96, C.ivory, 'center', false, 600);
      sans('模型 RMSE', W / 2 - 400, 460, 18, C.dim, 'center');
      serif('2.1225', W / 2 + 80, 380, 96, 'rgba(143,138,124,0.9)', 'center', false, 600);
      sans('持续性基线', W / 2 + 80, 460, 18, C.dim, 'center');
      sans('仍差 1.8%', W / 2 - 160, 520, 22, C.red, 'center');
      serif('2.0125', W / 2 + 520, 380, 96, C.gold, 'center', false, 600);
      sans('校准后 α=0.25', W / 2 + 520, 460, 18, C.dim, 'center');
      annotation('HONEST RESULT · CALIBRATION');
    } else {
      var tg = EX.target, n = tg.dates.length;
      var bx = 300, by = 660, bw = 900, bh = 340;
      var all = tg.cityTrue.concat(tg.p90, tg.p10, tg.cityPred);
      var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
      function yy3(v) { return by - (v - mn) / (mx - mn + 1e-6) * bh; }
      ctx.fillStyle = 'rgba(201,169,106,0.12)'; ctx.beginPath();
      for (var i = 0; i < n; i++) { var x = bx + i / (n - 1) * bw; if (i === 0) ctx.moveTo(x, yy3(tg.p90[i])); else ctx.lineTo(x, yy3(tg.p90[i])); }
      for (var j = n - 1; j >= 0; j--) ctx.lineTo(bx + j / (n - 1) * bw, yy3(tg.p10[j]));
      ctx.closePath(); ctx.fill();
      function line5(vals, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); for (var i = 0; i < n; i++) { var x = bx + i / (n - 1) * bw; if (i === 0) ctx.moveTo(x, yy3(vals[i])); else ctx.lineTo(x, yy3(vals[i])); } ctx.stroke(); }
      line5(tg.cityTrue, 'rgba(233,228,214,0.9)', 2.5);
      line5(tg.cityPred, C.gold, 2.5);
      sans('真实', bx, by - bh - 16, 14, C.ivory, 'left');
      sans('预测', bx + 50, by - bh - 16, 14, C.gold, 'left');
      if (tl > 8.5) { ink(ease((tl - 8.5) / 0.8)); serif('6 → 12.3', 1450, 340, 64, C.gold, 'center', false, 600); ink(1); }
      sans('假期陡升被低估', 1450, 410, 20, C.red, 'center');
      sans('预测约 6 例/日，真实升到 12.3', 1450, 448, 16, C.dim, 'center');
      annotation('FAILURE MODE · HOLIDAY SURGE');
    }
  }

  /* ---------- 6b · LANDING ---------- */
  function sceneLanding(tl) {
    // C 矩阵 + 结构先验 + 参数量
    var cities = APP.meta.cities;
    var deg = cities.map(function (c) { return c.neighbors.length; });
    var Cm = [];
    for (var i = 0; i < 11; i++) {
      var row = [];
      for (var j = 0; j < 11; j++) {
        if (i === j) row.push(1 / (deg[i] + 1));
        else if (cities[i].neighbors.indexOf(cities[j].name) >= 0) row.push(1 / (deg[i] + 1));
        else row.push(0);
      }
      Cm.push(row);
    }
    matrixHeat(220, 300, 34, 26, Cm, { reveal: ease(tl / 4), numbers: false, lo: 0, hi: 0.34 });
    sans('C · 11 × 11 行随机矩阵', 220, 700, 18, C.gold, 'left');
    serif('结构先验，准静态', 1180, 380, 46, C.ivory, 'left', false, 600);
    sans('C 几乎不随时间变化，不是实时传播流量', 1180, 450, 20, C.dim, 'left');
    serif('15,385', 1180, 570, 64, C.gold, 'left', false, 600);
    sans('个可学习参数', 1180, 630, 20, C.dim, 'left');
    sans('15 个种子集成', 1180, 690, 20, C.cyan, 'left');
    annotation('WHAT IT LEARNED · STRUCTURAL PRIOR');
  }

  /* ---------- 7 · REFERENCE ---------- */
  function sceneReference(tl) {
    var a = ease(tl / 1.5);
    ink(a);
    spaced('REFERENCE', W / 2, 300, 14, C.gold, 6, 'center');
    serif('WMEG-Net · 山西 11 市 · 2015—2019', W / 2, 400, 40, C.ivory, 'center');
    serif('一个数字的旅程', W / 2, 480, 30, C.gold, 'center', false, 400);
    sans('真实数据；方法示意，不构成流行病学结论。', W / 2, 580, 20, C.dim, 'center');
    sans('VIBE 知识大赏', W / 2, 700, 16, 'rgba(201,169,106,0.8)', 'center');
    ink(1);
  }

  var ACTS = [
    { start: 0, end: 14, label: 'HOOK', draw: sceneHook },
    { start: 14, end: 19, label: 'TITLE', draw: sceneTitle },
    { start: 19, end: 45, label: 'DATA · 2015—2019', draw: sceneData },
    { start: 45, end: 62, label: 'MATRIX', draw: sceneMatrix },
    { start: 62, end: 74, label: 'ENCODER', draw: sceneEncoder },
    { start: 74, end: 104, label: 'LEARNING', draw: sceneLearning },
    { start: 104, end: 124, label: 'EVIDENCE', draw: sceneEvidence },
    { start: 124, end: 140, label: 'LANDING', draw: sceneLanding },
    { start: 140, end: 150, label: 'REFERENCE', draw: sceneReference }
  ];
  var ACT_SUBS = [
    [[0, '一条数据，能预测未来吗？', 'Can one number predict the future?'], [3.6, '先看一个真实的数字。', 'Start with one real number.'], [7.2, '2.04，一个标准化后的值。', '2.04 — a standardized value.'], [11, '它穿过 15,385 个参数。', 'It passes through 15,385 parameters.']],
    [],
    [[0.6, '1826 天，11 座城市。', '1,826 days. Eleven cities.'], [4.2, '每天，用前 7 天做平均。', 'Each day averages the last seven.'], [7.8, '9+11+4+3+4+7+6 = 44。', 'Nine plus eleven … equals 44.'], [11.4, '44 ÷ 7 = 6.29。', 'Forty-four over seven is 6.29.'], [15, '再标准化：z = 2.04。', 'Standardize: z equals 2.04.'], [18.6, '16 个通道，拼成一行。', 'Sixteen channels form one row.'], [22.2, '20 天，就是一个矩阵。', 'Twenty days become a matrix.']],
    [[0.6, '输入矩阵：20 × 16。', 'The input matrix: 20 by 16.'], [4.2, '权重矩阵：32 × 16。', 'The weight matrix: 32 by 16.'], [7.8, '16 次乘加，得到 pre。', 'Sixteen multiply-adds give pre.'], [11.4, 'pre = −0.319。', 'pre equals minus 0.319.'], [15, 'GELU 把它变成 −0.120。', 'GELU turns it into minus 0.120.']],
    [[0.4, '同一个特征值，继续被改写。', 'The same feature keeps being rewritten.'], [4, '−0.332 → 0.639。', 'Minus 0.332, then 0.639.'], [8, '输出 6.57。', 'Output: 6.57.']],
    [[0.6, '但 6.57 是怎么学会的？', 'But how did it learn 6.57?'], [4.2, '训练前，权重是随机的。', 'Before training, the weights are random.'], [7.8, '训练后，它们变了。', 'After training, they have changed.'], [11.4, '0.899 → −0.319。', '0.899 becomes minus 0.319.'], [15, '输出从 6.66 到 6.57。', 'The output moves from 6.66 to 6.57.'], [18.6, '15 个种子，各自学习。', 'Fifteen seeds, each learning.'], [22.2, '损失一路下降。', 'The loss keeps falling.'], [25.8, '但等等——', 'But wait.']],
    [[0.6, '模型 RMSE 2.1611，', 'Model RMSE 2.1611 —'], [4.2, '仍比“照抄昨天”差 1.8%。', 'still 1.8% worse than persistence.'], [7.8, '校准之后，2.0125。', 'After calibration: 2.0125.'], [11.4, '它失败在哪？', 'Where does it fail?'], [15, '假期陡升：预测 6，真实 12。', 'Holiday surge: predicted 6, actual 12.']],
    [[0.6, '这不是 bug，是边界。', 'Not a bug — a boundary.'], [4.2, '15,385 个参数。', '15,385 parameters.'], [7.8, '它学到的不是传播率，', 'What it learned is not transmission rate,'], [11.4, '而是结构先验。', 'but a structural prior.']],
    [[1, '一个数字的旅程，', 'The journey of one number,'], [4, '也是模型学习的全部。', 'is the whole of learning.'], [7, '数据、公式、矩阵、权重。', 'Data, formulas, matrices, weights.']]
  ];
  function actAt(t) { for (var i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].start) return ACTS[i]; return ACTS[0]; }
  function render() {
    bg(T);
    var act = actAt(T);
    if (act.label !== 'TITLE') topLabel(act.label);
    act.draw(T - act.start);
    watermark();
    subtitle(T);
    progress(T);
    var ui = document.getElementById('time');
    if (ui) ui.textContent = fmtTime(T) + ' / ' + fmtTime(DUR);
    var rg = document.getElementById('range');
    if (rg) rg.value = T;
  }
  function fmtTime(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function seek(t) { T = clamp(t, 0, DUR); render(); }
  function tick(ts) {
    if (!EX) { requestAnimationFrame(tick); return; }
    if (playing) {
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      T += dt;
      if (T >= DUR) { T = DUR; playing = false; }
    }
    lastTs = ts; render(); requestAnimationFrame(tick);
  }
  function bind() {
    var poster = document.getElementById('poster');
    poster.addEventListener('click', function () { poster.style.display = 'none'; playing = true; T = 0; });
    document.getElementById('play').addEventListener('click', function () { playing = !playing; this.textContent = playing ? 'PAUSE' : 'PLAY'; });
    document.getElementById('range').addEventListener('input', function () { playing = false; document.getElementById('play').textContent = 'PLAY'; seek(parseFloat(this.value)); });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); playing = !playing; document.getElementById('play').textContent = playing ? 'PAUSE' : 'PLAY'; }
      if (e.code === 'ArrowRight') seek(T + 3);
      if (e.code === 'ArrowLeft') seek(T - 3);
    });
  }
  function load() {
    Promise.all([
      fetch('data/explain_data.json').then(function (r) { return r.json(); }),
      fetch('data/journey_data.json').then(function (r) { return r.json(); }),
      fetch('data/app_data.json').then(function (r) { return r.json(); })
    ]).then(function (arr) {
      EX = arr[0]; JR = arr[1]; APP = arr[2];
      buildSubs();
      if (RECORD) { document.body.classList.add('record'); }
      else { bind(); }
      var qt = parseFloat(new URLSearchParams(location.search).get('t') || '0');
      seek(isNaN(qt) ? 0 : qt);
      window.__vibe = {
        ready: true, duration: DUR,
        seek: function (t) { playing = false; seek(t); },
        captions: function () {
          var out = [];
          ACTS.forEach(function (a, i) {
            (ACT_SUBS[i] || []).forEach(function (s) { out.push({ t: a.start + s[0], cn: s[1], en: s[2] }); });
          });
          return out;
        }
      };
      if (!RECORD) requestAnimationFrame(tick);
    }).catch(function (e) {
      document.body.innerHTML = '<pre style="color:#e9e4d6;padding:30px">data error: ' + e + '</pre>';
    });
  }
  function init() {
    cv = document.getElementById('cv');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
