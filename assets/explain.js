'use strict';
/* ============================================================
   一个样本的旅程 · 5 分钟数学动画（KaTeX 公式 + 真实矩阵）
   ============================================================ */
(function () {
  var W = 1440, H = 740;
  var cv, ctx, dpr = 1, mathLayer;
  var EX = null, APP = null, GEO = null, CITYMETA = null;
  var T = 0, DUR = 300, playing = false, speed = 1, lastTs = 0, lastCaptionKey = '';
  var RECORD = false;
  try { RECORD = /[?&]record=1/.test(location.search); } catch (e) {}
  var COL = { txt: '#e8f0fa', muted: '#8ba2bd', line: '#1d3049', gold: '#f4b942', cyan: '#38bdf8', red: '#ff6b6b', green: '#4ade80', purple: '#a78bfa' };
  var CH = [];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function fmt(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }
  function f2(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2); }
  function tex(s) { try { return katex.renderToString(s, { displayMode: true, throwOnError: false }); } catch (e) { return s; } }
  function txt(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 400) + ' ' + size + 'px "Microsoft YaHei","Segoe UI",sans-serif';
    ctx.fillStyle = color || COL.txt; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function bg() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#081321'); g.addColorStop(1, '#050a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,220,0.04)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function setMath(items) {
    // 公式统一放在画布下方的字幕条（KaTeX 排版），画布上不再覆盖公式卡，避免遮挡
    if (mathLayer) mathLayer.innerHTML = '';
  }
  function mapPoint(lon, lat, box) {
    var minLon = 110.2296, maxLon = 114.5689, minLat = 34.5835, maxLat = 40.7399;
    var s = Math.min(box.w / (maxLon - minLon), box.h / (maxLat - minLat));
    return [box.x + (lon - minLon) * s + (box.w - (maxLon - minLon) * s) / 2,
            box.y + (maxLat - lat) * s + (box.h - (maxLat - minLat) * s) / 2];
  }
  function panel(x, y, w, h, title) {
    ctx.fillStyle = 'rgba(10,20,33,0.86)';
    ctx.strokeStyle = 'rgba(56,189,248,0.16)'; ctx.lineWidth = 1;
    roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    if (title) txt(title, x + 14, y + 20, 13, COL.muted, 'left', 600);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function heat(v, div) {
    // div=true: 以 0 为中心蓝-灰-红；否则青-金
    var t = clamp(v, -1.8, 1.8) / 1.8;
    if (!div) {
      var u = clamp(v, 0, 1);
      return 'rgba(' + Math.round(24 + 220 * u) + ',' + Math.round(95 + 100 * u) + ',' + Math.round(160 - 100 * u) + ',' + (0.18 + 0.6 * u) + ')';
    }
    if (t < 0) return 'rgba(56,140,200,' + (0.18 + 0.7 * (-t)) + ')';
    return 'rgba(220,90,70,' + (0.18 + 0.7 * t) + ')';
  }
  function matrix(x, y, cw, ch, values, rowLabels, colLabels, opts) {
    opts = opts || {};
    var r = values.length, c = values[0].length;
    var reveal = opts.reveal === undefined ? 1 : opts.reveal;
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        var a = clamp(reveal * (r + c) - (i + j), 0, 1);
        if (a <= 0) continue;
        var v = values[i][j];
        ctx.globalAlpha = a;
        ctx.fillStyle = opts.color ? opts.color(v) : heat(v, opts.div);
        ctx.fillRect(x + j * cw, y + i * ch, cw - 1.2, ch - 1.2);
        if (opts.numbers !== false) {
          ctx.fillStyle = 'rgba(232,240,250,0.92)';
          ctx.font = (opts.font || 9.5) + 'px Consolas,"Segoe UI",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(fmt(v, opts.digits === undefined ? 2 : opts.digits), x + j * cw + cw / 2 - 0.6, y + i * ch + ch / 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (rowLabels) {
      ctx.fillStyle = COL.muted; ctx.font = '9.5px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var i2 = 0; i2 < r; i2++) ctx.fillText(rowLabels[i2], x - 8, y + i2 * ch + ch / 2);
    }
    if (colLabels) {
      ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (var j2 = 0; j2 < c; j2++) ctx.fillText(colLabels[j2], x + j2 * cw + cw / 2, y + r * ch + 6);
    }
    if (opts.highlightRow !== undefined) {
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y + opts.highlightRow * ch - 2, c * cw + 3, ch + 3);
    }
    if (opts.highlightCol !== undefined) {
      ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2;
      ctx.strokeRect(x + opts.highlightCol * cw - 2, y - 2, cw + 3, r * ch + 3);
    }
  }

  /* ---------- Ch0：一个样本 / 一个 batch ---------- */
  function drawIntro(tl) {
    bg();
    var prov = APP.meta.province.casesSmoothSum, n = prov.length;
    var cx0 = 90, cx1 = 1350, cy = 150, chh = 90;
    var mxv = Math.max.apply(null, prov) || 1;
    ctx.strokeStyle = 'rgba(56,189,248,0.55)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = cx0 + i / (n - 1) * (cx1 - cx0);
      var y = cy + chh - (prov[i] || 0) / mxv * chh;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    var dates = APP.meta.dates;
    var endIdx = dates.indexOf('2019-12-16'), t0 = endIdx - 19;
    var wx0 = cx0 + t0 / (n - 1) * (cx1 - cx0), wx1 = cx0 + endIdx / (n - 1) * (cx1 - cx0);
    var fx1 = cx0 + Math.min(n - 1, endIdx + 12) / (n - 1) * (cx1 - cx0);
    ctx.fillStyle = 'rgba(56,189,248,0.20)'; ctx.fillRect(wx0, cy - 6, wx1 - wx0, chh + 12);
    ctx.fillStyle = 'rgba(255,107,107,0.16)'; ctx.fillRect(wx1, cy - 6, fx1 - wx1, chh + 12);
    txt('全省 11 城逐日平滑病例（2015–2019）', cx0, cy - 18, 11.5, COL.muted, 'left');
    txt('2015', cx0, cy + chh + 18, 10.5, COL.muted, 'left');
    txt('2019', cx1, cy + chh + 18, 10.5, COL.muted, 'right');
    ctx.fillStyle = 'rgba(56,189,248,0.35)'; ctx.fillRect(cx0, cy + chh + 30, 12, 12);
    txt('输入窗口 20 天', cx0 + 18, cy + chh + 37, 11.5, COL.cyan, 'left');
    ctx.fillStyle = 'rgba(255,107,107,0.35)'; ctx.fillRect(cx0 + 150, cy + chh + 30, 12, 12);
    txt('未来 12 步（标签）', cx0 + 168, cy + chh + 37, 11.5, COL.red, 'left');
    // 左：样本张量
    panel(80, 290, 790, 390, '');
    txt('一个样本：20 天 × 11 城 × 16 通道', 100, 322, 14, COL.gold, 'left', 600);
    var gx = 230, gy = 360, cw = 29, chH = 18;
    for (var r = 0; r < 11; r++) {
      for (var c = 0; c < 20; c++) {
        var a = ease((tl - 1.5) / 3) * clamp((r + c) / 30, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = r === 0 ? 'rgba(244,185,66,0.55)' : 'rgba(56,189,248,0.22)';
        ctx.fillRect(gx + c * cw, gy + r * chH, cw - 2, chH - 2);
        ctx.globalAlpha = 1;
      }
    }
    txt('11 城', gx - 14, gy + 100, 10.5, COL.muted, 'right');
    txt('20 天', gx + 290, gy + 218, 10.5, COL.muted, 'center');
    txt('每格 = 一个城市的一天；深度方向是 16 个通道', gx - 140, gy + 240, 11, COL.muted, 'left');
    txt('太原这一行 = 讲解样本', gx + 10, gy + 8, 10.5, COL.gold, 'left');
    // 右：batch 32 个样本（8×4）
    panel(900, 290, 460, 390, '');
    txt('一个 batch = 32 个样本', 920, 322, 14, COL.gold, 'left', 600);
    for (var b = 0; b < 32; b++) {
      var col = b % 8, row = Math.floor(b / 8);
      var bx = 928 + col * 52, by = 360 + row * 52;
      ctx.globalAlpha = ease((tl - 1.2) / 2) * clamp(1.2 - b * 0.015, 0, 1);
      ctx.fillStyle = b === 0 ? 'rgba(244,185,66,0.8)' : 'rgba(56,189,248,0.14)';
      ctx.strokeStyle = b === 0 ? '#f4b942' : 'rgba(56,189,248,0.32)';
      ctx.fillRect(bx, by, 44, 40); ctx.strokeRect(bx, by, 44, 40);
      ctx.globalAlpha = 1;
    }
    txt('高亮 = 我们讲解的第 1 个样本', 928, 620, 10.5, COL.gold, 'left');
    txt('32 × 20 × 11 × 16 个数', 928, 646, 10.5, COL.muted, 'left');
  }

  /* ---------- Ch1：平滑（公式 + 数字计算） ---------- */
  function drawSmooth(tl) {
    bg();
    var w = EX.window.matrix, raw = w.raw, sm = w.smooth, dates = w.dates;
    panel(60, 110, 700, 400, '');
    var bx = 110, by = 440, bw = 610, bh = 230;
    var mx = Math.max.apply(null, raw.map(function (v) { return v || 0; }));
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
    var stepX = bw / (raw.length - 1);
    var reveal = ease((tl - 1) / 5);
    for (var i = 0; i < raw.length; i++) {
      var h = (raw[i] || 0) / mx * bh;
      var alpha = reveal * clamp((i + 2) / 6, 0, 1);
      ctx.globalAlpha = alpha;
      var isLast7 = i >= raw.length - 7;
      ctx.fillStyle = isLast7 ? 'rgba(244,185,66,0.85)' : 'rgba(148,163,184,0.5)';
      ctx.fillRect(bx + i * stepX - stepX * 0.3, by - h, stepX * 0.6, h);
      if (isLast7) {
        txt(fmt(raw[i], 0), bx + i * stepX, by - h - 8, 10, COL.gold, 'center', 600);
      }
      ctx.globalAlpha = 1;
    }
    for (var d = 0; d < raw.length; d += 4) {
      txt(dates[d].slice(5), bx + d * stepX, by + 14, 9.5, COL.muted, 'center');
    }
    txt('太原 · 最近 20 天逐日报告数', 90, 140, 14, COL.gold, 'left', 600);
    txt('原始计数 y(t)', 90, 470, 11.5, COL.muted, 'left');
    txt('金色的 7 天 = 公式里的求和窗口（12-10 ~ 12-16）', 330, 470, 11, COL.gold, 'left');
    // 平滑曲线
    panel(790, 110, 590, 400, '');
    txt('7 日平移平均后的 ȳ(t)', 810, 140, 14, COL.cyan, 'left', 600);
    var px = 850, py = 430, pw = 490, ph = 240;
    var smx = Math.max.apply(null, sm) || 1;
    var prog = ease((tl - 12) / 12);
    ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2.6; ctx.beginPath();
    var started = false;
    for (var k = 0; k < sm.length; k++) {
      if (k / (sm.length - 1) > prog) break;
      var xx = px + k / (sm.length - 1) * pw;
      var yy = py - sm[k] / smx * ph;
      if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    for (var k2 = 0; k2 < sm.length; k2++) {
      if (k2 / (sm.length - 1) > prog) break;
      var xx2 = px + k2 / (sm.length - 1) * pw;
      var yy2 = py - sm[k2] / smx * ph;
      ctx.beginPath(); ctx.arc(xx2, yy2, 3, 0, Math.PI * 2); ctx.fillStyle = COL.cyan; ctx.fill();
      if (k2 === sm.length - 1) txt(fmt(sm[k2], 2), xx2 - 8, yy2 - 14, 12, COL.cyan, 'center', 600);
    }
    txt('平滑序列（前 6 天 NaN，从第 7 天开始）', 850, 500, 10.5, COL.muted, 'left');
    // 数值计算卡
    var ex = EX.example;
    panel(60, 530, 1320, 190, '');
    txt('把公式代入最后一天：' + ex.date, 80, 560, 13.5, COL.gold, 'left', 600);
    var nums = ex.raw7;
    var parts = nums.map(function (v) { return fmt(v, 1); });
    txt('y = [' + parts.join(', ') + ']', 90, 600, 14, '#dbeafe', 'left');
    txt('ȳ = (' + parts.join(' + ') + ') / 7 = ' + fmt(ex.sum7, 2) + ' / 7 = ' + fmt(ex.mean7, 2), 90, 635, 14, COL.cyan, 'left');
    txt('前 6 天窗口不足 7 天 → NaN；从第 7 天起才有平滑值。', 90, 675, 12, COL.muted, 'left');
  }

  /* ---------- Ch2：气象去打季节 + 标准化 + 16 维 ---------- */
  function drawWeather(tl) {
    bg();
    var s = EX.series, n = s.dates.length;
    var ex = EX.example;
    panel(60, 110, 740, 400, '');
    txt('气象：先去掉季节，再标准化', 90, 142, 14, COL.gold, 'left', 600);
    var lr = EX.window.matrix.X[EX.window.matrix.X.length - 1];
    var tAn = lr[1], aAn = lr[2], pz = lr[3], cz = lr[0];
    var items = [
      { name: '气温 T', obs: ex.tavg.obs, clim: ex.tavg.obs - tAn, anom: tAn, color: COL.cyan },
      { name: '绝对湿度 AH', obs: ex.ah.obs, clim: ex.ah.obs - aAn, anom: aAn, color: COL.green },
      { name: '降水 P', obs: ex.precip.obs, z: pz, color: COL.purple }
    ];
    items.forEach(function (it, i) {
      var y = 190 + i * 100;
      txt(it.name, 90, y, 12.5, COL.muted, 'left', 600);
      if (it.z !== undefined) {
        txt('观测 ' + fmt(it.obs, 2) + ' → z(P) = ' + f2(it.z), 200, y, 12.5, '#cfe3f7', 'left');
      } else {
        txt('观测 ' + fmt(it.obs, 2) + '  −  气候基线 ' + fmt(it.clim, 2), 200, y, 12.5, '#cfe3f7', 'left');
        txt('= 距平 ' + f2(it.anom), 620, y, 12.5, it.color, 'left');
      }
    });
    txt('病例：' + fmt(ex.case.smooth, 2) + ' 例（平滑）→ z = ' + f2(cz), 90, 486, 12.5, COL.gold, 'left');
    // 16 维向量
    panel(840, 110, 540, 400, '');
    txt('拼成这一天的输入向量 x_t ∈ ℝ¹⁶', 860, 142, 13.5, COL.gold, 'left', 600);
    var vx = 880, vy = 190, cw = 48, ch = 34;
    var vals = w_lastRow();
    var labels = ['z(x)', 'T′', 'AH′', 'z(P)', 's1', 'c1', 's2', 'c2', 's3', 'c3', 's4', 'c4', 's5', 'c5', 's6', 'c6'];
    var q = ease((tl - 14) / 8);
    for (var i = 0; i < 16; i++) {
      var x = vx + (i % 8) * cw, y = vy + Math.floor(i / 8) * 56;
      ctx.globalAlpha = clamp(q * 20 - i, 0, 1);
      ctx.fillStyle = heat(vals[i], true);
      ctx.fillRect(x, y, cw - 2, ch);
      txt(fmt(vals[i], 2), x + cw / 2 - 1, y + ch / 2, 9.5, '#f4f8ff', 'center');
      txt(labels[i], x + cw / 2 - 1, y + ch + 12, 9, COL.muted, 'center');
      ctx.globalAlpha = 1;
    }
    txt('病例 z + 温度距平 + 湿度距平 + 降水 z + 12 个日历谐波', 880, 480, 11.5, COL.muted, 'left');
    setMath([
      { tex: 'a_t=x_t-c(d_t)', x: 100, y: 560, cls: 'gold' },
      { tex: 'z_t=\\frac{x_t-\\mu}{\\sigma}', x: 330, y: 560, cls: 'gold' },
      { tex: '\\mathbf{x}_t=[z(x_t),\\tilde T_t,\\widetilde{AH}_t,z(P_t),\\sin_1,\\cos_1,\\ldots,\\sin_6,\\cos_6]^{\\top}\\in\\mathbb{R}^{16}', x: 560, y: 560, cls: 'lg' }
    ]);
  }
  function w_lastRow() {
    var X = EX.window.matrix.X;
    return X[X.length - 1];
  }

  /* ---------- Ch3：矩阵画出来 ---------- */
  function drawMatrixScene(tl) {
    bg();
    var w = EX.window.matrix;
    var X = w.X, dates = w.dates;
    var reveal = ease((tl - 2) / 10);
    txt('这就是进入编码器的输入矩阵：每天 16 维，连续 20 天', 90, 80, 15, COL.gold, 'left', 600);
    var x0 = 120, y0 = 120, cw = 58, ch = 23;
    var rows = [];
    for (var i = 0; i < X.length; i++) rows.push(X[i]);
    var rowLabels = dates.map(function (d) { return d.slice(5); });
    var colLabels = ['z(x)', 'T′', 'AH′', 'z(P)', 's1', 'c1', 's2', 'c2', 's3', 'c3', 's4', 'c4', 's5', 'c5', 's6', 'c6'];
    matrix(x0, y0, cw, ch, rows, rowLabels, null, { reveal: reveal, digits: 2, font: 8.5, div: false });
    // 列标签（顶部旋转）
    ctx.save();
    ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif';
    for (var j = 0; j < 16; j++) {
      ctx.save();
      ctx.translate(x0 + j * cw + cw / 2 - 1, y0 - 8);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(colLabels[j], 0, 0);
      ctx.restore();
    }
    ctx.restore();
    // 高亮最后一天
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.4;
    ctx.strokeRect(x0 - 2, y0 + (rows.length - 1) * ch - 2, 16 * cw + 3, ch + 3);
    txt('2019-12-16 这一行 = 输入向量 x_t', x0 + 16 * cw + 14, y0 + (rows.length - 1) * ch + ch / 2, 10, COL.gold, 'left');
    // 右侧：11 城 z 矩阵
    var px = 1120;
    panel(px - 20, 110, 320, 300, '');
    txt('11 城 × 20 天（z 病例）', px, 140, 12, COL.gold, 'left', 600);
    var zc = EX.window.zCasesAll;
    var zRows = [];
    for (var r = 0; r < zc.length; r++) {
      var row = [];
      for (var c2 = 0; c2 < zc[r].length; c2++) row.push(zc[r][c2]);
      zRows.push(row);
    }
    matrix(px + 8, 165, 24, 12, zRows, CITYMETA.map(function (c) { return c.short; }), null, { reveal: reveal, numbers: false, div: true });
    txt('每个城市都有自己的 20×16 矩阵；batch 再把 32 个样本叠起来。', px - 10, 380, 11, COL.muted, 'left');
    txt('行 = 日期（20 天） · 列 = 16 个通道 · 数值 = 标准化/距平后的输入', 90, 640, 13, COL.muted, 'left');
    txt('进入编码器时，这个 20×16 矩阵会被当成一个"张量切片"处理；11 个城市并排得到 20×11×16。', 90, 666, 12, COL.muted, 'left');
  }

  /* ---------- Ch4：矩阵进入编码器 ---------- */
  function drawEncoder(tl) {
    bg();
    var phase = tl < 34 ? 0 : (tl < 58 ? 1 : 2);
    if (phase === 0) {
      txt('矩阵进入编码器：多尺度因果卷积', 90, 80, 16, COL.gold, 'left', 700);
      // 输入矩阵缩略
      var w = EX.window.matrix, X = w.X;
      var rows = []; for (var i = 0; i < 20; i++) rows.push(X[i]);
      var reveal = ease((tl - 1) / 4);
      matrix(100, 140, 26, 13, rows, null, null, { reveal: reveal, numbers: false, div: false });
      txt('X: 20 天 × 16 通道', 100, 420, 11, COL.muted, 'left');
      // 卷积示意
      var bx = 520, by = 170, cw = 40, chh = 18;
      for (var d = 0; d < 3; d++) {
        var dil = [1, 2, 4][d];
        var yy = by + d * 120;
        txt('dilation = ' + dil, bx - 12, yy + 20, 12, COL.cyan, 'right', 600);
        for (var t = 0; t < 20; t++) {
          ctx.fillStyle = 'rgba(148,163,184,0.16)';
          ctx.fillRect(bx + t * cw, yy, cw - 3, 40);
        }
        var pos = Math.min(15, Math.floor(clamp((tl - 4) / 20, 0, 1) * 15));
        ctx.fillStyle = 'rgba(244,185,66,0.35)'; ctx.fillRect(bx + pos * cw, yy, cw - 3, 40);
        for (var k = -2; k <= 0; k++) {
          var src = pos + k * dil; if (src < 0) continue;
          ctx.strokeStyle = 'rgba(56,189,248,0.55)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(bx + src * cw + cw / 2, yy); ctx.lineTo(bx + pos * cw + cw / 2, yy + 40); ctx.stroke();
        }
      }
      txt('未来', bx + 16 * cw, by - 22, 11, COL.red, 'left');
      ctx.fillStyle = 'rgba(255,107,107,0.16)'; ctx.fillRect(bx + 16 * cw, by - 10, 4 * cw, 3 * 120 + 30);
      setMath([
        { tex: '\\mathbf{H}^{(d)}=\\sigma\\Big(\\sum_{m=0}^{K-1}\\mathbf{S}_{d\\,m}\\,\\mathbf{X}\\,\\mathbf{W}_m\\Big)', x: 900, y: 130, cls: 'lg gold' },
        { tex: '\\mathbf{S}_m\\in\\{0,1\\}^{20\\times20}\\text{：把 }t-m\\text{ 移到 }t\\text{ 的移位矩阵（只看过去）}', x: 900, y: 220, cls: '' }
      ]);
    } else if (phase === 1) {
      txt('城际图：19 条行政接壤边上的消息传递', 90, 80, 16, COL.gold, 'left', 700);
      var box = { x: 200, y: 150, w: 520, h: 430 };
      var nodes = CITYMETA.map(function (c) { return { name: c.name, p: mapPoint(c.lon, c.lat, box) }; });
      var idx = {}; nodes.forEach(function (n2, i) { idx[n2.name] = i; });
      ctx.strokeStyle = 'rgba(120,170,220,0.32)'; ctx.lineWidth = 1.2;
      CITYMETA.forEach(function (c) {
        c.neighbors.forEach(function (nb) {
          if (c.name < nb) {
            var a = nodes[idx[c.name]].p, b = nodes[idx[nb]].p;
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          }
        });
      });
      nodes.forEach(function (n2, i) {
        ctx.beginPath(); ctx.arc(n2.p[0], n2.p[1], 6, 0, Math.PI * 2); ctx.fillStyle = '#0ea5e9'; ctx.fill();
        txt(CITYMETA[i].short, n2.p[0], n2.p[1] - 14, 10.5, '#cfe3f7', 'center');
        var ph = (tl * 0.7 + i * 0.3) % 1;
        ctx.beginPath(); ctx.arc(n2.p[0], n2.p[1], 7 + ph * 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56,189,248,' + (0.45 * (1 - ph)) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
      });
      // C 矩阵 11×11 热图
      var C = [];
      var deg = CITYMETA.map(function (c) { return c.neighbors.length; });
      for (var i2 = 0; i2 < 11; i2++) {
        var row = [];
        for (var j2 = 0; j2 < 11; j2++) {
          if (i2 === j2) row.push(1 / (deg[i2] + 1));
          else if (CITYMETA[i2].neighbors.indexOf(CITYMETA[j2].name) >= 0) row.push(1 / (deg[i2] + 1));
          else row.push(0);
        }
        C.push(row);
      }
      panel(820, 150, 520, 430, '');
      txt('行随机注意权重 C（准静态结构先验）', 840, 182, 12.5, COL.muted, 'left', 600);
      matrix(870, 210, 34, 26, C, null, null, { reveal: ease((tl - 2) / 6), numbers: false,
        color: function (v) { return 'rgba(56,189,248,' + (0.05 + 0.75 * Math.min(1, v / 0.34)) + ')'; } });
      txt('每行和 = 1；受 19 条接壤边掩码约束', 870, 540, 11, COL.muted, 'left');
      setMath([
        { tex: "\\mathbf{h}'_i=\\sum_{j\\in\\mathcal{N}(i)}C_{ij}\\,\\mathbf{h}_j", x: 840, y: 590, cls: 'lg gold' }
      ]);
    } else {
      txt('时间投影与双头：20 → 12 步', 90, 80, 16, COL.gold, 'left', 700);
      var blocks = [
        { y: 180, label: '时空特征  H ∈ ℝ^{20×32}', color: 'rgba(56,189,248,0.35)', w: 560 },
        { y: 300, label: '时间投影  W=20 → H=12', color: 'rgba(167,139,250,0.35)', w: 680 },
        { y: 420, label: '直接头  输出 12 步病例  ŷ ∈ ℝ^{12×11}', color: 'rgba(244,185,66,0.4)', w: 800 }
      ];
      blocks.forEach(function (b, i) {
        var x = 180;
        ctx.fillStyle = b.color; ctx.strokeStyle = 'rgba(200,230,255,0.35)';
        roundRect(x, b.y - 34, b.w, 68, 10); ctx.fill(); ctx.stroke();
        txt(b.label, x + 20, b.y, 13, '#e6f3ff', 'left', 600);
        if (i < 2) {
          ctx.strokeStyle = 'rgba(148,197,255,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + b.w / 2, b.y + 34); ctx.lineTo(x + b.w / 2, b.y + 52); ctx.stroke();
        }
      });
      ctx.strokeStyle = 'rgba(167,139,250,0.7)'; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(620, 300); ctx.lineTo(760, 300); ctx.lineTo(760, 500); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.22)'; roundRect(760, 466, 480, 68, 10); ctx.fill();
      txt('机理头（仅训练辅助）：β 解码 + SC-SIRS', 780, 500, 12.5, '#e6f3ff', 'left', 600);
      setMath([
        { tex: '\\hat{\\mathbf{y}}=\\mathbf{W}_{out}\\,\\mathrm{vec}(\\mathbf{H}_{12})\\in\\mathbb{R}^{12\\times11}', x: 180, y: 560, cls: 'lg gold' },
        { tex: '\\mathcal{L}=\\mathcal{L}_{\\mathrm{fuse}}+\\lambda_{\\mathrm{aux}}\\mathcal{L}_{\\mathrm{mech}}', x: 980, y: 560, cls: '' }
      ]);
    }
  }

  /* ---------- Ch5：训练 ---------- */
  function drawTraining(tl) {
    bg();
    panel(60, 110, 1320, 500, '');
    txt('训练：在 1,213 个训练窗口上最小化误差', 90, 144, 15, COL.gold, 'left', 700);
    var curves = EX.loss.curves, seeds = Object.keys(curves);
    var maxEp = 0, maxV = 0, minV = 1;
    seeds.forEach(function (s) { curves[s].forEach(function (p) { maxEp = Math.max(maxEp, p[0]); maxV = Math.max(maxV, p[2]); minV = Math.min(minV, p[2]); }); });
    var bx = 150, by = 210, bw = 860, bh = 340;
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.strokeRect(bx, by, bw, bh);
    var prog = clamp((tl - 2) / 22, 0, 1);
    var cols = [COL.gold, 'rgba(56,189,248,0.6)', 'rgba(74,222,128,0.6)'];
    seeds.forEach(function (s, si) {
      var arr = curves[s];
      ctx.strokeStyle = cols[si]; ctx.lineWidth = si === 0 ? 2.6 : 1.4;
      ctx.beginPath();
      var upto = Math.floor(prog * (arr.length - 1));
      for (var i = 0; i <= upto; i++) {
        var x = bx + arr[i][0] / maxEp * bw;
        var y = by + bh - (arr[i][2] - minV * 0.9) / (maxV * 1.1 - minV * 0.9) * bh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    var best = curves[seeds[0]].reduce(function (a, b) { return b[2] < a[2] ? b : a; }, curves[seeds[0]][0]);
    var bx2 = bx + best[0] / maxEp * bw, by2 = by + bh - (best[2] - minV * 0.9) / (maxV * 1.1 - minV * 0.9) * bh;
    ctx.beginPath(); ctx.arc(bx2, by2, 5, 0, Math.PI * 2); ctx.fillStyle = COL.gold; ctx.fill();
    txt('best epoch ' + best[0] + ' · val ' + fmt(best[2], 3), bx2 + 10, by2 - 14, 11.5, COL.gold, 'left', 600);
    txt('验证损失', bx - 10, by - 14, 10.5, COL.muted, 'left');
    txt('epoch', bx + bw / 2, by + bh + 16, 10.5, COL.muted, 'center');
    txt('AdamW · lr 5e-4 · batch 32 · early stop 20', 150, 590, 12, COL.muted, 'left');
    txt('15 个随机种子 → 集成', 1100, 300, 12.5, COL.cyan, 'left');
    txt('集成 RMSE 2.1611', 1100, 330, 12.5, COL.gold, 'left', 600);
    setMath([
      { tex: '\\mathcal{L}=\\frac{1}{32\\cdot11\\cdot12}\\sum_{b,i,h}\\big(\\hat y_{b,i,h}-y_{b,i,h}\\big)^2', x: 150, y: 620, cls: '' },
      { tex: '\\hat{\\mathbf{y}}^{\\mathrm{ens}}=\\frac{1}{15}\\sum_{s=1}^{15}\\hat{\\mathbf{y}}_s', x: 900, y: 620, cls: '' }
    ]);
  }

  /* ---------- Ch6：预测与校准 ---------- */
  function drawEval(tl) {
    bg();
    var tg = EX.target, n = tg.dates.length;
    panel(60, 110, 860, 480, '');
    txt('测试集里的这个样本：太原 2019-12-17 ~ 12-28', 90, 144, 14, COL.gold, 'left', 600);
    var bx = 130, by = 200, bw = 720, bh = 320;
    var all = tg.cityTrue.concat(tg.p90, tg.p10, tg.cityPred);
    var ymin = Math.min.apply(null, all) * 0.85, ymax = Math.max.apply(null, all) * 1.1;
    ctx.strokeStyle = 'rgba(148,163,184,0.18)'; ctx.strokeRect(bx, by, bw, bh);
    var stepX = bw / (n - 1);
    function yOf(v) { return by + bh - (v - ymin) / (ymax - ymin) * bh; }
    var q = clamp((tl - 1) / 8, 0, 1);
    ctx.fillStyle = 'rgba(244,185,66,0.18)';
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = bx + i * stepX;
      if (i === 0) ctx.moveTo(x, yOf(lerp(tg.cityPred[i], tg.p90[i], q))); else ctx.lineTo(x, yOf(lerp(tg.cityPred[i], tg.p90[i], q)));
    }
    for (var j = n - 1; j >= 0; j--) ctx.lineTo(bx + j * stepX, yOf(lerp(tg.cityPred[j], tg.p10[j], q)));
    ctx.closePath(); ctx.fill();
    function line(vals, color, w) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      for (var k = 0; k < n; k++) { var xx = bx + k * stepX, yy = yOf(vals[k]); if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    }
    line(tg.cityTrue, '#e8f0fa', 2.6);
    line(tg.cityPred, COL.gold, 2.6);
    txt('真实', bx + 6, by + 14, 11.5, '#e8f0fa', 'left', 600);
    txt('集成预测', bx + 56, by + 14, 11.5, COL.gold, 'left', 600);
    txt('15 种子 P10–P90', bx + 136, by + 14, 11.5, 'rgba(244,185,66,0.85)', 'left');
    panel(960, 110, 420, 480, '');
    var cards = [['总体 RMSE', '2.1611'], ['校准后 α=0.25', '2.0125'], ['持续性基线', '2.1225'], ['总体 PCC', '0.8143']];
    cards.forEach(function (c, i) {
      var y = 150 + i * 104;
      txt(c[0], 984, y, 11.5, COL.muted, 'left');
      txt(c[1], 984, y + 30, 24, i === 1 ? COL.gold : '#e8f0fa', 'left', 700);
    });
    txt('这个样本峰值被低估（预测≈6，真值→12），', 90, 620, 12, COL.muted, 'left');
    txt('但校准后整体误差仍低于"照抄昨天"。', 90, 644, 12, COL.muted, 'left');
    setMath([
      { tex: '\\hat y^{\\mathrm{cal}}_t=y_{\\mathrm{last}}+\\alpha\\big(\\hat y_t-y_{\\mathrm{last}}\\big),\\quad\\alpha=0.25', x: 720, y: 620, cls: '' }
    ]);
  }

  /* ---------- 章节 ---------- */
  var CH_META = [
    { start: 0, end: 15, name: '0 · 一个样本 / 一个 batch', draw: drawIntro, steps: [
      { at: 0, ttl: '先看单位：一个样本', txt: '一个样本 = 连续 20 天 × 11 个城市 × 16 个通道；训练时一次拿 32 个样本组成一个 batch。', tex: '\\mathbf{x}\\in\\mathbb{R}^{20\\times11\\times16},\\quad \\mathbf{X}\\in\\mathbb{R}^{32\\times20\\times11\\times16}' },
      { at: 8, ttl: '讲解样本', txt: '我们锁定 batch 里的第 1 个样本：太原，输入 2019-11-27 ~ 12-16，标签是之后 12 天。', tex: '\\mathbf{y}\\in\\mathbb{R}^{32\\times11\\times12}' }
    ] },
    { start: 15, end: 65, name: '1 · 平滑：公式与计算', draw: drawSmooth, steps: [
      { at: 0, ttl: '原始计数', txt: '太原这 20 天的每日报告数：有尖刺、有 0 值。直接拿它当输入，噪声会主导学习。', tex: 'y_t\\;\\text{（t = 2019-11-27 … 12-16）}' },
      { at: 8, ttl: '7 日平移平均', txt: '用过去 7 天（含当天）的算术平均做平滑；它只看历史，不会泄漏未来。', tex: '\\bar y_t=\\frac{1}{7}\\sum_{k=0}^{6}y_{t-k}' },
      { at: 22, ttl: '代入数字', txt: '把最后一天 12-16 及其前 6 天的真实报告数代入公式，求和再除以 7，得到这一天的平滑值。',
        tex: function () { var ex = EX.example; var parts = ex.raw7.map(function (v) { return fmt(v, 1); });
          return '\\bar y_{2019\\text{-}12\\text{-}16}=\\frac{' + parts.join('+') + '}{7}=' + fmt(ex.mean7, 2); } },
      { at: 36, ttl: '得到平滑序列', txt: '对每天重复这一操作，就得到右图的平滑序列；窗口不足 7 天的前 6 天记为 NaN。', tex: '\\{\\bar y_t\\}_{t=7}^{T}' }
    ] },
    { start: 65, end: 110, name: '2 · 气象：去季节与标准化', draw: drawWeather, steps: [
      { at: 0, ttl: '气象先去掉季节', txt: '温度、湿度有明显的年周期；直接用原始值，模型会把"冬天"误当成"气象异常"。', tex: 'a_t=x_t-c(d_t),\\quad c(d)=\\text{2015–18 同日序均值}' },
      { at: 10, ttl: '再按训练段标准化', txt: 'μ、σ 只从训练段估计；标准化后不同城市/量纲才可比。', tex: 'z_t=\\frac{x_t-\\mu}{\\sigma}' },
      { at: 22, ttl: '这一天的一行', txt: '病例 z、温度距平、湿度距平、降水 z，再加 12 个日历谐波，拼成 16 维行向量。', tex: '\\mathbf{x}_t\\in\\mathbb{R}^{16}' }
    ] },
    { start: 110, end: 160, name: '3 · 输入矩阵画出来', draw: drawMatrixScene, steps: [
      { at: 0, ttl: '20 天 × 16 通道的矩阵', txt: '这就是进入编码器的矩阵：每一行是一天，每一列是一个通道；格子里的数字是真实值（保留两位小数）。', tex: '\\mathbf{X}^{(\\text{太原})}\\in\\mathbb{R}^{20\\times16}' },
      { at: 12, ttl: '11 个城市各有一张', txt: '每个城市都有自己的 20×16 矩阵；把 11 个城市并排，就是 20×11×16 的样本张量。', tex: '\\mathbf{X}\\in\\mathbb{R}^{20\\times11\\times16}' },
      { at: 24, ttl: '再叠成 batch', txt: '32 个样本叠起来才是训练时真正喂给网络的一个 batch。', tex: '\\mathbf{X}\\in\\mathbb{R}^{32\\times20\\times11\\times16}' }
    ] },
    { start: 160, end: 240, name: '4 · 矩阵进入编码器', draw: drawEncoder, steps: [
      { at: 0, ttl: '因果卷积（矩阵形式）', txt: '用移位矩阵把过去的值移到当前位置，再乘可学习的权重；右侧未来被遮住。', tex: '\\mathbf{H}^{(d)}=\\sigma\\big(\\sum_{m=0}^{K-1}\\mathbf{S}_{d\\,m}\\mathbf{X}\\mathbf{W}_m\\big)' },
      { at: 34, ttl: '城际图', txt: '11 个城市、19 条接壤边；每个城市聚合邻居表示。C 行随机、准静态，是结构先验而非实时流量。', tex: "\\mathbf{h}'_i=\\sum_{j\\in\\mathcal{N}(i)}C_{ij}\\mathbf{h}_j" },
      { at: 58, ttl: '时间投影与双头', txt: '20 个时间步压到 12 个预测步；直接头输出病例，机理头只在训练时作为辅助正则。', tex: '\\hat{\\mathbf{y}}=\\mathbf{W}_{\\mathrm{out}}\\,\\mathrm{vec}(\\mathbf{H}_{12})' }
    ] },
    { start: 240, end: 272, name: '5 · 训练', draw: drawTraining, steps: [
      { at: 0, ttl: '最小化误差', txt: '在 1,213 个训练窗口上最小化预测误差；验证集用于早停，测试段从不参与训练。', tex: '\\mathcal{L}=\\frac{1}{32\\cdot11\\cdot12}\\sum(\\hat y-y)^2+\\lambda_{\\mathrm{aux}}\\mathcal{L}_{\\mathrm{mech}}' },
      { at: 12, ttl: '损失下降与集成', txt: '验证损失在前几十个 epoch 快速下降；15 个随机种子取平均降低方差。', tex: '\\hat{\\mathbf{y}}^{\\mathrm{ens}}=\\frac{1}{15}\\sum_{s=1}^{15}\\hat{\\mathbf{y}}_s' }
    ] },
    { start: 272, end: 300, name: '6 · 预测与校准', draw: drawEval, steps: [
      { at: 0, ttl: '这个样本的 12 步预测', txt: '集成预测约 6 例/日，真实升到 12 例/日——节假日陡升被低估，这是模型的真实边界。', tex: '\\hat{\\mathbf{y}}=[\\hat y_{t+1},\\ldots,\\hat y_{t+12}]' },
      { at: 12, ttl: '校准与整体指标', txt: '测试段整体 RMSE 2.1611；α=0.25 收缩校准后 2.0125，低于持续性基线 2.1225。', tex: '\\hat y^{\\mathrm{cal}}=y_{\\mathrm{last}}+\\alpha(\\hat y-y_{\\mathrm{last}})' }
    ] }
  ];

  /* ---------- 播放器 ---------- */
  function buildChapters() {
    var box = document.getElementById('chapters');
    CH.forEach(function (c, i) {
      var d = document.createElement('div'); d.className = 'ch'; d.setAttribute('data-i', i);
      d.innerHTML = '<b>' + c.name + '</b><span>' + fmt(c.start, 0) + '–' + fmt(c.end, 0) + ' s</span>';
      d.addEventListener('click', function () { seek(c.start + 0.01); });
      box.appendChild(d);
    });
  }
  function chapterAt(t) { for (var i = CH.length - 1; i >= 0; i--) if (t >= CH[i].start) return i; return 0; }
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
    var ftex = (typeof step.tex === 'function') ? step.tex() : (step.tex || '');
    cap.querySelector('.fml').innerHTML = ftex ? tex(ftex) : '';
    var chs = document.querySelectorAll('#chapters .ch');
    for (var j = 0; j < chs.length; j++) chs[j].classList.toggle('on', j === i);
  }
  function render() {
    var i = chapterAt(T), c = CH[i];
    ctx.clearRect(0, 0, W, H);
    c.draw(T - c.start);
    ctx.fillStyle = 'rgba(5,10,18,0.72)'; roundRect(18, 16, 344, 38, 9); ctx.fill();
    txt(c.name, 34, 36, 14, COL.gold, 'left', 600);
    ctx.fillStyle = 'rgba(5,10,18,0.72)'; ctx.fillRect(0, H - 42, W, 42);
    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = COL.gold; ctx.fillRect(0, H - 3, W * (T / DUR), 3);
    txt('真实数据样本 · 5:00 · 一个样本的旅程', 18, H - 22, 10.5, COL.muted, 'left');
    txt('WMEG-Net · 15,385 参数', W - 18, H - 22, 10.5, COL.muted, 'right');
    updateCaption(T);
    document.getElementById('time').textContent = fmtTime(T) + ' / ' + fmtTime(DUR);
    document.getElementById('range').value = T;
  }
  function fmtTime(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function tick(ts) {
    if (!EX) { requestAnimationFrame(tick); return; }
    if (playing) {
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      T += dt * speed;
      if (T >= DUR) { T = DUR; playing = false; syncPlayBtn(); }
    }
    lastTs = ts; render(); requestAnimationFrame(tick);
  }
  function syncPlayBtn() { document.getElementById('play').textContent = playing ? '❚❚ 暂停' : '▶ 播放'; }
  function seek(t) { T = clamp(t, 0, DUR); lastCaptionKey = ''; render(); }
  function bind() {
    document.getElementById('play').addEventListener('click', function () { if (T >= DUR - 0.05) T = 0; playing = !playing; syncPlayBtn(); });
    document.getElementById('range').addEventListener('input', function () { playing = false; syncPlayBtn(); seek(parseFloat(this.value)); });
    document.getElementById('speed').addEventListener('change', function () { speed = parseFloat(this.value); });
    document.getElementById('prev').addEventListener('click', function () { var i = chapterAt(T); seek(i > 0 ? CH[i - 1].start + 0.01 : 0); });
    document.getElementById('next').addEventListener('click', function () { var i = chapterAt(T); seek(i < CH.length - 1 ? CH[i + 1].start + 0.01 : DUR); });
    document.getElementById('full').addEventListener('click', function () {
      if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (T >= DUR) T = 0; syncPlayBtn(); }
      else if (e.code === 'ArrowRight') seek(T + 5);
      else if (e.code === 'ArrowLeft') seek(T - 5);
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
      if (RECORD) document.body.classList.add('record');
      buildChapters(); bind();
      var qt = parseFloat(new URLSearchParams(location.search).get('t') || '0');
      seek(isNaN(qt) ? 0 : qt);
      window.__explain = {
        ready: true, duration: DUR, record: RECORD,
        seek: function (t) { playing = false; T = clamp(t, 0, DUR); lastCaptionKey = ''; render(); },
        captions: function () {
          var out = [];
          CH.forEach(function (c) { c.steps.forEach(function (s) {
            var st = (typeof s.tex === 'function') ? s.tex() : (s.tex || '');
            out.push({ t: c.start + s.at, ttl: s.ttl, txt: s.txt, tex: st });
          }); });
          return out;
        }
      };
      if (!RECORD) requestAnimationFrame(tick);
    }).catch(function (e) {
      document.getElementById('caption').querySelector('.txt').textContent = '数据加载失败：' + e + '（请通过本地服务器打开）';
    });
  }
  function init() {
    cv = document.getElementById('cv');
    mathLayer = document.getElementById('mathLayer');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.aspectRatio = W + ' / ' + H;
    ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
