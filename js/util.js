/* ===========================================================
   util.js — 小さな共通ユーティリティ
   =========================================================== */

(function (global) {
  let toastTimer = null;

  function toast(msg) {
    let el = document.getElementById("rb-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "rb-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function parseMMSS(text) {
    // "12:30" や "90" (秒) を秒数に変換
    if (!text) return 0;
    const t = String(text).trim();
    if (t.includes(":")) {
      const parts = t.split(":").map((n) => parseInt(n, 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    return parseInt(t, 10) || 0;
  }

  global.RB = global.RB || {};
  global.RB.Util = { toast, debounce, escapeHtml, parseMMSS };
})(window);
