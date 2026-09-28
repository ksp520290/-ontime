/* ===========================================================
   sync.js
   リアルタイム同期レイヤー。

   ・ネイティブ WebSocket / SSE サーバーは、静的ファイル一式
     （サーバープロセスを起動しない配布物）には同梱できないため、
     このパッケージ単体では実現できません。
   ・そのため既定では同一ブラウザ内の複数タブ／ウィンドウを
     BroadcastChannel で"ほぼ遅延ゼロ"で同期します（同一PCで
     オペレーター画面と客席タイマーを別ウィンドウで開く運用を想定）。
   ・異なる端末間で同期したい場合は、Firebase Realtime Database
     （サーバーレスの常時接続DB）を設定すると、追加の同期が
     有効になります。遅延は通常1秒未満〜数秒程度です。
   =========================================================== */

(function (global) {
  const Store = global.RB.Store;
  const CHANNEL_NAME = "runtimeboard_sync_v2";
  const ROOM_KEY = "runtimeboard_room";
  const FB_CONFIG_KEY = "runtimeboard_firebase_config";

  const clientId = Math.random().toString(36).slice(2, 10);
  let applyingRemote = false;
  let bc = null;
  let fbRef = null;
  let fbStatus = "off"; // 'off' | 'connecting' | 'connected' | 'error'
  const statusListeners = new Set();

  function setStatus(s) {
    fbStatus = s;
    statusListeners.forEach((fn) => {
      try {
        fn(getStatus());
      } catch (e) {}
    });
  }

  function getStatus() {
    return {
      firebase: fbStatus,
      broadcastChannel: !!bc,
      room: getRoomId(),
      clientId,
    };
  }

  function getRoomId() {
    return localStorage.getItem(ROOM_KEY) || "";
  }
  function setRoomId(id) {
    localStorage.setItem(ROOM_KEY, id || "");
  }

  function getFirebaseConfig() {
    try {
      const raw = localStorage.getItem(FB_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function setFirebaseConfig(cfgObj) {
    if (!cfgObj) {
      localStorage.removeItem(FB_CONFIG_KEY);
    } else {
      localStorage.setItem(FB_CONFIG_KEY, JSON.stringify(cfgObj));
    }
  }

  // ---------------- BroadcastChannel（同一ブラウザ内、遅延ほぼ0） ----------------

  function initBroadcastChannel() {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.origin === clientId) return;
        applyingRemote = true;
        Store.applyRemote(msg.state);
        applyingRemote = false;
      };
    } catch (e) {
      bc = null;
    }
  }

  function broadcastLocal(state) {
    if (!bc) return;
    try {
      bc.postMessage({ origin: clientId, state });
    } catch (e) {}
  }

  // ---------------- Firebase Realtime Database（端末間同期、遅延 数秒以内目安） ----------------

  function loadFirebaseSdk(cb) {
    if (global.firebase && global.firebase.database) return cb();
    let pending = 2;
    function done() {
      pending -= 1;
      if (pending === 0) cb();
    }
    const s1 = document.createElement("script");
    s1.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
    s1.onload = done;
    s1.onerror = () => setStatus("error");
    document.head.appendChild(s1);

    const s2 = document.createElement("script");
    s2.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
    s2.onload = done;
    s2.onerror = () => setStatus("error");
    document.head.appendChild(s2);
  }

  function connectFirebase() {
    const cfg = getFirebaseConfig();
    const room = getRoomId();
    if (!cfg || !room) {
      setStatus("off");
      return;
    }
    setStatus("connecting");
    loadFirebaseSdk(() => {
      try {
        if (!global.firebase.apps || !global.firebase.apps.length) {
          global.firebase.initializeApp(cfg);
        }
        const db = global.firebase.database();
        fbRef = db.ref("runtimeboard/" + room);
        fbRef.on(
          "value",
          (snap) => {
            const val = snap.val();
            setStatus("connected");
            if (!val || !val.state) return;
            if (val.origin === clientId) return;
            applyingRemote = true;
            Store.applyRemote(val.state);
            applyingRemote = false;
          },
          (err) => {
            console.error("firebase sync error", err);
            setStatus("error");
          }
        );
      } catch (e) {
        console.error("firebase init failed", e);
        setStatus("error");
      }
    });
  }

  function disconnectFirebase() {
    if (fbRef) {
      try {
        fbRef.off();
      } catch (e) {}
      fbRef = null;
    }
    setStatus("off");
  }

  function pushToFirebase(state) {
    if (!fbRef) return;
    try {
      fbRef.set({ origin: clientId, ts: Date.now(), state });
    } catch (e) {
      /* ignore transient errors */
    }
  }

  // ---------------- 配線 ----------------

  Store.subscribe((state) => {
    if (applyingRemote) return;
    broadcastLocal(state);
    pushToFirebase(state);
  });

  initBroadcastChannel();
  if (getFirebaseConfig() && getRoomId()) connectFirebase();

  global.RB = global.RB || {};
  global.RB.Sync = {
    getStatus,
    onStatusChange(fn) {
      statusListeners.add(fn);
      fn(getStatus());
      return () => statusListeners.delete(fn);
    },
    getRoomId,
    setRoomId,
    getFirebaseConfig,
    setFirebaseConfig,
    connect() {
      connectFirebase();
    },
    disconnect() {
      disconnectFirebase();
    },
  };
})(window);
