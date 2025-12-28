// src/pages/Game_Lobby.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "../main_page.css";

import { formatUnits } from "ethers";
import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { getAddresses, getRoom, getToken } from "../web3/contracts";
import * as Topics from "../web3/topics";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];
const CHAT_TTL_MS = 2 * 60 * 1000;
const REFRESH_MS = 2000;

// avatars pool
const BODY_MAP = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  import: "default",
});
const ICON_MAP = import.meta.glob("../assets/icons_girls/*.png", {
  eager: true,
  import: "default",
});

const FALLBACK_TOPICS = [
  "NEON GLAM",
  "CYBER FAIRY",
  "FUTURISTIC RUNWAY",
  "Y2K ICON",
  "DARK ELEGANCE",
  "STUDY DATE AT THE LIBRARY",
  "BRUNCH AT THE CITY MALL",
];

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function isZeroAddress(a) {
  return (
    !a ||
    a === "0x0000000000000000000000000000000000000000" ||
    a.toLowerCase?.() === "0x0000000000000000000000000000000000000000"
  );
}

function toNum(x, fallback = 0) {
  try {
    if (x == null) return fallback;
    if (typeof x === "number") return Number.isFinite(x) ? x : fallback;
    if (typeof x === "bigint") {
      const n = Number(x);
      return Number.isFinite(n) ? n : fallback;
    }
    if (typeof x === "string") {
      const n = Number(x);
      return Number.isFinite(n) ? n : fallback;
    }
    if (Array.isArray(x) && x.length === 1) return toNum(x[0], fallback);
    return fallback;
  } catch {
    return fallback;
  }
}

function getTopicTextFromId(topicIdNum) {
  if (typeof Topics.getTopicText === "function") {
    const t = Topics.getTopicText(topicIdNum);
    if (t) return t;
  }

  const arr =
    Topics.TOPICS ||
    Topics.GAME_TOPICS ||
    Topics.topicList ||
    Topics.TOPIC_LIST ||
    null;

  if (Array.isArray(arr) && arr[topicIdNum]) return arr[topicIdNum];

  const map = Topics.TOPIC_MAP || Topics.topicMap || null;
  if (map && map[topicIdNum]) return map[topicIdNum];

  if (FALLBACK_TOPICS[topicIdNum]) return FALLBACK_TOPICS[topicIdNum];
  return topicIdNum >= 0 ? `Topic #${topicIdNum}` : "—";
}

function parseRevertMessage(e) {
  const msg = e?.shortMessage || e?.reason || e?.message || "Transaction failed.";
  return String(msg).replace("execution reverted:", "Reverted:");
}

export default function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [roomTopic, setRoomTopic] = useState("—");
  const [roomHost, setRoomHost] = useState("—");
  const [maxPlayers, setMaxPlayers] = useState(2);

  // IMPORTANT: start as null so we do NOT redirect on initial render
  const [phase, setPhase] = useState(null);
  const [phaseLoaded, setPhaseLoaded] = useState(false);

  const [betHuman, setBetHuman] = useState("—");
  const [betRaw, setBetRaw] = useState(null);

  const [tokenAddr, setTokenAddr] = useState(null);
  const [bankAddr, setBankAddr] = useState(null);

  const [onChainPlayers, setOnChainPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [joinedMe, setJoinedMe] = useState(false);
  const [joinedHost, setJoinedHost] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatByAddr, setChatByAddr] = useState({});

  const avatarRef = useRef(new Map());
  const tokenDecimalsRef = useRef(null);

  const avatarPool = useMemo(() => {
    const bodies = Object.values(BODY_MAP || {});
    const icons = Object.values(ICON_MAP || {});
    return bodies.length ? bodies : icons.length ? icons : [];
  }, []);

  function getAvatar(address, index) {
    const key = address ? address.toLowerCase() : `empty_${index}`;
    if (avatarRef.current.has(key)) return avatarRef.current.get(key);
    const picked = pickRandom(avatarPool);
    avatarRef.current.set(key, picked);
    return picked;
  }

  // wallet (no popup)
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) {
      setStatus("MetaMask not found. Install/enable extension.");
      return;
    }

    let alive = true;

    (async () => {
      try {
        const accs = await eth.request({ method: "eth_accounts" });
        const acc = accs?.[0] ?? null;
        if (!alive) return;
        setAccount(acc);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setStatus("MetaMask error: cannot read accounts.");
      }
    })();

    const onAccountsChanged = (accs) => setAccount(accs?.[0] ?? null);
    const onChainChanged = () => window.location.reload();

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      alive = false;
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  async function handleConnect() {
    try {
      const acc = await connectWallet();
      setAccount(acc);
      setStatus(acc ? "Connected." : "Not connected.");
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Failed to connect MetaMask.");
    }
  }

  // ---- room polling ----
  const loadRoomRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    let stop = false;
    let timer = null;

    async function load() {
      if (inFlightRef.current) return; // prevent overlapping calls
      inFlightRef.current = true;

      try {
        const provider = await getProvider();
        const room = getRoom(roomId, provider);

        const host = await room.host();
        const mp = Math.max(2, toNum(await room.maxPlayers(), 2));
        const ph = toNum(await room.phase(), 0);
        const topicId = toNum(await room.topicId(), -1);
        const bet = await room.betAmount();
        const rawPlayers = await room.getPlayers();

        let detectedToken = null;
        let detectedBank = null;
        try {
          if (typeof room.token === "function") detectedToken = await room.token();
        } catch {}
        try {
          if (typeof room.bank === "function") detectedBank = await room.bank();
        } catch {}

        const chainPlayers = Array.isArray(rawPlayers)
          ? rawPlayers.filter((a) => !isZeroAddress(a))
          : [];

        let meJoined = false;
        let hostJoined = false;
        try {
          if (account && typeof room.joined === "function") {
            meJoined = await room.joined(account);
          }
        } catch {}
        try {
          if (host && !isZeroAddress(host) && typeof room.joined === "function") {
            hostJoined = await room.joined(host);
          }
        } catch {}

        if (stop) return;

        setRoomHost(host && !isZeroAddress(host) ? host : "—");
        setMaxPlayers(mp);
        setPhase(ph);
        setPhaseLoaded(true);

        setBetRaw(bet);
        setOnChainPlayers(chainPlayers);
        setJoinedMe(!!meJoined);
        setJoinedHost(!!hostJoined);

        if (detectedToken && !isZeroAddress(detectedToken)) setTokenAddr(detectedToken);
        if (detectedBank && !isZeroAddress(detectedBank)) setBankAddr(detectedBank);

        setRoomTopic(getTopicTextFromId(topicId));

        try {
          let decimals = tokenDecimalsRef.current;
          if (decimals == null) {
            const { token } = getAddresses();
            const tokenToUse =
              detectedToken && !isZeroAddress(detectedToken) ? detectedToken : token;
            if (tokenToUse) {
              const t = getToken(tokenToUse, provider);
              decimals = toNum(await t.decimals(), 18);
            } else {
              decimals = 18;
            }
            tokenDecimalsRef.current = decimals;
          }
          setBetHuman(formatUnits(bet, decimals));
        } catch {
          setBetHuman(String(bet));
        }

        // Build UI slots
        const normalized = [];
        if (host && !isZeroAddress(host)) normalized.push(host);
        for (const a of chainPlayers) {
          if (normalized.some((x) => x.toLowerCase() === a.toLowerCase())) continue;
          normalized.push(a);
        }

        const slots = new Array(mp).fill(null).map((_, i) => {
          const addr = normalized[i] ?? null;
          const filled = !!addr;
          const role =
            filled && host && addr.toLowerCase() === host.toLowerCase()
              ? "HOST"
              : filled
              ? "PLAYER"
              : "EMPTY";
          return { address: filled ? addr : null, role };
        });

        setPlayers(slots);

        setStatus((s) => (s.startsWith("Failed to load room state") ? "" : s));
      } catch (e) {
        console.error(e);
        if (!stop) setStatus("Failed to load room state (check ABI / address / network).");
        // IMPORTANT: do NOT set phase to 0 on error; keep last known value and phaseLoaded state
      } finally {
        inFlightRef.current = false;
      }
    }

    loadRoomRef.current = load;
    load();
    timer = setInterval(load, REFRESH_MS);

    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [roomId, account]);

  // ✅ phase routing (GUARDED — no jumping)
  useEffect(() => {
    if (!roomId) return;
    if (!phaseLoaded) return;
    if (typeof phase !== "number") return;

    const path = location.pathname;

    if (phase === 1 && !path.startsWith(`/active/`)) {
      navigate(`/active/${roomId}`, { replace: true });
    } else if (phase === 2 && !path.startsWith(`/voting/`)) {
      navigate(`/voting/${roomId}`, { replace: true });
    } else if (phase === 3 && !path.startsWith(`/result/`)) {
      navigate(`/result/${roomId}`, { replace: true });
    }
  }, [phase, phaseLoaded, roomId, navigate, location.pathname]);

  // ---- chat (localStorage room scoped) ----
  const CHAT_KEY = useMemo(() => (roomId ? `dc_chat_${roomId}` : null), [roomId]);

  function loadChatMap() {
    if (!CHAT_KEY) return {};
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const now = Date.now();

      const map = {};
      for (const m of arr) {
        if (!m?.from || !m?.text) continue;
        if (m.until && m.until <= now) continue;
        map[String(m.from).toLowerCase()] = { text: m.text, until: m.until };
      }
      return map;
    } catch {
      return {};
    }
  }

  useEffect(() => {
    if (!CHAT_KEY) return;
    setChatByAddr(loadChatMap());

    const onStorage = (e) => {
      if (e.key === CHAT_KEY) setChatByAddr(loadChatMap());
    };
    window.addEventListener("storage", onStorage);

    const t = setInterval(() => {
      setChatByAddr((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k]?.until && next[k].until <= now) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [CHAT_KEY]);

  function saveChatMessage(from, text) {
    if (!CHAT_KEY) return;
    const now = Date.now();
    const msg = { from, text, until: now + CHAT_TTL_MS, ts: now };

    try {
      const raw = localStorage.getItem(CHAT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const cleaned = (Array.isArray(arr) ? arr : []).filter((m) => m?.until > now);
      cleaned.push(msg);
      localStorage.setItem(CHAT_KEY, JSON.stringify(cleaned.slice(-200)));
    } catch {}

    setChatByAddr((prev) => ({
      ...prev,
      [String(from).toLowerCase()]: { text, until: msg.until },
    }));
  }

  function sendChat() {
    if (!account) return setStatus("Connect wallet first.");
    const text = chatInput.trim();
    if (!text) return;
    saveChatMessage(account, text);
    setChatInput("");
  }

  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

  const onChainCount = onChainPlayers.length;

  const isHost = useMemo(() => {
    if (!account || !roomHost || roomHost === "—") return false;
    return account.toLowerCase() === roomHost.toLowerCase();
  }, [account, roomHost]);

  function handleCopyRoomAddress() {
    const text = roomId || "";
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setStatus("Room address copied.");
    } else {
      setStatus("Clipboard not available.");
    }
  }

  async function handleJoinGame() {
    if (!roomId) return setStatus("Room address missing.");
    if (!account) return setStatus("Connect wallet first.");

    try {
      setStatus("Joining… confirm in MetaMask.");

      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      let bank = bankAddr;
      try {
        if (!bank && typeof room.bank === "function") bank = await room.bank();
      } catch {}
      if (!bank || isZeroAddress(bank)) {
        return setStatus(
          "Cannot detect BANK address. Add `function bank() view returns (address)` to ABI or expose it in your ABI."
        );
      }

      const { token: tokenEnv } = getAddresses();
      let tokenToUse = tokenAddr || tokenEnv;
      try {
        if ((!tokenToUse || isZeroAddress(tokenToUse)) && typeof room.token === "function") {
          tokenToUse = await room.token();
        }
      } catch {}
      if (!tokenToUse || isZeroAddress(tokenToUse)) {
        return setStatus("Cannot detect token address for approvals.");
      }

      const t = getToken(tokenToUse, signer);
      const bet = betRaw ?? (await room.betAmount());

      if (typeof t.allowance === "function" && typeof t.approve === "function") {
        const allowance = await t.allowance(account, bank);
        if (allowance < bet) {
          setStatus("Approving DCT for bank… confirm in MetaMask.");
          const txA = await t.approve(bank, bet);
          await txA.wait();
        }
      }

      const tx = await room.joinGame();
      await tx.wait();

      setStatus("Joined ✅");
      await loadRoomRef.current?.();
    } catch (e) {
      console.error(e);
      setStatus(parseRevertMessage(e));
    }
  }

  async function handleStartGame() {
    if (!account) return setStatus("Connect wallet first.");
    if (!isHost) return setStatus("Only host can start.");
    if (!roomId) return setStatus("Room address missing.");

    try {
      setStatus("Checking start conditions…");

      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      // preflight for readable revert (if provider supports it)
      try {
        if (typeof room.startGame?.staticCall === "function") {
          await room.startGame.staticCall();
        }
      } catch (e) {
        setStatus(parseRevertMessage(e));
        return;
      }

      setStatus("Starting… confirm in MetaMask.");
      const tx = await room.startGame();
      await tx.wait();

      setStatus("Game started ✅ (waiting phase update)");
      await loadRoomRef.current?.();
    } catch (e) {
      console.error(e);
      setStatus(parseRevertMessage(e));
    }
  }

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      <header className="start-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>

        <div className="wallet-pill">
          {account ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="wallet-label">WALLET</span>
                <span className="wallet-address">{shortenAddress(account)}</span>
              </div>
              <span className="lobby-dot ok" />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="wallet-disconnected">Not connected</span>
              <button className="btn small" onClick={handleConnect}>
                Connect
              </button>
              <span className="lobby-dot" />
            </div>
          )}
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-body">
          <section className="lobby-left">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <button className="btn outline small" onClick={() => navigate("/")}>
                ← Back
              </button>

              <div className="lobby-chatbar">
                <input
                  className="lobby-chat-input"
                  placeholder="Write a message (visible for 2 minutes)…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={onChatKeyDown}
                />
                <button className="btn small lobby-chat-send" onClick={sendChat}>
                  Send
                </button>
              </div>
            </div>

            <div className="lobby-meta">
              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">GAME ROOM</div>
                <div className="lobby-pillvalue" style={{ gap: 10 }}>
                  <span>{roomId ? shortenAddress(roomId) : "—"}</span>
                  <button className="btn small copy" onClick={handleCopyRoomAddress}>
                    COPY
                  </button>
                </div>
                <div className="lobby-pillhint">
                  Host: {roomHost === "—" ? "—" : shortenAddress(roomHost)}
                  {roomHost !== "—" && (
                    <span style={{ marginLeft: 8, opacity: 0.8 }}>
                      {joinedHost ? "(joined)" : "(NOT joined)"}
                    </span>
                  )}
                </div>
              </div>

              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">GAME TOPIC</div>
                <div className="lobby-pillvalue">{roomTopic}</div>
              </div>

              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">NUMBER OF PLAYERS</div>
                <div className="lobby-pillvalue">
                  {onChainCount} / {maxPlayers}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.9 }}>
              <div style={{ fontSize: 12 }}>
                <strong>Bet:</strong> {betHuman} DCT
              </div>
              <div style={{ fontSize: 12 }}>
                <strong>Phase:</strong>{" "}
                {phaseLoaded && typeof phase === "number" ? (PHASE[phase] ?? String(phase)) : "Loading…"}
              </div>
            </div>

            <div className="lobby-players" style={{ marginTop: 16 }}>
              {players.map((p, idx) => {
                const filled = !!p.address;
                const you =
                  account && p.address && p.address.toLowerCase() === account.toLowerCase();

                const badge = p.role === "HOST" ? "HOST" : filled ? "PLAYER" : "EMPTY";
                const displayName = filled ? (you ? "You" : shortenAddress(p.address)) : "Waiting…";

                const chat = filled ? chatByAddr[p.address.toLowerCase()] : null;
                const showChat = !!chat?.text && chat.until > Date.now();

                const avatarSrc = filled ? getAvatar(p.address, idx) : null;

                return (
                  <div
                    key={idx}
                    className={`avatar-card ${filled ? "filled" : ""}`}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      minHeight: 340,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingTop: 18,
                    }}
                  >
                    {showChat && (
                      <div
                        className="chat-bubble"
                        style={{
                          position: "absolute",
                          top: 10,
                          left: "50%",
                          transform: "translateX(-50%)",
                          maxWidth: "85%",
                          zIndex: 3,
                        }}
                        title="Disappears in 2 minutes"
                      >
                        {chat.text}
                      </div>
                    )}

                    <div
                      style={{
                        width: "100%",
                        height: 250,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 8px",
                      }}
                    >
                      {filled && avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={`player-${idx}`}
                          style={{
                            width: "170px",
                            height: "250px",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          className="avatar-placeholder"
                          style={{ width: 170, height: 250, borderRadius: 18 }}
                        />
                      )}
                    </div>

                    <div className="bubble" style={{ width: "100%" }}>
                      <div className="bubble-title">
                        {badge}
                        {you ? " • YOU" : ""}
                      </div>
                      <div className="bubble-text">{displayName}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lobby-actions" style={{ gap: 10 }}>
              {account && phaseLoaded && phase === 0 && !joinedMe && (
                <button className="btn outline" onClick={handleJoinGame}>
                  JOIN GAME
                </button>
              )}

              {isHost && (
                <button className="btn primary" onClick={handleStartGame} disabled={!phaseLoaded}>
                  START GAME
                </button>
              )}

              {!isHost && account && joinedMe && (
                <div className="lobby-note">Waiting for host to start…</div>
              )}
            </div>

            {status && <div className="status-bar">{status}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
