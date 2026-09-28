/* ===========================================================
   rundown-render.js
   進行表の行描画を共通化するヘルパー。
   ・renderCompactRow … 進行表(閲覧)/振り返り 用。司会はキュー"-"、
     副題はアコーディオン（タイトルクリックで開閉）、行高さは半分。
   ・renderFullRow    … エディタ/技術者用/オペレーター 用。
     司会を含む全項目を常時表示する。
   ・renderTechExtras … 技術者用タブ（上手・下手・照明・音響）の
     追加カラム／ツールバーを描画する。
   =========================================================== */

(function (global) {
  const Timer = global.RB.Timer;

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function firstLine(text) {
    if (!text) return "";
    const idx = text.indexOf("\n");
    return idx === -1 ? text : text.slice(0, idx) + " …";
  }

  // ---------------- コンパクト行（進行表 / 振り返り） ----------------

  /**
   * opts: { schedule, cueMap, expandedIds:Set, reviewIds:Set(振り返り用), reviewMode:bool }
   */
  function renderCompactRow(e, idx, opts) {
    const schedule = opts.schedule;
    const cueMap = opts.cueMap;

    if (e.type === "block") {
      const openReview = opts.reviewMode && opts.reviewIds.has(e.id);
      return `
        <tr class="block-row compact-row" data-id="${e.id}" data-kind="block">
          <td colspan="5" class="rowclick-target" data-id="${e.id}">${esc(e.title)}</td>
        </tr>
        ${opts.reviewMode ? reviewAccordionRow(e, openReview) : ""}
      `;
    }

    const sch = schedule.get(e.id);
    const isMc = e.type === "mc";
    const cue = isMc ? "-" : cueMap.get(e.id) || "";
    const open = isMc ? opts.expandedIds.has(e.id) : true;
    const openReview = opts.reviewMode && opts.reviewIds.has(e.id);

    const rowClass = [
      "event-row",
      "compact-row",
      isMc ? "mc-row" : "",
      isMc && !open ? "mc-collapsed" : "",
      e.skip ? "skipped" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const titleHtml = isMc
      ? `<span class="mc-toggle" data-toggle-mc="${e.id}">${esc(e.title) || "司会"} <span class="mc-caret">${open ? "▾" : "▸"}</span></span>` +
        (opts.reviewMode ? ` <span class="rowclick-target" data-id="${e.id}" title="振り返りメモ">📝</span>` : "")
      : `<span class="${opts.reviewMode ? "rowclick-target" : ""}" ${opts.reviewMode ? `data-id="${e.id}"` : ""}>${esc(e.title) || "（無題）"}</span>`;

    return `
      <tr class="${rowClass}" data-id="${e.id}">
        <td class="mono cue-cell">${cue}</td>
        <td class="colour-cell"><span class="colour-chip" style="background:${e.colour || "#333"}"></span></td>
        <td class="title-cell">
          ${titleHtml}
          ${isMc ? `<div class="mc-subtitle" style="display:${open ? "block" : "none"}">${esc(e.subtitle)}${e.presenter ? " ／ " + esc(e.presenter) : ""}</div>` : `<div class="subtitle-line">${esc(e.subtitle)}</div>`}
        </td>
        <td class="mono time-cell">${sch ? Timer.formatClock(sch.start) : ""}</td>
        <td class="mono time-cell">${sch ? Timer.formatClock(sch.end) : ""}</td>
      </tr>
      ${opts.reviewMode ? reviewAccordionRow(e, openReview) : ""}
    `;
  }

  function reviewAccordionRow(e, open) {
    return `
      <tr class="review-row" style="display:${open ? "table-row" : "none"}" data-review-for="${e.id}">
        <td colspan="5" style="background:var(--bg-2);padding:10px 14px;">
          <label style="display:block;margin-bottom:4px;">振り返りメモ</label>
          <textarea data-review-field="${e.id}" rows="3" placeholder="反省点・改善点・気づきなど…" style="width:100%;">${esc(e.reviewNote)}</textarea>
        </td>
      </tr>
    `;
  }

  // ---------------- フル行（エディタ / 技術者用 / オペレーター） ----------------

  /**
   * opts: { schedule, cueMap, editable:bool, tabs:{kamite,shimote,lighting,sound}, currentId, tapOpenIds:Set }
   */
  function renderFullRow(e, idx, opts) {
    const schedule = opts.schedule;
    const cueMap = opts.cueMap;

    if (e.type === "block") {
      const extraCols = countExtraCols(opts.tabs) + (opts.showActions !== false ? 1 : 0);
      return `
        <tr class="block-row" data-id="${e.id}">
          <td colspan="${8 + extraCols}">
            ${
              opts.editable
                ? `<input type="text" class="block-title" data-id="${e.id}" value="${esc(e.title)}" placeholder="見出し" style="background:transparent;border:none;color:inherit;font-weight:600;width:100%;" />`
                : esc(e.title)
            }
          </td>
        </tr>`;
    }

    const sch = schedule.get(e.id);
    const isMc = e.type === "mc";
    const cue = isMc ? "-" : cueMap.get(e.id) || "";
    const rowClass = ["event-row", isMc ? "mc-row-full" : "", e.skip ? "skipped" : ""].filter(Boolean).join(" ");

    const ed = opts.editable;

    let html = `<tr class="${rowClass}" data-id="${e.id}">`;
    html += `<td class="mono" style="color:var(--text-2);font-size:11px;width:26px;">${cue}</td>`;
    html += ed
      ? `<td><input type="color" data-field="colour" data-id="${e.id}" value="${e.colour || "#58a6ff"}" /></td>`
      : `<td><span class="colour-chip" style="background:${e.colour || "#333"}"></span></td>`;

    if (ed) {
      html += `<td>
        <input type="text" data-field="title" data-id="${e.id}" value="${esc(e.title)}" placeholder="タイトル" style="font-weight:600;margin-bottom:2px;" />
        <input type="text" data-field="subtitle" data-id="${e.id}" value="${esc(e.subtitle)}" placeholder="副題（任意）" style="font-size:11.5px;color:var(--text-2);" />
      </td>
      <td><input type="text" data-field="presenter" data-id="${e.id}" value="${esc(e.presenter)}" placeholder="—" /></td>
      <td><input type="text" data-field="note" data-id="${e.id}" value="${esc(e.note)}" placeholder="—" /></td>
      <td><input type="text" class="mono" data-field="duration" data-id="${e.id}" value="${Timer.formatSeconds(e.duration)}" /></td>`;
    } else {
      html += `<td>
        <div style="font-weight:600;">${esc(e.title) || "（無題）"}</div>
        <div style="font-size:11.5px;color:var(--text-2);">${esc(e.subtitle)}</div>
      </td>
      <td>${esc(e.presenter)}</td>
      <td style="font-size:12px;color:var(--text-1);">${esc(e.note)}</td>
      <td class="mono">${Timer.formatSeconds(e.duration)}</td>`;
    }

    html += `<td class="mono" style="font-size:12px;color:var(--text-1);">${sch ? Timer.formatClock(sch.start) : ""}</td>`;
    html += `<td class="mono" style="font-size:12px;color:var(--text-1);">${sch ? Timer.formatClock(sch.end) : ""}</td>`;

    // ---- 技術者用タブの追加カラム ----
    if (opts.tabs && opts.tabs.kamite) {
      html += `<td>${memoCell(e, "memoKamite", opts)}</td>`;
    }
    if (opts.tabs && opts.tabs.shimote) {
      html += `<td>${isMc ? curtainButtons(e) : '<span style="color:var(--text-2);">—</span>'}</td>`;
    }
    if (opts.tabs && opts.tabs.sound) {
      html += `<td>${memoCell(e, "soundSource", opts)}</td>`;
      html += `<td>${memoCell(e, "mic", opts)}</td>`;
    }

    if (opts.showActions !== false) {
      html += `<td style="white-space:nowrap;">
        <button class="icon-btn" data-act="skip" data-id="${e.id}" title="${e.skip ? "スキップ解除" : "スキップ"}">${e.skip ? "👁" : "🚫"}</button>
        ${
          opts.skipOnly
            ? ""
            : `<button class="icon-btn" data-act="up" data-id="${e.id}" title="上へ">▲</button>
        <button class="icon-btn" data-act="down" data-id="${e.id}" title="下へ">▼</button>
        <button class="icon-btn warn" data-act="del" data-id="${e.id}" title="削除">✕</button>`
        }
      </td>`;
    }

    html += `</tr>`;
    return html;
  }

  function countExtraCols(tabs) {
    if (!tabs) return 0;
    let n = 0;
    if (tabs.kamite) n += 1;
    if (tabs.shimote) n += 1;
    if (tabs.sound) n += 2;
    return n;
  }

  function memoCell(e, field, opts) {
    const isCurrent = opts.currentId && opts.currentId === e.id;
    const open = isCurrent || (opts.tapOpenIds && opts.tapOpenIds.has(e.id + ":" + field));
    const val = e[field] || "";
    if (!opts.editable && !open) {
      return `<div class="memo-line" data-memo-open="${e.id}:${field}">${esc(firstLine(val)) || '<span style="color:var(--text-2);">—</span>'}</div>`;
    }
    if (!open) {
      return `<div class="memo-line" data-memo-open="${e.id}:${field}">${esc(firstLine(val)) || '<span style="color:var(--text-2);">タップして入力</span>'}</div>`;
    }
    return `<textarea class="memo-textarea" data-memo-field="${field}" data-id="${e.id}" rows="2" placeholder="メモを入力…">${esc(val)}</textarea>`;
  }

  function curtainButtons(e) {
    const cur = e.curtain || "none";
    const opt = (val, label) =>
      `<button class="curtain-btn ${cur === val ? "active" : ""}" data-curtain="${val}" data-id="${e.id}">${label}</button>`;
    return `<div class="curtain-group">${opt("none", "ー")}${opt("up", "上げ")}${opt("down", "下げ")}</div>`;
  }

  // ---------------- 技術者用 ヘッダー行 ----------------

  function techHeaderCells(tabs, editable) {
    let html = `
      <th style="width:26px;">キュー</th>
      <th style="width:18px;">色</th>
      <th>タイトル / 副題</th>
      <th style="width:120px;">出演・担当</th>
      <th style="width:160px;">メモ</th>
      <th style="width:80px;">所要時間</th>
      <th style="width:64px;">開始</th>
      <th style="width:64px;">終了</th>
    `;
    if (tabs.kamite) html += `<th style="width:180px;">上手メモ</th>`;
    if (tabs.shimote) html += `<th style="width:150px;">緞帳（司会）</th>`;
    if (tabs.sound) html += `<th style="width:160px;">音源</th><th style="width:160px;">マイク</th>`;
    html += `<th style="width:120px;"></th>`;
    return html;
  }

  global.RB = global.RB || {};
  global.RB.Rundown = {
    escapeHtml: esc,
    renderCompactRow,
    renderFullRow,
    techHeaderCells,
    countExtraCols,
  };
})(window);
