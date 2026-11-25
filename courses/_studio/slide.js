/* F2F Education – renders one slide frame from window.SCENE at window.STEP (1-based). Used by build.py. */
(function () {
  var S = window.SCENE, step = window.STEP || 1, M = window.META || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var md = function (s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>'); };
  var ico = function (n) { return '<i data-lucide="' + esc(n || 'circle') + '"></i>'; };
  var ic = function (n, cls) { return '<span class="ic ' + (cls || '') + '">' + ico(n) + '</span>'; };
  // item i (0-based) is visible once step > i; the newest one is highlighted while there are several
  var vis = function (i, total) { if (i >= step) return 'pending'; return (i === step - 1 && total > 1) ? 'current' : ''; };
  var kick = function () { return S.kicker ? '<div class="kicker">' + esc(S.kicker) + '</div>' : ''; };
  var h2 = function (t) { return t ? '<h2 class="title">' + md(t) + '</h2>' : ''; };

  function weave(w, h, c) {
    var cols = Math.ceil(w / c), rows = Math.ceil(h / c), g = Math.round(c * 0.1), s = '';
    var warp = ['#1B5FA8', '#2E7AD1', '#235FA0', '#3A86DA'], weft = ['#1C1F24', '#262A31', '#17191D'];
    for (var i = 0; i < cols; i++) s += '<rect x="' + (i * c + g) + '" y="0" width="' + (c - 2 * g) + '" height="' + h + '" fill="' + warp[i % warp.length] + '"/>';
    for (var j = 0; j < rows; j++) s += '<rect x="0" y="' + (j * c + g) + '" width="' + w + '" height="' + (c - 2 * g) + '" fill="' + weft[j % weft.length] + '"/>';
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) if ((i + j) % 2 === 1)
      s += '<rect x="' + (i * c + g) + '" y="' + (j * c) + '" width="' + (c - 2 * g) + '" height="' + c + '" fill="' + warp[i % warp.length] + '" stroke="rgba(0,0,0,.18)" stroke-width="2"/>';
    return '<svg class="weave" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }
  var fade = '<div style="position:absolute;inset:0;background:linear-gradient(90deg,#111111 0%,#111111 46%,rgba(17,17,17,.82) 62%,rgba(17,17,17,.2) 100%)"></div>';

  var R = {};
  R.opener = function () {
    return { dark: true, html: weave(900, 1160, 116) + fade +
      '<div class="course-name">' + esc(M.course_title) + '</div>' +
      '<div class="opener"><span class="k">Lesson ' + M.lesson_index + ' of ' + M.lesson_count + '</span>' +
      '<h1>' + md(S.title) + '</h1>' + (S.sub ? '<div class="sub">' + md(S.sub) + '</div>' : '') +
      '<div class="meta"><span>' + ico('clock') + 'About ' + (M.lesson_minutes || 3) + ' min</span><span>' + ico('award') + 'Free certificate</span></div></div>' +
      '<div class="brandplate"><img src="' + M.logo + '"></div>' };
  };
  R.cover = function () {
    return { dark: true, html: weave(900, 1160, 116) + fade + (S.icon ? '<span class="ic cover-ic">' + ico(S.icon) + '</span>' : '') +
      '<div class="opener"><span class="k">Free course</span><h1 style="font-size:' + (S.title.length > 48 ? 78 : 92) + 'px">' + md(S.title) + '</h1>' +
      (S.sub ? '<div class="sub">' + md(S.sub) + '</div>' : '') +
      '<div class="meta"><span>' + ico('clock') + esc(S.label || '') + '</span><span>' + ico('award') + 'Certificate of completion</span></div></div>' +
      '<div class="brandplate"><img src="' + M.logo + '"></div>' };
  };
  // LearnWorlds course-card image: picture only (title, label and author are drawn by LearnWorlds around/over it,
  // label top-right and author bottom-left), so keep those corners clear
  R.card = function () {
    return { dark: true, html: '<div class="cardimg">' + weave(1920, 1080, 120) + '<div class="shade"></div>' +
      (S.topic ? '<span class="topic">' + esc(S.topic) + '</span>' : '') +
      '<span class="ic big">' + ico(S.icon || 'book-open') + '</span></div>' };
  };
  R.cards = function () {
    var it = S.items || [], cols = S.cols || (it.length === 4 ? 2 : Math.min(it.length, 3));
    return { html: kick() + h2(S.title) + '<div class="grid c' + cols + '">' + it.map(function (x, i) {
      return '<div class="card ' + (cols === 2 && it.length <= 4 ? 'row ' : '') + vis(i, it.length) + '">' + ic(x.icon) + '<div><h3>' + md(x.h) + '</h3>' + (x.p ? '<p style="margin-top:12px">' + md(x.p) + '</p>' : '') + '</div></div>';
    }).join('') + '</div>' };
  };
  R.list = function () {
    var it = S.items || [];
    return { html: kick() + h2(S.title) + (S.lead ? '<p class="lead" style="margin:-18px 0 34px">' + md(S.lead) + '</p>' : '') +
      '<div class="list' + (it.length > 5 ? ' tight' : '') + '">' + it.map(function (x, i) {
        var n = x.icon ? '<span class="n">' + ico(x.icon) + '</span>' : '<span class="n">' + (S.numbered === false ? ico('check') : (i + 1)) + '</span>';
        return '<div class="it ' + vis(i, it.length) + '">' + n + '<div class="t">' + md(x.t) + (x.sub ? '<small>' + md(x.sub) + '</small>' : '') + '</div></div>';
      }).join('') + '</div>' };
  };
  R.recap = function () {
    var it = S.items || [];
    return { html: kick() + h2(S.title || 'Key takeaways') + '<div class="list">' + it.map(function (x, i) {
      return '<div class="it ' + vis(i, it.length) + '"><span class="n">' + ico('check') + '</span><div class="t">' + md(x.t || x) + '</div></div>';
    }).join('') + '</div>' };
  };
  R.focus = function () {
    var p = S.points || [], last = step >= p.length;
    return { html: kick() + h2(S.title) + '<div class="focus"><div class="left">' + ic(S.icon, 'lg') + '<h3>' + md(S.h) + '</h3><p>' + md(S.p) + '</p></div>' +
      '<div><div class="label">' + esc(S.label || 'Key points') + '</div><div class="pts">' + p.map(function (x, i) {
        x = typeof x === 'string' ? { t: x } : x;
        return '<div class="pt ' + vis(i, p.length) + '">' + ic(x.icon || 'arrow-right', 'sm') + '<div>' + md(x.t) + '</div></div>';
      }).join('') + '</div>' + (S.note ? '<div class="note ' + (last ? '' : 'pending') + '">' + md(S.note) + '</div>' : '') + '</div></div>' };
  };
  R.chips = function () {
    return { html: kick() + h2(S.title) + (S.lead ? '<p class="lead" style="margin:-18px 0 30px">' + md(S.lead) + '</p>' : '') +
      '<div class="chips">' + (S.chips || []).map(function (c) { return '<span class="chip2">' + ico(c.icon) + esc(c.t) + '</span>'; }).join('') + '</div>' +
      (S.note ? '<div class="note ' + (step >= 2 ? '' : 'pending') + '">' + md(S.note) + '</div>' : '') };
  };
  R.compare = function () {
    var col = function (c, cls, show, mark) {
      return '<div class="col ' + cls + ' ' + (show ? '' : 'pending') + '"><h3>' + esc(c.h) + '</h3><ul>' + (c.items || []).map(function (t) { return '<li>' + ico(mark) + '<span>' + md(t) + '</span></li>'; }).join('') + '</ul></div>';
    };
    return { html: kick() + h2(S.title) + '<div class="cmp">' + col(S.left, 'old', true, S.left_mark || 'x') +
      '<div class="mid ' + (step >= 2 ? '' : 'pending') + '">' + ico('arrow-right') + '</div>' + col(S.right, 'new', step >= 2, S.right_mark || 'check') + '</div>' };
  };
  R.shift = function () {
    return { html: kick() + (S.title ? h2(S.title) : '') + '<div class="shift"><span class="pill from">' + md(S.from) + '</span>' + ico('arrow-right') +
      '<span class="pill to">' + md(S.to) + '</span></div>' + (S.p ? '<p class="lead" style="text-align:center;margin:0 auto">' + md(S.p) + '</p>' : '') };
  };
  R.statement = function () {
    return { html: kick() + '<div class="stmt"><div class="big">' + md(S.big) + '</div>' + (S.small ? '<div class="small">' + md(S.small) + '</div>' : '') + '</div>' };
  };
  R.definition = function () {
    return { html: '<div class="stmt def"><span class="tag">' + esc(S.tag || 'Definition') + '</span><div class="big">' + md(S.big) + '</div></div>' };
  };
  R.reflect = function () {
    return { html: '<div class="reflect">' + ic('lightbulb', 'lg') + '<div><h3>Think about it</h3><div class="q">' + md(S.q) + '</div>' + (S.q2 ? '<div class="q">' + md(S.q2) + '</div>' : '') + '</div></div>' };
  };
  R.stack = function () {
    var L = S.layers || [];
    return { html: kick() + h2(S.title) + '<div class="stack">' + L.map(function (x, i) {
      return '<div class="layer ' + vis(i, L.length) + '">' + ic(x.icon, 'sm') + '<h3>' + md(x.h) + '</h3><p>' + md(x.p) + '</p></div>';
    }).join('') + '</div>' };
  };
  R.example = function () {
    var p = S.points || [];
    return { html: '<div class="ex"><div><span class="tag">' + esc(S.tag || 'Real-world example') + '</span><h3>' + md(S.h) + '</h3><p>' + md(S.p) + '</p>' +
      (p.length ? '<ul>' + p.map(function (t, i) { return '<li class="' + (i + 1 < step ? '' : 'pending') + '">' + ico('arrow-right') + '<span>' + md(t) + '</span></li>'; }).join('') + '</ul>' : '') +
      (S.src ? '<div class="src">' + esc(S.src) + '</div>' : '') + '</div>' +
      '<div class="art">' + weave(520, 600, 80) + ic(S.icon, 'lg') + '</div></div>' };
  };
  R.stats = function () {
    var it = S.items || [], last = step >= it.length;
    return { html: kick() + h2(S.title) + '<div class="stats" style="grid-template-columns:repeat(' + it.length + ',1fr)">' + it.map(function (x, i) {
      return '<div class="stat ' + vis(i, it.length) + '"><div class="v">' + esc(x.v) + '</div><div class="l">' + md(x.l) + '</div></div>';
    }).join('') + '</div>' + (S.note ? '<div class="note ' + (last ? '' : 'pending') + '">' + md(S.note) + '</div>' : '') };
  };
  R.table = function () {
    var rows = S.rows || [];
    return { html: kick() + h2(S.title) + '<table class="tb"><thead><tr>' + (S.head || []).map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr class="' + (i < step ? '' : 'pending') + '">' + r.map(function (c) { return '<td>' + md(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' };
  };
  R.formula = function () {
    var it = S.items || [];
    return { html: kick() + h2(S.title) + '<div class="fm">' + it.map(function (x, i) {
      return '<div class="row ' + vis(i, it.length) + '"><div><h3>' + md(x.h) + '</h3>' + (x.p ? '<p>' + md(x.p) + '</p>' : '') + '</div><div class="f">' + esc(x.f) + '</div></div>';
    }).join('') + '</div>' };
  };
  R.calc = function () {
    var st = S.steps || [], total = st.length + 2;
    return { html: kick() + h2(S.title || 'Worked example') + '<div class="calc"><div class="given"><div class="label">Given</div>' +
      (S.given || []).map(function (g) { return '<div class="g">' + md(g) + '</div>'; }).join('') + '</div><div class="work">' +
      st.map(function (t, i) { return '<div class="s ' + (step >= i + 2 ? (step === i + 2 ? 'current' : '') : 'pending') + '"><span class="n">' + (i + 1) + '</span><div>' + md(t) + '</div></div>'; }).join('') +
      '<div class="res ' + (step >= total ? '' : 'pending') + '">' + ico('circle-check') + '<div>' + md(S.result) + '</div></div></div></div>' };
  };
  R.closing = function () {
    var src = M.source || {};
    var cards = [
      ['clipboard-check', 'Take the knowledge check', (M.quiz_count || 10) + ' questions · pass mark 70 %'],
      ['award', 'Earn your certificate', 'Free certificate of completion from F2F Education'],
      ['book-open', 'Read the original article', 'By ' + (src.authors || 'Fibre2Fashion') + ' on Fibre2Fashion']
    ];
    return { html: kick() + h2(S.title || 'Well done!') + (S.sub ? '<p class="lead" style="margin:-18px 0 40px">' + md(S.sub) + '</p>' : '') +
      '<div class="next">' + cards.map(function (c) { return '<div class="card">' + ic(c[0]) + '<h3>' + esc(c[1]) + '</h3><p>' + esc(c[2]) + '</p></div>'; }).join('') + '</div>' };
  };
  R.glossary = function () {
    var it = S.items || [];
    return { html: h2(S.title || 'Glossary') + '<div class="gl">' + it.map(function (x) { return '<div><b>' + esc(x.term) + '</b><span>' + md(x.def) + '</span></div>'; }).join('') + '</div>' };
  };

  var r = (R[S.type] || R.statement)();
  var root = document.getElementById('root');
  if (r.dark) {
    root.innerHTML = '<div class="frame dark">' + r.html + '</div>';
  } else {
    var pct = Math.round(100 * (M.scene_index || 1) / (M.scene_count || 1));
    var credit = M.source ? 'Based on “' + esc(M.source.title) + '” by ' + esc(M.source.authors) + ' · Fibre2Fashion' : '';
    root.innerHTML = '<div class="frame"><div class="top"><img src="' + M.logo + '"><div class="crumb"><span class="cname">' + esc(M.course_title) + '</span>' +
      (M.lesson_index ? '<span class="chip">Lesson ' + M.lesson_index + '</span>' : '') + '</div></div>' +
      '<div class="body"><div class="inner">' + r.html + '</div></div>' +
      '<div class="foot"><span class="credit">' + credit + '</span>' + (M.lesson_index ? '<span class="bar"><i style="width:' + pct + '%"></i></span>' : '') + '</div></div>';
  }
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });

  // shrink content that would overflow (same layout for every step, because hidden items keep their space)
  function fit() {
    var b = document.querySelector('.body'), inner = document.querySelector('.inner');
    if (b && inner) {
      // standardised CSS zoom scales px sizes but not % widths, so the content keeps the full slide width
      var setZ = function (z) { inner.style.zoom = z; };
      var room = b.clientHeight - 8, h = inner.scrollHeight, z = 1;
      if (h < room * 0.72) { z = Math.min(1.2, (room * 0.8) / h); setZ(z); }      // short slides: enlarge a little
      while (inner.scrollHeight * z > room && z > 0.66) { z -= 0.02; setZ(z); }      // long slides: shrink to fit
      if (inner.scrollHeight * z > room) document.body.setAttribute('data-overflow', '1');
    }
    document.body.setAttribute('data-ready', '1');
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
})();
