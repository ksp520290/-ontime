/* ===========================================================
   timer-engine.js
   再生状態（play / pause / stop）から現在の経過・残り時間を
   計算し、進行表の開始・終了時刻（スケジュール）を組み立てる。
   =========================================================== */

(function (global) {
  const Store = global.RB.Store;

  function pad(n) {
    return String(Math.floor(n)).padStart(2, "0");
  }

  /** 秒 -> "HH:MM:SS" または "MM:SS"。符号付きにも対応（マイナスは超過時間） */
  function formatSeconds(totalSeconds, opts) {
    opts = opts || {};
    const sign = totalSeconds < 0 ? "-" : "";
    let s = Math.abs(Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0 || opts.forceHours) {
      return `${sign}${pad(h)}:${pad(m)}:${pad(sec)}`;
    }
    return `${sign}${pad(m)}:${pad(sec)}`;
  }

  /** "HH:MM" を基準に、当日の epoch ms を返す */
  function baseTimeToday(hhmm) {
    const [h, m] = (hhmm || "09:00").split(":").map((n) => parseInt(n, 10) || 0);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  function formatClock(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * 進行表全体のスケジュール（各イベントの開始・終了予定時刻）を計算する。
   * skip されたイベントは所要時間を消費しない。
   * 戻り値: Map<eventId, {start, end}>  (epoch ms)
   */
  function buildSchedule(state) {
    const map = new Map();
    let cursor = baseTimeToday(state.project.startTime);
    for (const e of state.events) {
      if (e.type === "block") {
        map.set(e.id, { start: cursor, end: cursor });
        continue;
      }
      const start = cursor;
      const dur = e.skip ? 0 : e.duration || 0;
      const end = start + dur * 1000;
      map.set(e.id, { start, end });
      cursor = end;
    }
    return map;
  }

  function playableEvents(state) {
    return state.events.filter((e) => e.type !== "block");
  }

  function findEvent(state, id) {
    return state.events.find((e) => e.id === id) || null;
  }

  function nextPlayable(state, afterId) {
    const list = playableEvents(state).filter((e) => !e.skip);
    if (!afterId) return list[0] || null;
    const idx = list.findIndex((e) => e.id === afterId);
    if (idx === -1) return list[0] || null;
    return list[idx + 1] || null;
  }

  /**
   * 現在ロードされているイベントの経過・残り秒数を返す。
   * stop -> elapsed 0 / remaining = duration
   * play -> Date.now() から計算（他タブでも同じ結果になる）
   * pause -> 停止時点で固定
   */
  function computeTiming(state) {
    const pb = state.playback;
    const ev = findEvent(state, pb.loadedId);
    if (!ev) {
      return { event: null, elapsed: 0, remaining: 0, duration: 0, overtime: false };
    }
    const duration = (ev.duration || 0) + (pb.addedTime || 0);
    let elapsed = pb.elapsedBeforeStart || 0;
    if (pb.state === "play" && pb.startedAt) {
      elapsed += (Date.now() - pb.startedAt) / 1000;
    }
    const remaining = duration - elapsed;
    return { event: ev, elapsed, remaining, duration, overtime: remaining < 0 };
  }

  function totalRuntime(state) {
    return playableEvents(state)
      .filter((e) => !e.skip)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
  }

  // ---------------- 再生コントロール ----------------

  function load_(state, id) {
    state.playback.loadedId = id;
    state.playback.state = "stop";
    state.playback.startedAt = null;
    state.playback.elapsedBeforeStart = 0;
    state.playback.addedTime = 0;
  }

  function play(state) {
    if (!state.playback.loadedId) {
      const first = nextPlayable(state, null);
      if (!first) return;
      state.playback.loadedId = first.id;
    }
    if (state.playback.state === "play") return;
    state.playback.state = "play";
    state.playback.startedAt = Date.now();
  }

  function pause(state) {
    if (state.playback.state !== "play") return;
    state.playback.elapsedBeforeStart += (Date.now() - state.playback.startedAt) / 1000;
    state.playback.startedAt = null;
    state.playback.state = "pause";
  }

  function stop(state) {
    state.playback.state = "stop";
    state.playback.startedAt = null;
    state.playback.elapsedBeforeStart = 0;
    state.playback.addedTime = 0;
  }

  function loadEvent(state, id) {
    load_(state, id);
  }

  function playEvent(state, id) {
    load_(state, id);
    state.playback.state = "play";
    state.playback.startedAt = Date.now();
  }

  function advance(state) {
    const nxt = nextPlayable(state, state.playback.loadedId);
    if (nxt) playEvent(state, nxt.id);
    else stop(state);
  }

  function addTime(state, deltaSeconds) {
    state.playback.addedTime = (state.playback.addedTime || 0) + deltaSeconds;
  }

  global.RB = global.RB || {};
  global.RB.Timer = {
    formatSeconds,
    formatClock,
    baseTimeToday,
    buildSchedule,
    playableEvents,
    findEvent,
    nextPlayable,
    computeTiming,
    totalRuntime,
    play,
    pause,
    stop,
    loadEvent,
    playEvent,
    advance,
    addTime,
  };
})(window);
