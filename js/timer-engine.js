/* ===========================================================
   timer-engine.js
   再生状態から経過・残り時間を計算し、進行表のスケジュール、
   キュー番号、押し／巻き（showOffset）を組み立てる。
   =========================================================== */

(function (global) {
  const Store = global.RB.Store;

  function pad(n) {
    return String(Math.floor(n)).padStart(2, "0");
  }

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

  /** 押し／巻きの表示用フォーマット。+は押し、-は巻き。 */
  function formatOffset(totalSeconds) {
    const s = Math.round(totalSeconds);
    const abs = Math.abs(s);
    const m = Math.floor(abs / 60);
    const sec = abs % 60;
    const txt = (m > 0 ? `${m}分` : "") + `${sec}秒`;
    if (Math.abs(s) < 1) return { label: "定刻どおり", cls: "flat", text: "±0" };
    if (s > 0) return { label: `${txt} 押しています`, cls: "behind", text: "+" + txt };
    return { label: `${txt} 巻いています`, cls: "ahead", text: "-" + txt };
  }

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

  /** キュー番号は type==='event' のみに連番で振る。mc / block は対象外。 */
  function buildCueNumbers(state) {
    const map = new Map();
    let n = 0;
    for (const e of state.events) {
      if (e.type === "event") {
        n += 1;
        map.set(e.id, n);
      }
    }
    return map;
  }

  function cueLabel(state, ev, cueMap) {
    if (ev.type === "event") return String((cueMap || buildCueNumbers(state)).get(ev.id) || "");
    if (ev.type === "mc") return "-";
    return "";
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

  /** 押し/巻きは「次へ」を押した時点の（経過時間 − 所要時間）だけを累積する。ライブ分は含めない。 */
  function liveContribution() {
    return 0;
  }

  /** ショー全体の現在の押し/巻き（「次へ」で確定した累積分） */
  function currentShowOffset(state) {
    return state.playback.showOffset || 0;
  }

  /** 「次へ」押下時：経過 − 所要時間（＋/−調整込み）を累積。+超過(押し) / -巻き */
  function finalizeOffset(state) {
    const t = computeTiming(state);
    if (!t.event || state.playback.state === "stop") return;
    state.playback.showOffset = (state.playback.showOffset || 0) + (t.elapsed - t.duration);
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
    finalizeOffset(state);
    const nxt = nextPlayable(state, state.playback.loadedId);
    if (nxt) {
      load_(state, nxt.id);
      state.playback.state = "play";
      state.playback.startedAt = Date.now();
    } else {
      state.playback.state = "stop";
      state.playback.startedAt = null;
      state.playback.elapsedBeforeStart = 0;
      state.playback.addedTime = 0;
    }
  }

  function addTime(state, deltaSeconds) {
    state.playback.addedTime = (state.playback.addedTime || 0) + deltaSeconds;
  }

  global.RB = global.RB || {};
  global.RB.Timer = {
    formatSeconds,
    formatOffset,
    formatClock,
    baseTimeToday,
    buildSchedule,
    buildCueNumbers,
    cueLabel,
    playableEvents,
    findEvent,
    nextPlayable,
    computeTiming,
    totalRuntime,
    currentShowOffset,
    play,
    pause,
    stop,
    loadEvent,
    playEvent,
    advance,
    addTime,
  };
})(window);
