/* ===========================================================
   nav.js — 全ページ共通のトップバーを描画する
   =========================================================== */

(function (global) {
  const PAGES = [
    { href: "index.html", label: "ホーム" },
    { href: "editor.html", label: "進行表エディタ" },
    { href: "operator.html", label: "オペレーター" },
    { href: "timer.html", label: "タイマー表示" },
    { href: "backstage.html", label: "バックステージ" },
  ];

  function currentFile() {
    const path = location.pathname.split("/").pop();
    return path === "" ? "index.html" : path;
  }

  function renderTopbar(mountEl) {
    const cur = currentFile();
    const Store = global.RB.Store;

    const bar = document.createElement("div");
    bar.className = "topbar";
    bar.innerHTML = `
      <div class="brand"><span class="dot"></span>Runtime&nbsp;Board</div>
      <div class="project-name" id="rb-project-name">-</div>
      <nav class="topnav">
        ${PAGES.map(
          (p) =>
            `<a href="${p.href}" class="${p.href === cur ? "active" : ""}">${p.label}</a>`
        ).join("")}
      </nav>
    `;
    mountEl.appendChild(bar);

    Store.subscribe((state) => {
      const el = document.getElementById("rb-project-name");
      if (el) el.textContent = state.project.title || "無題のプロジェクト";
    });
  }

  global.RB = global.RB || {};
  global.RB.Nav = { renderTopbar };
})(window);
