/* ===========================================================
   nav.js — 全ページ共通のトップバーと「本番モード」ガードを描画する
   =========================================================== */

(function (global) {
  // group: home | prod | other。ext:true は新しいタブで開く外部リンク
  const BROADCAST_URL = "https://ksp520290.github.io/broadcastGroup/";
  const PAGES = [
    { href: "index.html", label: "ホーム", group: "home", prod: false, always: true },
    { href: "rundown-view.html", label: "進行表", group: "prod", prod: true },
    { href: "operator.html", label: "オペレーター", group: "prod", prod: true },
    { href: "timer.html", label: "タイマー表示", group: "prod", prod: true },
    { href: "backstage.html", label: "バックステージ", group: "prod", prod: true },
    { href: "technician.html", label: "技術者用", group: "prod", prod: true },
    { href: BROADCAST_URL, label: "照明・音響用 ↗", group: "prod", prod: true, ext: true },
    { href: "schedule.html", label: "予定表", group: "other", prod: false },
    { href: "editor.html", label: "進行表エディタ", group: "other", prod: false },
    { href: "rehearsal.html", label: "机上リハ", group: "other", prod: false },
    { href: "retrospective.html", label: "振り返り", group: "other", prod: false },
  ];
  const GROUPS = [
    { key: "home", label: "ホーム", first: "index.html" },
    { key: "prod", label: "本番モード", first: "rundown-view.html" },
    { key: "other", label: "その他", first: "schedule.html" },
  ];

  function currentFile() {
    const path = location.pathname.split("/").pop();
    return path === "" ? "index.html" : path;
  }

  function renderTopbar(mountEl) {
    const cur = currentFile();
    const curPage = PAGES.find((p) => p.href === cur);
    const curGroup = curPage ? curPage.group : "home";
    const Store = global.RB.Store;

    const bar = document.createElement("div");
    bar.className = "topbar";
    bar.innerHTML = `
      <div class="brand"><span class="dot"></span>Runtime&nbsp;Board</div>
      <div class="project-name" id="rb-project-name">-</div>
      <nav class="topnav" id="rb-groups"></nav>
    `;
    const sub = document.createElement("div");
    sub.className = "subbar";
    sub.innerHTML = `<nav class="topnav" id="rb-topnav"></nav>`;
    mountEl.appendChild(bar);
    mountEl.appendChild(sub);
    const groupEl = bar.querySelector("#rb-groups");
    const navEl = sub.querySelector("#rb-topnav");

    function renderLinks(state) {
      const pm = state.meta && state.meta.productionMode;
      // 3つのグループタブ（本番モード中は「その他」を隠して編集系ロックを表示）
      groupEl.innerHTML = GROUPS.filter((g) => !(pm && g.key === "other"))
        .map((g) => `<a href="${g.first}" class="${g.key === curGroup ? "active" : ""}">${g.label}</a>`)
        .join("");
      if (pm) groupEl.innerHTML += `<span class="badge" title="本番モード中は編集系画面がロックされています" style="margin-left:6px;"><span class="dot"></span>🔒 編集系ロック中</span>`;

      // 選択中グループ内のモードをすべて表示（本番モードグループは全画面が並ぶ）
      const items = PAGES.filter((p) => p.group === curGroup);
      sub.style.display = curGroup === "home" ? "none" : "";
      navEl.innerHTML = items
        .map((p) => {
          const active = p.href === cur ? "active" : "";
          return p.ext
            ? `<a href="${p.href}" target="_blank" rel="noopener noreferrer" class="${active}">${p.label}</a>`
            : `<a href="${p.href}" class="${active}">${p.label}</a>`;
        })
        .join("");
    }

    Store.subscribe((state) => {
      const el = document.getElementById("rb-project-name");
      if (el) el.textContent = state.project.title || "無題のプロジェクト";
      renderLinks(state);
    });
  }

  /**
   * 本番モード中に、編集系ページ（prod:false かつ always ではない）が
   * 開かれた場合にロック画面を表示する。編集系ページの <main> 直下などに
   * 呼び出しておく。ロックされていれば true を返す。
   */
  function guardProductionMode(pageIsProd) {
    if (pageIsProd) return false;
    const Store = global.RB.Store;
    const state = Store.getState();
    if (!state.meta || !state.meta.productionMode) return false;

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(9,12,16,0.94);z-index:200;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;text-align:center;padding:20px;";
    overlay.innerHTML = `
      <div style="font-size:42px;">🔒</div>
      <div style="font-size:18px;font-weight:700;">本番モード中は編集できません</div>
      <div style="color:var(--text-1);font-size:13px;max-width:360px;">
        このページは編集系機能のため、本番モードがONの間は利用できません。
        ホーム画面で本番モードをOFFにしてから開いてください。
      </div>
      <a href="index.html" style="margin-top:6px;"><button class="primary">ホームへ戻る</button></a>
    `;
    document.body.appendChild(overlay);
    return true;
  }

  global.RB = global.RB || {};
  global.RB.Nav = { renderTopbar, guardProductionMode, PAGES };
})(window);
