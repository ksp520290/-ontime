/* ===========================================================
   storage.js
   進行表・プロジェクト・再生状態を localStorage に保持する
   データストア。ローカルの永続化に加えて sync.js が
   BroadcastChannel / Firebase 経由の同期を担当する。
   =========================================================== */

(function (global) {
  const KEY = "runtimeboard_v2";

  const DEFAULT_STATE = () => ({
    rev: 0, // 更新のたびに増える版数（同期の新旧比較に使用）
    project: {
      title: "無題のプロジェクト",
      venue: "",
      startTime: "09:00",
    },
    meta: {
      productionMode: false, // 本番モード（ON中は編集系画面をロック）
    },
    events: [],
    playback: {
      state: "stop", // 'stop' | 'play' | 'pause'
      loadedId: null,
      startedAt: null,
      elapsedBeforeStart: 0,
      addedTime: 0,
      showOffset: 0, // 完了済みイベントまでの累積の押し／巻き秒数（+押している / -巻いている）
    },
    message: {
      text: "",
      visible: false,
      level: "normal",
    },
    lighting: {
      intermission: false, // 幕間
      arena: false, // アリーナ
      worklight: false, // 作業灯
    },
    sound: {
      mcMic: false, // 司会マイク ON/OFF
    },
    schedule: {
      notes: "", // 予定表：連携内容
      todos: [], // 予定表：todoリスト [{id, text, done}]
    },
  });

  function uid(prefix) {
    return (
      (prefix || "e") + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
    );
  }

  function migrate(parsed) {
    const base = DEFAULT_STATE();
    if (!parsed || typeof parsed !== "object") return base;
    return {
      rev: parsed.rev || 0,
      project: Object.assign(base.project, parsed.project),
      meta: Object.assign(base.meta, parsed.meta),
      events: Array.isArray(parsed.events) ? parsed.events.map(migrateEvent) : [],
      playback: Object.assign(base.playback, parsed.playback),
      message: Object.assign(base.message, parsed.message),
      lighting: Object.assign(base.lighting, parsed.lighting),
      sound: Object.assign(base.sound, parsed.sound),
      schedule: {
        notes: (parsed.schedule && parsed.schedule.notes) || "",
        todos: (parsed.schedule && Array.isArray(parsed.schedule.todos) && parsed.schedule.todos) || [],
      },
    };
  }

  function migrateEvent(e) {
    return Object.assign(
      {
        id: uid(),
        type: "event", // 'event' | 'mc' | 'block'
        title: "",
        subtitle: "",
        presenter: "",
        note: "",
        duration: 0,
        colour: "",
        skip: false,
        curtain: "none", // 下手：緞帳 'none' | 'up' | 'down'（司会行のみ使用）
        memoKamite: "", // 上手：メモ（複数行）
        soundSource: "", // 音響：音源（複数行）
        mic: "", // 音響：マイク（複数行）
        reviewNote: "", // 振り返り
      },
      e
    );
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_STATE();
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn("state load failed, resetting", e);
      return DEFAULT_STATE();
    }
  }

  let state = load();
  let lastRaw = JSON.stringify(state);
  const listeners = new Set();

  function persist(bumpRev) {
    if (bumpRev !== false) state.rev = (state.rev || 0) + 1;
    lastRaw = JSON.stringify(state);
    try {
      localStorage.setItem(KEY, lastRaw);
    } catch (e) {
      console.error("state save failed", e);
    }
    notify();
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // 同一ブラウザの別タブ（storage イベント非対応環境向けフォールバック）
  window.addEventListener("storage", (ev) => {
    if (ev.key !== KEY || ev.newValue == null) return;
    if (ev.newValue === lastRaw) return;
    applyExternal(JSON.parse(ev.newValue));
  });

  setInterval(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && raw !== lastRaw) applyExternal(JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
  }, 700);

  function applyExternal(parsed) {
    const next = migrate(parsed);
    if ((next.rev || 0) < (state.rev || 0)) return; // 古い更新は無視
    state = next;
    lastRaw = JSON.stringify(state);
    try {
      localStorage.setItem(KEY, lastRaw);
    } catch (e) {}
    notify();
  }

  function mcTemplate() {
    return migrateEvent({
      id: uid("mc"),
      type: "mc",
      title: "司会",
      subtitle: "つなぎ",
      presenter: "司会者",
      note: "",
      duration: 60,
      colour: "#6b7684",
    });
  }

  const Store = {
    uid,
    KEY,

    getState() {
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },

    update(mutator) {
      mutator(state);
      persist(true);
    },

    /** 外部（同期層）から受け取った state をそのまま適用する。rev の巻き戻りは無視。 */
    applyRemote(newState) {
      applyExternal(newState);
    },

    replaceAll(newState) {
      state = migrate(newState);
      persist(true);
    },

    reset() {
      state = DEFAULT_STATE();
      persist(true);
    },

    exportJSON() {
      return JSON.stringify(state, null, 2);
    },

    /** イベントを1件追加し、直後に司会（つなぎ）を自動挿入する */
    addEventWithMc() {
      this.update((s) => {
        s.events.push(
          migrateEvent({
            id: uid(),
            type: "event",
            title: "新しいイベント",
            duration: 300,
            colour: "#58a6ff",
          })
        );
        s.events.push(mcTemplate());
      });
    },

    addBlock() {
      this.update((s) => {
        s.events.push(migrateEvent({ id: uid("b"), type: "block", title: "新しい見出し" }));
      });
    },

    loadDemo() {
      const ev = (title, presenter, note, duration, colour) =>
        migrateEvent({ id: uid(), type: "event", title, presenter: presenter || "", note: note || "", duration, colour: colour || "" });
      const mc = (subtitle) => {
        const m = mcTemplate();
        m.subtitle = subtitle || m.subtitle;
        return m;
      };
      const blk = (title) => migrateEvent({ id: uid("b"), type: "block", title });

      state = migrate({
        project: { title: "秋季発表会 2026", venue: "第一ホール", startTime: "13:00" },
        events: [
          blk("開場・受付"),
          ev("オープニング映像", "", "", 180, "#58a6ff"),
          mc("開会挨拶へつなぐ"),
          ev("開会挨拶", "実行委員長", "", 300, "#58a6ff"),
          blk("第一部"),
          ev("吹奏楽部 演奏", "吹奏楽部", "3曲を予定", 900, "#3fb950"),
          mc("演劇部へつなぐ"),
          ev("演劇部 発表", "演劇部", "", 1200, "#3fb950"),
          mc("休憩案内"),
          ev("休憩", "", "客席照明ON", 600, "#f0a020"),
          blk("第二部"),
          ev("ダンス部 発表", "ダンス部", "", 720, "#a371f7"),
          mc("有志発表へつなぐ"),
          ev("有志発表", "有志団体", "入れ替え含む", 900, "#a371f7"),
          mc("閉会挨拶へつなぐ"),
          ev("閉会挨拶", "副委員長", "", 240, "#58a6ff"),
          ev("記念撮影", "", "全員ステージへ", 300, "#e5484d"),
        ],
      });
      persist(true);
    },
  };

  global.RB = global.RB || {};
  global.RB.Store = Store;
})(window);
