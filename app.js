(function () {
  "use strict";

  var EXAM_DATE = new Date(2026, 6, 7); // 7 July 2026 (month is 0-based)
  var STORE_KEY = "hsg-r-prep-progress-v1";

  // ---------- state ----------
  var progress = loadProgress();       // { [id]: { answered:true, correct:bool } }
  var view = "dashboard";
  var practice = { filter: "all", queue: [], index: 0, selected: null, confirmed: false };

  // ---------- helpers ----------
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // escape, then turn `code` spans into <code>
  function fmt(s) {
    return esc(s).replace(/`([^`]+)`/g, function (_, m) { return "<code>" + m + "</code>"; });
  }
  function topicName(key) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].key === key) return TOPICS[i].name;
    return key;
  }
  function typeLabel(t) { return t === "tf" ? "True / False" : t === "multi" ? "Multiple correct" : "Single answer"; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort(), y = b.slice().sort();
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  function questionsFor(filter) {
    if (filter === "all") return QUESTIONS.slice();
    if (filter === "wrong") return QUESTIONS.filter(function (q) { return progress[q.id] && !progress[q.id].correct; });
    return QUESTIONS.filter(function (q) { return q.topic === filter; });
  }

  // ---------- view switching ----------
  function setView(v) {
    view = v;
    ["dashboard", "practice", "review"].forEach(function (name) {
      document.getElementById("view-" + name).hidden = (name !== v);
    });
    document.querySelectorAll(".nav-link").forEach(function (b) {
      var on = b.getAttribute("data-view") === v;
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var main = document.getElementById("main");
    if (main && main.focus) main.focus();
    if (v === "dashboard") renderDashboard();
    if (v === "practice") renderPracticeShell();
    if (v === "review") renderReview();
    window.scrollTo(0, 0);
  }

  // ---------- dashboard ----------
  function computeStats() {
    var answered = 0, correct = 0;
    Object.keys(progress).forEach(function (id) {
      if (progress[id] && progress[id].answered) { answered++; if (progress[id].correct) correct++; }
    });
    var acc = answered ? Math.round((correct / answered) * 100) : 0;
    return { answered: answered, correct: correct, accuracy: acc, total: QUESTIONS.length };
  }
  function renderDashboard() {
    var days = Math.max(0, Math.ceil((EXAM_DATE - new Date()) / 86400000));
    document.getElementById("daysToExam").textContent = days;

    var s = computeStats();
    document.getElementById("statAnswered").textContent = s.answered;
    document.getElementById("statAccuracy").textContent = s.accuracy + "%";
    document.getElementById("statTotal").textContent = s.total;

    var list = document.getElementById("topicList");
    list.innerHTML = "";
    TOPICS.forEach(function (t) {
      var qs = QUESTIONS.filter(function (q) { return q.topic === t.key; });
      var ans = qs.filter(function (q) { return progress[q.id] && progress[q.id].answered; }).length;
      var pct = qs.length ? Math.round((ans / qs.length) * 100) : 0;
      var el = document.createElement("button");
      el.className = "topic-item";
      el.innerHTML =
        '<div class="topic-name">' + esc(t.name) + "</div>" +
        '<div class="topic-meta">' + ans + " / " + qs.length + " answered</div>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>';
      el.addEventListener("click", function () { startPractice(t.key); });
      list.appendChild(el);
    });
  }

  // ---------- practice ----------
  function startPractice(filter, opts) {
    practice.filter = filter;
    var qs = questionsFor(filter);
    practice.queue = (opts && opts.shuffle) ? shuffle(qs) : qs;
    practice.index = 0;
    practice.selected = null;
    practice.confirmed = false;
    setView("practice");
  }
  function renderPracticeShell() {
    // filter pills
    var fbar = document.getElementById("practiceFilters");
    if (!fbar.dataset.built) {
      fbar.appendChild(makePill("All", "all", function () { startPractice("all"); }));
      TOPICS.forEach(function (t) { fbar.appendChild(makePill(t.name, t.key, function () { startPractice(t.key); })); });
      fbar.dataset.built = "1";
    }
    // arriving via top nav with no active set: build one from the current filter
    if (!practice.queue.length) {
      practice.queue = questionsFor(practice.filter);
      practice.index = 0; practice.selected = null; practice.confirmed = false;
    }
    fbar.querySelectorAll(".pill").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-key") === practice.filter);
    });
    renderQuestion();
  }
  function makePill(label, key, onClick) {
    var b = document.createElement("button");
    b.className = "pill"; b.textContent = label; b.setAttribute("data-key", key);
    b.addEventListener("click", onClick);
    return b;
  }
  function renderQuestion() {
    var card = document.getElementById("practiceCard");
    var q = practice.queue[practice.index];
    var n = practice.queue.length;

    // progress
    document.getElementById("practiceCount").textContent = n ? (practice.index + 1) + " / " + n : "0 / 0";
    document.getElementById("practiceProgress").style.width = n ? ((practice.index) / n) * 100 + "%" : "0%";

    if (!q) {
      card.innerHTML = '<div class="empty">No questions in this set yet.<br>Pick another topic, or add questions to questions.js.</div>';
      return;
    }

    var html = '<div class="qbadges"><span class="badge badge-type">' + typeLabel(q.type) + '</span>' +
               '<span class="badge badge-topic">' + esc(topicName(q.topic)) + '</span></div>';
    html += '<p class="qprompt">' + fmt(q.prompt) + "</p>";
    if (q.code) html += '<pre class="codeblock">' + esc(q.code) + "</pre>";
    html += '<div class="opts ' + q.type + '" id="opts"></div>';
    html += '<div id="explainSlot"></div>';
    html += '<div class="qactions">' +
              '<button class="btn btn-primary" id="confirmBtn">Confirm</button>' +
              '<button class="btn" id="nextBtn" hidden>Next question &rarr;</button>' +
              '<span class="kbd-hint"><span class="kbd">Enter</span> confirm &middot; <span class="kbd">&rarr;</span> next</span>' +
            "</div>";
    card.innerHTML = html;

    renderOptions(q);
    document.getElementById("confirmBtn").addEventListener("click", confirmAnswer);
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  }
  function renderOptions(q) {
    var box = document.getElementById("opts");
    box.innerHTML = "";
    var labels = q.type === "tf" ? ["True", "False"] : q.options;
    labels.forEach(function (label, i) {
      var b = document.createElement("button");
      b.className = "opt" + (q.type === "multi" ? " multi" : "");
      b.setAttribute("data-i", i);
      b.innerHTML = '<span class="mark"></span><span>' + fmt(label) + "</span>";
      b.addEventListener("click", function () { selectOption(q, i, b); });
      box.appendChild(b);
    });
  }
  function selectOption(q, i, btn) {
    if (practice.confirmed) return;
    if (q.type === "multi") {
      var set = practice.selected instanceof Array ? practice.selected : [];
      var pos = set.indexOf(i);
      if (pos === -1) set.push(i); else set.splice(pos, 1);
      practice.selected = set;
      btn.classList.toggle("selected");
      btn.querySelector(".mark").textContent = btn.classList.contains("selected") ? "\u2713" : "";
    } else {
      practice.selected = (q.type === "tf") ? (i === 0) : i;
      document.querySelectorAll("#opts .opt").forEach(function (o) {
        o.classList.remove("selected"); o.querySelector(".mark").textContent = "";
      });
      btn.classList.add("selected");
      btn.querySelector(".mark").textContent = "\u2713";
    }
  }
  function isCorrect(q) {
    if (q.type === "tf") return practice.selected === q.answer;
    if (q.type === "multi") return (practice.selected instanceof Array) && arraysEqual(practice.selected, q.answer);
    return practice.selected === q.answer;
  }
  function confirmAnswer() {
    if (practice.confirmed) return;
    var q = practice.queue[practice.index];
    var noSelection = practice.selected === null ||
      (q.type === "multi" && (!(practice.selected instanceof Array) || practice.selected.length === 0));
    if (noSelection) return;

    practice.confirmed = true;
    var correct = isCorrect(q);
    progress[q.id] = { answered: true, correct: correct };
    saveProgress();

    // mark options
    var answerSet = q.type === "tf" ? [q.answer ? 0 : 1] : (q.type === "multi" ? q.answer : [q.answer]);
    document.querySelectorAll("#opts .opt").forEach(function (o) {
      var i = parseInt(o.getAttribute("data-i"), 10);
      o.setAttribute("disabled", "true");
      var isAns = answerSet.indexOf(i) !== -1;
      var chosen = o.classList.contains("selected");
      if (isAns) { o.classList.add("correct"); o.querySelector(".mark").textContent = "\u2713"; }
      else if (chosen) { o.classList.add("wrong"); o.querySelector(".mark").textContent = "\u2717"; }
    });

    // explanation
    var slot = document.getElementById("explainSlot");
    slot.innerHTML =
      '<div class="explain ' + (correct ? "ok" : "no") + '" role="status">' +
        '<span class="verdict">' + (correct ? "\u2713 Correct" : "\u2717 Not quite") + "</span>" +
        fmt(q.explanation) +
      "</div>";

    document.getElementById("confirmBtn").setAttribute("disabled", "true");
    var nb = document.getElementById("nextBtn");
    nb.hidden = false; nb.focus();

    // refresh dashboard-dependent bits lazily (nothing visible here, but keep stats fresh)
  }
  function nextQuestion() {
    if (practice.index < practice.queue.length - 1) {
      practice.index++;
      practice.selected = null;
      practice.confirmed = false;
      renderQuestion();
    } else {
      // end of set
      var card = document.getElementById("practiceCard");
      document.getElementById("practiceProgress").style.width = "100%";
      document.getElementById("practiceCount").textContent = practice.queue.length + " / " + practice.queue.length;
      card.innerHTML = '<div class="empty"><strong>Set complete.</strong><br>' +
        'You answered ' + practice.queue.length + ' question(s). Pick another topic above, or head to the Dashboard.</div>';
    }
  }

  // ---------- review ----------
  function renderReview() {
    var rfilter = document.getElementById("view-review").dataset.filter || "all";
    var fbar = document.getElementById("reviewFilters");
    if (!fbar.dataset.built) {
      fbar.appendChild(makeReviewPill("All topics", "all"));
      TOPICS.forEach(function (t) { fbar.appendChild(makeReviewPill(t.name, t.key)); });
      fbar.dataset.built = "1";
    }
    fbar.querySelectorAll(".pill").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-key") === rfilter);
    });

    var list = document.getElementById("reviewList");
    list.innerHTML = "";
    var groups = rfilter === "all" ? TOPICS.map(function (t) { return t.key; }) : [rfilter];
    groups.forEach(function (key) {
      var qs = QUESTIONS.filter(function (q) { return q.topic === key; });
      if (!qs.length) return;
      var h = document.createElement("h2");
      h.className = "rev-group-title";
      h.innerHTML = esc(topicName(key)) + '<span class="count">' + qs.length + " questions</span>";
      list.appendChild(h);
      qs.forEach(function (q) { list.appendChild(reviewItem(q)); });
    });
    if (!list.children.length) list.innerHTML = '<div class="empty">No questions in this topic yet.</div>';
  }
  function makeReviewPill(label, key) {
    var b = makePill(label, key, function () {
      document.getElementById("view-review").dataset.filter = key;
      renderReview();
    });
    return b;
  }
  function reviewItem(q) {
    var st = progress[q.id];
    var dotClass = !st ? "" : (st.correct ? "ok" : "no");
    var wrap = document.createElement("button");
    wrap.className = "rev-item";
    wrap.setAttribute("aria-expanded", "false");

    var answerText = q.type === "tf"
      ? (q.answer ? "True" : "False")
      : (q.type === "multi"
          ? q.answer.map(function (i) { return q.options[i]; }).join("; ")
          : q.options[q.answer]);

    var inner =
      '<span class="dot ' + dotClass + '" aria-hidden="true"></span>' +
      '<span style="flex:1">' +
        '<span class="rev-q">' + fmt(q.prompt) + "</span>" +
        (q.code ? '<div class="rev-codeblock">' + esc(q.code) + "</div>" : "") +
        '<span class="rev-answer" hidden>' +
          '<span class="verdict">Answer: ' + esc(answerText) + "</span><br>" + fmt(q.explanation) +
        "</span>" +
      "</span>";
    wrap.innerHTML = inner;
    wrap.addEventListener("click", function () {
      var a = wrap.querySelector(".rev-answer");
      var open = a.hasAttribute("hidden");
      if (open) a.removeAttribute("hidden"); else a.setAttribute("hidden", "true");
      wrap.setAttribute("aria-expanded", open ? "true" : "false");
    });
    return wrap;
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", function (e) {
    if (view !== "practice") return;
    if (e.key === "Enter") {
      if (!practice.confirmed) { confirmAnswer(); }
      else { nextQuestion(); }
    } else if (e.key === "ArrowRight" && practice.confirmed) {
      nextQuestion();
    } else if ((e.key === "t" || e.key === "T") && !practice.confirmed) {
      var q = practice.queue[practice.index];
      if (q && q.type === "tf") { var b = document.querySelector('#opts .opt[data-i="0"]'); if (b) b.click(); }
    } else if ((e.key === "f" || e.key === "F") && !practice.confirmed) {
      var q2 = practice.queue[practice.index];
      if (q2 && q2.type === "tf") { var b2 = document.querySelector('#opts .opt[data-i="1"]'); if (b2) b2.click(); }
    }
  });

  // ---------- wiring ----------
  document.querySelectorAll(".nav-link").forEach(function (b) {
    b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
  });
  document.getElementById("qaRandom").addEventListener("click", function () { startPractice("all", { shuffle: true }); });
  document.getElementById("qaWrong").addEventListener("click", function () {
    var wrong = questionsFor("wrong");
    if (!wrong.length) { alert("No wrong answers yet. Practice some questions first."); return; }
    startPractice("wrong");
  });
  document.getElementById("qaReset").addEventListener("click", function () {
    if (confirm("Reset all saved progress on this device? This cannot be undone.")) {
      progress = {}; saveProgress(); renderDashboard();
    }
  });

  // exam pill date text
  (function () {
    var d = EXAM_DATE;
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    document.getElementById("examPill").textContent = "Exam: " + d.getDate() + " " + months[d.getMonth()];
  })();

  setView("dashboard");
})();
