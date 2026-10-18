'use strict';
/* 一个数字的旅程 · 4:30 动画（KaTeX 公式 + 真实权重/激活） */
(function () {
  var W = 1440, H = 740;
  var cv, ctx, dpr = 1, mathLayer;
  var EX = null, JR = null, APP = null, GEO = null, CITYMETA = null;
  var T = 0, DUR = 270, playing = false, speed = 1, lastTs = 0, lastCaptionKey = '';
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
  function mathText(s, x, y, size, color, align) {
    ctx.font = '600 ' + size + 'px "Cambria Math","Times New Roman",serif';
    ctx.fillStyle = color || COL.txt; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function bg() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#081321'); g.addColorStop(1, '#050a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,220,0.035)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function rollNumbers(tl, n, alpha) {
    ctx.save();
    ctx.font = '11px Consolas,monospace'; ctx.fillStyle = 'rgba(148,197,255,' + alpha + ')';
    for (var i = 0; i < n; i++) {
      var x = (i * 197 + 53) % W;
      var y = ((i * 83 + tl * 18 * (0.6 + (i % 5) * 0.1)) % (H + 40)) - 20;
      ctx.fillText((Math.sin(i * 7.3 + tl * 0.4) * 2).toFixed(2), x, y);
    }
    ctx.restore();
  }
  function panel(x, y, w, h, title) {
    ctx.fillStyle = 'rgba(10,20,33,0.86)'; ctx.strokeStyle = 'rgba(56,189,248,0.16)'; ctx.lineWidth = 1;
    roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    if (title) txt(title, x + 14, y + 20, 13, COL.muted, 'left', 600);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function heat(v, lo, hi) {
    var t = clamp((v - lo) / (hi - lo), 0, 1);
    return 'rgba(' + Math.round(24 + 220 * t) + ',' + Math.round(95 + 100 * t) + ',' + Math.round(170 - 110 * t) + ',' + (0.16 + 0.65 * t) + ')';
  }
  function matrix(x, y, cw, ch, values, opts) {
    opts = opts || {};
    var r = values.length, c = values[0].length;
    var reveal = opts.reveal === undefined ? 1 : opts.reveal;
    var lo = opts.lo !== undefined ? opts.lo : Math.min.apply(null, values.map(function (row) { return Math.min.apply(null, row); }));
    var hi = opts.hi !== undefined ? opts.hi : Math.max.apply(null, values.map(function (row) { return Math.max.apply(null, row); }));
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        var a = clamp(reveal * (r + c) - (i + j), 0, 1); if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = opts.color ? opts.color(values[i][j]) : heat(values[i][j], lo, hi);
        ctx.fillRect(x + j * cw, y + i * ch, cw - 1.2, ch - 1.2);
        if (opts.numbers) {
          ctx.fillStyle = 'rgba(235,243,252,0.92)';
          ctx.font = (opts.font || 9) + 'px Consolas,"Segoe UI",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(fmt(values[i][j], opts.digits === undefined ? 2 : opts.digits), x + j * cw + cw / 2 - 0.6, y + i * ch + ch / 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (opts.rowLabels) {
      ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var i2 = 0; i2 < r; i2++) ctx.fillText(opts.rowLabels[i2], x - 6, y + i2 * ch + ch / 2);
    }
    if (opts.highlightRow !== undefined) {
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y + opts.highlightRow * ch - 2, c * cw + 3, ch + 3);
    }
  }

  /* ---------- 0：公式 → 数字 ---------- */
  function draw0(tl) {
    bg(); rollNumbers(tl, 46, 0.05 + 0.03 * Math.sin(tl));
    var ex = EX.example;
    var cx = W / 2, y = 250;
    ctx.globalAlpha = ease(tl / 2);
    mathText('z = ( x − μ ) / σ', cx, y, 46, '#eaf3ff');
    ctx.globalAlpha = 1;
    var items = [
      { t: 'x = ' + fmt(ex.case.smooth, 2), x: cx - 330, y: y + 80, at: 3 },
      { t: 'μ = ' + fmt(ex.case.mu, 2), x: cx - 80, y: y + 80, at: 5 },
      { t: 'σ = ' + fmt(ex.case.sigma, 2), x: cx + 170, y: y + 80, at: 7 }
    ];
    items.forEach(function (it) {
      var a = ease((tl - it.at) / 1.2);
      ctx.globalAlpha = a;
      mathText(it.t, it.x, it.y, 24, COL.cyan);
      ctx.globalAlpha = 1;
    });
    var p = ease((tl - 10) / 2);
    if (p > 0) {
      ctx.globalAlpha = p;
      mathText('= ' + fmt(ex.case.z, 2), cx + 380, y + 80, 28, COL.gold);
      ctx.globalAlpha = 1;
    }
    if (tl > 14) {
      var q = ease((tl - 14) / 3);
      var tx = lerp(cx, 1080, q), ty = lerp(330, 600, q), sc = lerp(2.2, 0.9, q);
      ctx.globalAlpha = 1 - 0.15 * q;
      mathText(fmt(ex.case.z, 2), tx, ty, 30 * sc, COL.gold);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(244,185,66,0.5)'; ctx.lineWidth = 1.4;
      ctx.strokeRect(tx - 26, ty - 20, 52, 40);
      txt('这个数，会进入矩阵的一个格子', 1080 + 40, 600, 11.5, COL.muted, 'left');
    }
    txt('一切从一个数开始', 90, 120, 15, COL.gold, 'left', 600);
  }

  /* ---------- 1：平滑滚动 + 标准化 ---------- */
  function draw1(tl) {
    bg(); rollNumbers(tl, 30, 0.04);
    var w = EX.window.matrix, raw = w.raw, dates = w.dates, sm = w.smooth;
    panel(60, 110, 700, 380, '');
    txt('太原 · 20 天逐日报告数：7 个一滚动求和', 90, 142, 13.5, COL.gold, 'left', 600);
    var bx = 110, by = 430, bw = 600, bh = 220;
    var mx = Math.max.apply(null, raw);
    var stepX = bw / (raw.length - 1);
    var wi = clamp(Math.floor(ease((tl - 1) / 8) * (raw.length - 7)), 0, raw.length - 7);
    var shown = ease((tl - 1) / 5);
    for (var i = 0; i < raw.length; i++) {
      var h = (raw[i] || 0) / mx * bh;
      ctx.globalAlpha = shown;
      var inWin = i >= wi && i < wi + 7;
      ctx.fillStyle = inWin ? 'rgba(244,185,66,0.85)' : 'rgba(148,163,184,0.45)';
      ctx.fillRect(bx + i * stepX - stepX * 0.28, by - h, stepX * 0.56, h);
      if (inWin) txt(fmt(raw[i], 0), bx + i * stepX, by - h - 9, 10.5, COL.gold, 'center', 600);
      ctx.globalAlpha = 1;
    }
    txt('滑动窗口 7 天', bx + wi * stepX - 10, by + 16, 10.5, COL.gold, 'left');
    var sum = 0; for (var k = wi; k < wi + 7; k++) sum += (raw[k] || 0);
    var mean = sum / 7;
    panel(60, 510, 700, 200, '');
    txt('滚动计算', 90, 540, 13, COL.muted, 'left', 600);
    mathText('ȳ = (' + fmt(raw[wi],1) + '+' + fmt(raw[wi+1],1) + '+…+' + fmt(raw[wi+6],1) + ') / 7 = ' + fmt(sum,1) + ' / 7 = ' + fmt(mean,2), 90, 580, 17, '#eaf3ff', 'left');
    txt('窗口每移动一天，重算一次 → 得到整条平滑序列', 90, 620, 11.5, COL.muted, 'left');
    // 右侧：标准化与钟形曲线
    panel(790, 110, 590, 600, '');
    txt('再标准化：把 6.29 变成 2.04', 820, 142, 13.5, COL.gold, 'left', 600);
    var ex = EX.example;
    mathText('z = (6.29 − 1.20) / 2.49 = 2.04', 820, 190, 20, '#eaf3ff', 'left');
    var gx = 830, gy = 500, gw = 500, gh = 260;
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    var mu = 0.5, sig = 0.19;
    ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2; ctx.beginPath();
    for (var px = 0; px <= gw; px += 4) {
      var z = (px / gw - mu) / sig;
      var yv = Math.exp(-0.5 * z * z);
      var yy = gy - yv * gh * 0.85;
      if (px === 0) ctx.moveTo(gx + px, yy); else ctx.lineTo(gx + px, yy);
    }
    ctx.stroke();
    var zx = gx + (mu + ex.case.z * sig) * gw;
    var zy = gy - Math.exp(-0.5 * ex.case.z * ex.case.z) * gh * 0.85;
    var ap = ease((tl - 20) / 4);
    if (ap > 0) {
      ctx.beginPath(); ctx.arc(zx, zy, 7, 0, Math.PI * 2); ctx.fillStyle = COL.gold; ctx.fill();
      txt('2.04（' + f2(ex.case.z) + 'σ）', zx + 12, zy - 14, 12, COL.gold, 'left', 600);
    }
    txt('z 值 = 偏离训练段均值多少个标准差', 830, 690, 11, COL.muted, 'left');
  }

  /* ---------- 2：矩阵滚动 ---------- */
  function draw2(tl) {
    bg(); rollNumbers(tl, 34, 0.04);
    var phase = tl < 20 ? 0 : (tl < 36 ? 1 : 2);
    if (phase === 0) {
      txt('第一步：16 × 20 输入矩阵逐格滚入（每一格是真实值）', 90, 86, 15, COL.gold, 'left', 600);
      var X = EX.window.matrix.X;
      var rows = []; for (var i = 0; i < X.length; i++) rows.push(X[i]);
      var reveal = ease((tl - 1) / 10);
      matrix(130, 130, 58, 23, rows, { reveal: reveal, numbers: true, digits: 2, font: 8.5, lo: -1.2, hi: 2.6 });
      // 行标签
      ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'right';
      for (var r = 0; r < 20; r++) ctx.fillText(EX.window.matrix.dates[r].slice(5), 122, 130 + r * 23 + 11);
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.4;
      ctx.strokeRect(128, 130 + 19 * 23 - 2, 16 * 58 + 3, 23 + 3);
      txt('2019-12-16 这一行 → 输入向量', 130 + 16 * 58 + 16, 130 + 19 * 23 + 11, 10.5, COL.gold, 'left');
      txt('行 = 日期；列 = 16 个通道（病例 z、温度/湿度距平、降水 z、12 个日历谐波）', 90, 650, 11.5, COL.muted, 'left');
    } else if (phase === 1) {
      txt('第二步：32 个样本 × 16 维（取每个窗口最后一天）', 90, 86, 15, COL.gold, 'left', 600);
      var B = JR.batchMatrix;
      var revealB = ease((tl - 20) / 6);
      matrix(150, 130, 58, 17, B, { reveal: revealB, numbers: true, digits: 2, font: 8, lo: -1.2, hi: 2.6 });
      ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'right';
      for (var b = 0; b < 32; b++) ctx.fillText('#' + (b + 1), 142, 130 + b * 17 + 8);
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.4;
      ctx.strokeRect(148, 130 - 2, 16 * 58 + 3, 17 + 3);
      txt('第 1 个样本就是我们的太原窗口；第一格 = 2.04', 150 + 16 * 58 + 16, 148, 11, COL.gold, 'left');
      txt('一个 batch 共 32 个样本，叠起来才是训练时真正喂给网络的数据。', 90, 692, 11.5, COL.muted, 'left');
    } else {
      txt('权重矩阵 W：32 个特征 × 16 个输入通道（这是要学习的参数）', 90, 86, 15, COL.gold, 'left', 600);
      var WT = JR.WTrained;
      var revealW = ease((tl - 36) / 6);
      matrix(150, 130, 44, 14, WT, { reveal: revealW, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
      ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'right';
      for (var f = 0; f < 32; f += 2) ctx.fillText('#' + (f + 1), 142, 130 + f * 14 + 7);
      txt('高亮 = 第 11 个特征（动画主角）', 150 + 16 * 44 + 18, 150, 11, COL.gold, 'left');
      // 第 10 行数值条
      panel(880, 130, 500, 460, '');
      txt('第 11 行的 16 个权重（学到的值）', 900, 162, 13, COL.gold, 'left', 600);
      var rowW = WT[10];
      rowW.forEach(function (v, j) {
        var x = 900 + (j % 8) * 58, y = 200 + Math.floor(j / 8) * 90;
        ctx.fillStyle = heat(v, -0.8, 0.8);
        ctx.fillRect(x, y, 52, 44);
        ctx.fillStyle = '#0b1624'; ctx.font = '11px Consolas,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fmt(v, 2), x + 26, y + 22);
        ctx.fillStyle = COL.muted; ctx.font = '9px "Microsoft YaHei",sans-serif';
        ctx.fillText('c' + (j + 1), x + 26, y + 58);
      });
      txt('w₁₁,₁ … w₁₁,₁₆', 900, 400, 12, COL.muted, 'left');
      txt('每个数都是训练出来的；下一章看它怎么和输入相乘。', 900, 440, 11, COL.muted, 'left');
    }
  }

  /* ---------- 3：一个数字穿过编码器 ---------- */
  function draw3(tl) {
    bg(); rollNumbers(tl, 28, 0.035);
    var x = JR.x, ft = JR.featureTrace, e = JR.meta.feature;
    var w = ft.wTrained, b = JR.biasTrained[e];
    var phase = tl < 22 ? 0 : (tl < 34 ? 1 : 2);
    if (phase === 0) {
      txt('这个数字 2.04 与 32×16 权重矩阵的第 11 行相乘', 90, 80, 15, COL.gold, 'left', 600);
      // 左侧：16 对乘积累加
      var sum = 0;
      var prog = clamp((tl - 1) / 18, 0, 1);
      var done = Math.floor(prog * 16);
      for (var i = 0; i < 16; i++) {
        var row = Math.floor(i / 8), col = i % 8;
        var xx = 110 + col * 118, yy = 170 + row * 120;
        if (i <= done) {
          sum += x[i] * w[i];
          ctx.fillStyle = 'rgba(56,189,248,0.12)';
          roundRect(xx, yy, 108, 84, 8); ctx.fill();
          txt('x' + (i + 1) + ' = ' + fmt(x[i], 2), xx + 10, yy + 18, 10, COL.muted, 'left');
          txt('w = ' + fmt(w[i], 2), xx + 10, yy + 38, 10, COL.cyan, 'left');
          txt('= ' + fmt(x[i] * w[i], 2), xx + 10, yy + 62, 12, COL.gold, 'left', 600);
        }
      }
      panel(1060, 150, 320, 380, '');
      txt('累加 → 加偏置', 1080, 182, 13, COL.gold, 'left', 600);
      mathText('Σ = ' + fmt(sum, 2), 1080, 230, 20, '#eaf3ff', 'left');
      mathText('+ b = ' + fmt(b, 2), 1080, 278, 16, COL.muted, 'left');
      mathText('pre = ' + fmt(ft.preTrained, 3), 1080, 340, 22, COL.cyan, 'left');
      txt('这是第 11 个特征在训练后的净输入', 1080, 390, 11, COL.muted, 'left');
      matrix(110, 440, 12, 6, JR.WTrained, { numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
      txt('W：32 个特征 × 16 个通道，高亮第 11 行', 110, 668, 10.5, COL.muted, 'left');
      txt('每一对 x·w 都是真实数值（x 来自输入向量，w 来自训练好的权重）', 330, 620, 11, COL.muted, 'left');
    } else if (phase === 1) {
      txt('激活函数 GELU 把它再变一次', 90, 80, 15, COL.gold, 'left', 600);
      var gx = 200, gy = 480, gw = 900, gh = 300;
      ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx + gw / 2, gy - gh); ctx.lineTo(gx + gw / 2, gy + 30); ctx.stroke();
      ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2.4; ctx.beginPath();
      function gelu(z) { return 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z))); }
      for (var p = -4; p <= 4; p += 0.02) {
        var X = gx + (p + 4) / 8 * gw;
        var Y = gy - gelu(p) * 70;
        if (p === -4) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      var p0 = ft.preTrained;
      var X0 = gx + (p0 + 4) / 8 * gw, Y0 = gy - gelu(p0) * 70;
      var ap = ease((tl - 22) / 3);
      if (ap > 0) {
        ctx.beginPath(); ctx.arc(X0, Y0, 7, 0, Math.PI * 2); ctx.fillStyle = COL.gold; ctx.fill();
        txt('pre = ' + fmt(p0, 3), X0 + 14, Y0 - 12, 12, COL.gold, 'left', 600);
        txt('GELU(pre) = ' + fmt(ft.postTrained, 3), X0 + 14, Y0 + 12, 12, COL.green, 'left', 600);
      }
      mathText('GELU(z) = 0.5z(1 + tanh(√(2/π)(z + 0.044715 z³)))', 300, 120, 16, '#bfe3ff', 'left');
    } else {
      txt('同一个特征继续往后走：编码器 → 图 → 投影 → 输出', 90, 80, 15, COL.gold, 'left', 600);
      var st = JR.chain.stages;
      var names = ['投影+GELU', '编码器输出', '时间投影', '预测输出'];
      var vals = [ft.postTrained, st[1].trained, st[2].trained, st[3].trained];
      for (var k = 0; k < 4; k++) {
        var x0 = 120 + k * 320, y0 = 230;
        ctx.fillStyle = 'rgba(56,189,248,0.14)'; ctx.strokeStyle = 'rgba(56,189,248,0.45)';
        roundRect(x0, y0, 270, 120, 12); ctx.fill(); ctx.stroke();
        txt(names[k], x0 + 14, y0 + 22, 12, COL.muted, 'left', 600);
        mathText(fmt(vals[k], 3), x0 + 14, y0 + 70, 26, k === 3 ? COL.gold : '#eaf3ff', 'left');
        if (k < 3) {
          ctx.strokeStyle = 'rgba(148,197,255,0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x0 + 270, y0 + 60); ctx.lineTo(x0 + 300, y0 + 60); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x0 + 300, y0 + 60); ctx.lineTo(x0 + 292, y0 + 54); ctx.moveTo(x0 + 300, y0 + 60); ctx.lineTo(x0 + 292, y0 + 66); ctx.stroke();
        }
      }
      txt('同一组输入下，这个特征值从 -0.120 一路被变换成预测 6.57（第 1 步）', 120, 420, 13, COL.muted, 'left');
      txt('注意：中间每一步都来自真实模型的前向计算，不是示意图。', 120, 452, 12, COL.muted, 'left');
      txt('输出端：太原 12 步预测从这里展开', 120, 510, 13, COL.cyan, 'left', 600);
    }
  }

  /* ---------- 4：学习：权重从初始化到训练后 ---------- */
  function draw4(tl) {
    bg(); rollNumbers(tl, 24, 0.03);
    txt('学习过程：同一个 32×16 权重矩阵，初始化 vs 训练后', 90, 80, 15, COL.gold, 'left', 600);
    var WI = JR.WInit, WT = JR.WTrained;
    var x0 = 110, y0 = 140, cw = 15, ch = 9;
    // 初始化
    matrix(x0, y0, cw, ch, WI, { reveal: 1, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
    txt('初始化 W（随机）', x0, y0 + 32 * ch + 22, 11, COL.muted, 'left', 600);
    // 训练后
    var x1 = x0 + 16 * cw + 120;
    matrix(x1, y0, cw, ch, WT, { reveal: 1, numbers: false, lo: -0.8, hi: 0.8, highlightRow: 10 });
    txt('训练后 W（学习到的）', x1, y0 + 32 * ch + 22, 11, COL.muted, 'left', 600);
    // 第 11 行权重对比条
    var bx = 900, by = 130;
    panel(bx - 20, by - 20, 520, 360, '');
    txt('第 11 行的 16 个权重：初始化 → 训练后', bx, by + 10, 12.5, COL.gold, 'left', 600);
    var p = ease((tl - 2) / 14);
    for (var j = 0; j < 16; j++) {
      var yy = by + 40 + j * 18;
      var v0 = WI[10][j], v1 = WT[10][j];
      var vv = lerp(v0, v1, p);
      txt('w' + (j + 1), bx, yy, 9.5, COL.muted, 'left');
      ctx.fillStyle = 'rgba(148,163,184,0.15)'; ctx.fillRect(bx + 34, yy - 6, 200, 12);
      ctx.fillStyle = 'rgba(56,189,248,0.55)'; ctx.fillRect(bx + 34, yy - 6, 200 * clamp((vv + 0.8) / 1.6, 0, 1), 12);
      txt(fmt(v0, 2) + ' → ' + fmt(v1, 2), bx + 250, yy, 9.5, j === 0 ? COL.gold : COL.muted, 'left');
    }
    // 激活/输出变化
    var st = JR.chain.stages;
    panel(90, 500, 540, 210, '');
    txt('同一个输入：初始化 → 训练后', 110, 528, 12.5, COL.gold, 'left', 600);
    var rows = [
      ['pre（净输入）', JR.featureTrace.preInit, JR.featureTrace.preTrained],
      ['GELU 激活', JR.featureTrace.postInit, JR.featureTrace.postTrained],
      ['编码器输出', st[1].init, st[1].trained],
      ['时间投影', st[2].init, st[2].trained],
      ['输出（第 1 步）', JR.output.init[0], JR.output.trained[0]]
    ];
    rows.forEach(function (r, k) {
      var yy = 558 + k * 28;
      txt(r[0], 110, yy, 11, COL.muted, 'left');
      txt(fmt(r[1], 3), 350, yy, 11.5, '#94a3b8', 'right');
      txt('→', 378, yy, 11, COL.muted, 'center');
      txt(fmt(r[2], 3), 450, yy, 12, COL.gold, 'right', 600);
    });
    // 输出曲线
    var O = JR.output, n = O.dates.length;
    panel(650, 500, 710, 210, '');
    txt('12 步输出：初始化 vs 训练后 vs 真值', 670, 528, 12.5, COL.gold, 'left', 600);
    var ox = 690, oy = 560, ow = 520, oh = 110;
    var allv = O.true.concat(O.init, O.trained);
    var mn = Math.min.apply(null, allv), mx = Math.max.apply(null, allv);
    function oyOf(v) { return oy + oh - (v - mn) / (mx - mn + 1e-6) * oh; }
    function line(vals, color, w) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      for (var i = 0; i < n; i++) { var x = ox + i / (n - 1) * ow; var y = oyOf(vals[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    line(O.true, '#e8f0fa', 2.4); line(O.init, 'rgba(148,163,184,0.8)', 1.4); line(O.trained, COL.gold, 2.4);
    txt('真值', ox, oy + oh + 16, 10, '#e8f0fa', 'left');
    txt('初始化', ox + 44, oy + oh + 16, 10, '#94a3b8', 'left');
    txt('训练后', ox + 108, oy + oh + 16, 10, COL.gold, 'left');
  }

  /* ---------- 5：15 个种子与损失曲线 ---------- */
  function draw5(tl) {
    bg(); rollNumbers(tl, 20, 0.025);
    panel(60, 100, 1320, 560, '');
    txt('15 个随机种子：训练/验证损失与最终集成', 90, 134, 15, COL.gold, 'left', 600);
    var curves = JR.loss.curves, keys = Object.keys(curves);
    var maxEp = 0, logMin = Infinity, logMax = -Infinity;
    keys.forEach(function (s) { curves[s].forEach(function (p) { maxEp = Math.max(maxEp, p[0]); var lv = Math.log10(Math.max(p[2], 0.02)); logMin = Math.min(logMin, lv); logMax = Math.max(logMax, lv); }); });
    var bx = 150, by = 200, bw = 840, bh = 340;
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.strokeRect(bx, by, bw, bh);
    // 网格
    ctx.strokeStyle = 'rgba(148,163,184,0.12)'; ctx.lineWidth = 1;
    for (var gt = 1; gt < 5; gt++) { var gy = by + gt / 5 * bh; ctx.beginPath(); ctx.moveTo(bx, gy); ctx.lineTo(bx + bw, gy); ctx.stroke(); }
    for (var gx2 = 1; gx2 < 5; gx2++) { var gx3 = bx + gx2 / 5 * bw; ctx.beginPath(); ctx.moveTo(gx3, by); ctx.lineTo(gx3, by + bh); ctx.stroke(); }
    txt('log₁₀(验证损失)', bx - 10, by - 14, 10.5, COL.muted, 'left');
    txt('epoch', bx + bw / 2, by + bh + 16, 10.5, COL.muted, 'center');
    txt('0', bx, by + bh + 16, 9.5, COL.muted, 'center');
    txt(String(maxEp), bx + bw, by + bh + 16, 9.5, COL.muted, 'center');
    var prog = clamp((tl - 2) / 18, 0, 1);
    keys.forEach(function (s, si) {
      var arr = curves[s];
      ctx.strokeStyle = si === 0 ? COL.gold : 'rgba(56,189,248,' + (0.14 + 0.03 * (si % 4)) + ')';
      ctx.lineWidth = si === 0 ? 2.2 : 1;
      ctx.beginPath();
      var upto = Math.floor(prog * (arr.length - 1));
      for (var i = 0; i <= upto; i++) {
        var x = bx + arr[i][0] / maxEp * bw;
        var lv = Math.log10(Math.max(arr[i][2], 0.02));
        var y = by + bh - (lv - logMin) / (logMax - logMin + 1e-6) * bh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    var cards = [['总体 RMSE', '2.1611'], ['校准后', '2.0125'], ['持续性', '2.1225'], ['PCC', '0.8143']];
    cards.forEach(function (c, i) {
      var x = 1030, y = 210 + i * 100;
      txt(c[0], x, y, 11, COL.muted, 'left');
      txt(c[1], x, y + 30, 24, i === 1 ? COL.gold : '#e8f0fa', 'left', 700);
    });
    txt('15 个种子 → 平均集成，降低单次初始化/采样的波动（这是集成，不是置信区间）。', 150, 640, 11.5, COL.muted, 'left');
  }

  /* ---------- 6：总结 ---------- */
  function draw6(tl) {
    bg(); rollNumbers(tl, 16, 0.02);
    txt('把整条链路串起来', 90, 90, 16, COL.gold, 'left', 600);
    var chain = [
      ['公式', 'z=(x−μ)/σ'], ['一个数', '2.04'], ['矩阵', '16×20 / 32×16'],
      ['权重', 'W（32×16）'], ['激活', 'GELU'], ['编码器', '卷积+图'],
      ['投影', '20→12'], ['输出', '12 步'], ['学习', '损失↓'], ['校准', 'α=0.25']
    ];
    var prog = clamp(tl / 9, 0, 1);
    chain.forEach(function (c, i) {
      var a = clamp(prog * chain.length - i, 0, 1);
      var x = 80 + i * 128, y = 300;
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 2 ? 'rgba(56,189,248,0.18)' : 'rgba(244,185,66,0.16)';
      ctx.strokeStyle = 'rgba(148,197,255,0.4)';
      roundRect(x, y - 40, 116, 90, 10); ctx.fill(); ctx.stroke();
      txt(c[0], x + 58, y - 12, 12, COL.muted, 'center');
      txt(c[1], x + 58, y + 24, 12.5, '#eaf3ff', 'center', 600);
      if (i < chain.length - 1) {
        ctx.beginPath(); ctx.moveTo(x + 116, y); ctx.lineTo(x + 128, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    txt('数据从头到尾：原始计数 → 平滑 → 标准化 → 矩阵 → 编码器 → 学习 → 预测 → 校准', 90, 470, 14, '#eaf3ff', 'left');
    txt('视频里的每个数字都来自真实产物；每一条公式都在页面字幕中排版呈现。', 90, 505, 12, COL.muted, 'left');
    txt('WMEG-Net · 山西 11 市 · 15,385 参数 · 4:30', W / 2, 650, 15, COL.gold, 'center', 600);
  }

  var CH_META = [
    { start: 0, end: 20, name: '0 · 一个公式，一个数', draw: draw0, steps: [
      { at: 0, ttl: '先把公式写出来', txt: '标准化公式把平滑病例变成标准分；公式不是摆设，它下面要代入真实数字。', sub: '标准化公式：z 等于（x 减 μ）除以 σ。', tex: 'z=\\frac{x-\\mu}{\\sigma}' },
      { at: 6, ttl: '代入真实数字', txt: 'x 是 12-16 的平滑病例 6.29，μ=1.20、σ=2.49 来自训练段——算出来是 2.04。', sub: '代入：6.29 减 1.20，再除以 2.49，得到 2.04。', tex: 'z=\\frac{6.29-1.20}{2.49}=2.04' },
      { at: 14, ttl: '这个数进入矩阵', txt: '2.04 会落进矩阵的一个格子，然后进入编码器。', sub: '这个 2.04，会落进矩阵的一个格子。', tex: '2.04\\rightarrow \\mathbf{X}_{20,1}' }
    ] },
    { start: 20, end: 70, name: '1 · 滚动求和：得到平滑数据', draw: draw1, steps: [
      { at: 0, ttl: '7 天滚动窗口', txt: '窗口每移动一天，就重算一次 7 天平均；这个过程会重复 20 次。', sub: '一个 7 天的窗口，每天滚动一次。', tex: '\\bar y_t=\\frac{1}{7}\\sum_{k=0}^{6}y_{t-k}' },
      { at: 20, ttl: '代入并除', txt: '把 12-10 到 12-16 的真实报告数相加得到 44，再除以 7：6.29。', sub: '7 个数相加是 44，再除以 7，等于 6.29。', tex: '\\bar y_{2019-12-16}=\\frac{9+11+4+3+4+7+6}{7}=6.29' },
      { at: 34, ttl: '再把 6.29 标准化', txt: '标准化后得到 2.04；这个数将作为矩阵第一列（病例通道）进入网络。', sub: '再把 6.29 标准化成 2.04，这就是输入向量里的第一个数。', tex: 'z=\\frac{6.29-1.20}{2.49}=2.04' }
    ] },
    { start: 70, end: 115, name: '2 · 矩阵：数据变成矩阵', draw: draw2, steps: [
      { at: 0, ttl: '16×20 输入矩阵', txt: '20 天 × 16 通道逐格滚入；每一格都是真实数值。', sub: '这一天、每一个通道的值，逐格填进 16×20 的输入矩阵。', tex: '\\mathbf{X}\\in\\mathbb{R}^{20\\times16}' },
      { at: 20, ttl: '32×16 batch 矩阵', txt: '32 个样本各取窗口最后一天，得到 32×16 的 batch 视图；第一格就是 2.04。', sub: '32 个样本排成 32 行，每行 16 个特征；第一格还是 2.04。', tex: '\\mathbf{X}_{\\mathrm{batch}}\\in\\mathbb{R}^{32\\times16}' },
      { at: 36, ttl: '32×16 权重矩阵', txt: '这是编码器要学习的参数矩阵：32 个特征 × 16 个输入通道；高亮第 11 行。', sub: '权重矩阵是 32 行 16 列；我们盯着第 11 行。', tex: '\\mathbf{W}\\in\\mathbb{R}^{32\\times16}' }
    ] },
    { start: 115, end: 170, name: '3 · 一个数字穿过编码器', draw: draw3, steps: [
      { at: 0, ttl: '点积：16 次乘加', txt: '输入向量与第 11 行的 16 个权重逐一相乘，再相加，加上偏置，得到净输入 pre。', sub: '16 个输入分别乘 16 个权重，相加，再加偏置。', tex: '\\mathrm{pre}=\\sum_{c=1}^{16}x_c w_{11,c}+b_{11}' },
      { at: 22, ttl: 'GELU 激活', txt: '激活函数把 pre 变成非线性响应：这里是 0.733 变成 -0.120（训练后）。', sub: 'GELU 把净输入 0.33 变成 0.12，方向都变了。', tex: '\\mathrm{GELU}(z)=0.5z\\left(1+\\tanh\\left(\\sqrt{2/\\pi}(z+0.044715z^3)\\right)\\right)' },
      { at: 34, ttl: '继续往后走', txt: '编码器/图/时间投影逐步更新这个特征值：-0.332 → 0.639 → 输出 6.565。', sub: '同一个特征值继续被编码器、图和投影改写，最后变成预测。', tex: '\\hat y=f_\\theta(\\mathbf{X})' }
    ] },
    { start: 170, end: 215, name: '4 · 学习：权重怎么变', draw: draw4, steps: [
      { at: 0, ttl: '初始化 vs 训练后', txt: '左：随机初始化；右：训练后的 32×16 权重矩阵；第 11 行用金色高亮。', sub: '同一个权重矩阵，训练前是随机的，训练后变了。', tex: '\\mathbf{W}^{(0)}\\rightarrow\\mathbf{W}^{(T)}' },
      { at: 12, ttl: '一个权重的例子', txt: '第 11 行第 1 个权重、净输入 pre、GELU 值都在变：学习就是在改这些数。', sub: '权重、净输入、激活值都在变化，这就是学习。', tex: 'w_{11,1}:\\ 0.117\\rightarrow ?' },
      { at: 26, ttl: '输出也变了', txt: '训练前输出 6.66，训练后 6.57；整条 12 步曲线更贴合真实走势。', sub: '学习之后，12 步预测曲线从平变陡，更接近真实。', tex: '\\hat{\\mathbf{y}}^{(0)}\\rightarrow\\hat{\\mathbf{y}}^{(T)}' }
    ] },
    { start: 215, end: 245, name: '5 · 15 个种子：学习曲线', draw: draw5, steps: [
      { at: 0, ttl: '损失下降', txt: '15 个种子的验证损失都在下降；每个种子都从不同初始化出发。', sub: '15 个种子，各自从随机初始化开始，损失都在下降。', tex: '\\mathcal{L}(\\theta)\\downarrow' },
      { at: 12, ttl: '集成与指标', txt: '15 个模型平均后，测试 RMSE 2.1611；校准后 2.0125，低于持续性基线 2.1225。', sub: '15 个模型取平均，校准后误差低于持续性基线。', tex: '\\hat{\\mathbf{y}}^{\\mathrm{ens}}=\\frac{1}{15}\\sum_s\\hat{\\mathbf{y}}_s' }
    ] },
    { start: 245, end: 270, name: '6 · 总结', draw: draw6, steps: [
      { at: 0, ttl: '一条链路', txt: '公式 → 一个数 → 矩阵 → 权重 → 激活 → 编码器 → 投影 → 输出 → 学习 → 校准。', sub: '这就是一个数字的完整旅程，也是模型学习的全部过程。', tex: '' }
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
    cap.querySelector('.fml').innerHTML = step.tex ? tex(step.tex) : '';
    var chs = document.querySelectorAll('#chapters .ch');
    for (var j = 0; j < chs.length; j++) chs[j].classList.toggle('on', j === i);
  }
  function render() {
    var i = chapterAt(T), c = CH[i];
    ctx.clearRect(0, 0, W, H);
    c.draw(T - c.start);
    ctx.fillStyle = 'rgba(5,10,18,0.72)'; roundRect(18, 14, 360, 36, 9); ctx.fill();
    txt(c.name, 34, 32, 13.5, COL.gold, 'left', 600);
    ctx.fillStyle = 'rgba(5,10,18,0.72)'; ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = COL.gold; ctx.fillRect(0, H - 3, W * (T / DUR), 3);
    txt('真实数据 · 4:30 · 一个数字的旅程', 18, H - 21, 10.5, COL.muted, 'left');
    txt('WMEG-Net · 15,385 参数', W - 18, H - 21, 10.5, COL.muted, 'right');
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
      fetch('data/journey_data.json').then(function (r) { return r.json(); }),
      fetch('data/app_data.json').then(function (r) { return r.json(); }),
      fetch('data/geo.json').then(function (r) { return r.json(); })
    ]).then(function (arr) {
      EX = arr[0]; JR = arr[1]; APP = arr[2]; GEO = arr[3];
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
          CH.forEach(function (c) { c.steps.forEach(function (s) { out.push({ t: c.start + s.at, ttl: s.ttl, sub: s.sub || s.txt }); }); });
          return out;
        }
      };
      if (!RECORD) requestAnimationFrame(tick);
    }).catch(function (e) {
      document.getElementById('caption').querySelector('.txt').textContent = '数据加载失败：' + e;
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
