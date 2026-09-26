/* ===========================================================
   storage.js
   進行表・プロジェクト・再生状態を localStorage に保持する
   単純なデータストア。ブラウザの複数タブ間は
   'storage' イベント + ポーリングの両方で同期する。
   =========================================================== */

(function (global) {
  const KEY = "runtimeboard_v1";

  const DEFAULT_STATE = () => ({
    project: {
      title: "無題のプロジェクト",
      venue: "",
      startTime: "09:00", // HH:MM 開始基準時刻
    },
    events: [],
    playback: {
      state: "stop", // 'stop' | 'play' | 'pause'
      loadedId: null,
      startedAt: null, // epoch ms（再生/再開した時刻）
      elapsedBeforeStart: 0, // 一時停止時点までの経過秒
      addedTime: 0, // 手動で加算/減算した秒数（現在ロード中のイベント用）
    },
    message: {
      text: "",
      visible: false,
      level: "normal", // 'normal' | 'warn' | 'danger'
    },
  });

  function uid() {
    return "e" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      // 欠けているキーを補う（将来の拡張に強くする）
      const base = DEFAULT_STATE();
      return {
        project: Object.assign(base.project, parsed.project),
        events: Array.isArray(parsed.events) ? parsed.events : [],
        playback: Object.assign(base.playback, parsed.playback),
        message: Object.assign(base.message, parsed.message),
      };
    } catch (e) {
      console.warn("state load failed, resetting", e);
      return DEFAULT_STATE();
    }
  }

  let state = load();
  let lastRaw = JSON.stringify(state);
  const listeners = new Set();

  function persist() {
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

  // 別タブでの変更を検知
  window.addEventListener("storage", (ev) => {
    if (ev.key !== KEY || ev.newValue == null) return;
    if (ev.newValue === lastRaw) return;
    lastRaw = ev.newValue;
    try {
      const parsed = JSON.parse(ev.newValue);
      state = parsed;
      notify();
    } catch (e) {
      /* ignore malformed */
    }
  });

  // file:// 環境など storage イベントが安定しない場合のフォールバック
  setInterval(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && raw !== lastRaw) {
        lastRaw = raw;
        state = JSON.parse(raw);
        notify();
      }
    } catch (e) {
      /* ignore */
    }
  }, 700);

  const Store = {
    uid,

    getState() {
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },

    /** update(draftFn) — draftFn は state を直接書き換えてよい（mutate） */
    update(mutator) {
      mutator(state);
      persist();
    },

    replaceAll(newState) {
      state = newState;
      persist();
    },

    reset() {
      state = DEFAULT_STATE();
      persist();
    },

    exportJSON() {
      return JSON.stringify(state, null, 2);
    },

    loadDemo() {
      state = {
        project: {
          title: "秋季発表会 2026",
          venue: "第一ホール",
          startTime: "13:00",
        },
        events: [
          blk("開場・受付"),
          evt("オープニング映像", "", "", 180, "#58a6ff"),
          evt("開会挨拶", "実行委員長", "", 300, "#58a6ff"),
          blk("第一部"),
          evt("吹奏楽部 演奏", "吹奏楽部", "3曲を予定", 900, "#3fb950"),
          evt("演劇部 発表", "演劇部", "", 1200, "#3fb950"),
          evt("休憩", "", "客席照明ON", 600, "#f0a020"),
          blk("第二部"),
          evt("ダンス部 発表", "ダンス部", "", 720, "#a371f7"),
          evt("有志発表", "有志団体", "入れ替え含む", 900, "#a371f7"),
          evt("閉会挨拶", "副委員長", "", 240, "#58a6ff"),
          evt("記念撮影", "", "全員ステージへ", 300, "#e5484d"),
        ],
        playback: DEFAULT_STATE().playback,
        message: DEFAULT_STATE().message,
      };
      persist();
    },
  };

  function evt(title, presenter, note, duration, colour) {
    return {
      id: uid(),
      type: "event",
      cue: "",
      title,
      subtitle: "",
      presenter: presenter || "",
      note: note || "",
      duration: duration,
      colour: colour || "",
      skip: false,
    };
  }
  function blk(title) {
    return {
      id: uid(),
      type: "block",
      cue: "",
      title,
      subtitle: "",
      presenter: "",
      note: "",
      duration: 0,
      colour: "",
      skip: false,
    };
  }

  global.RB = global.RB || {};
  global.RB.Store = Store;
})(window);
