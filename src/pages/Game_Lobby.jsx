// src/pages/Game_Lobby.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import girl1 from "../assets/icons_girls/girl1.png";
import girl2 from "../assets/icons_girls/girl2.png";
import girl3 from "../assets/icons_girls/girl3.png";
import girl4 from "../assets/icons_girls/girl4.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

const GAME_TOPICS = [
  "NEON GLAM",
  "CYBER FAIRY",
  "FUTURISTIC RUNWAY",
  "Y2K ICON",
  "DARK ELEGANCE",
];

function getRandomTopic() {
  return GAME_TOPICS[Math.floor(Math.random() * GAME_TOPICS.length)];
}

const TOKENS_PER_ETH = 100;
const CHAT_TTL_MS = 5 * 1000;
const DEV_ALLOW_SOLO_START = true;

// mock balance
async function fetchTokenBalance(_address) {
  return Math.floor(Math.random() * 1000);
}

const AVATARS = [girl1, girl2, girl3, girl4];

function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

function buildPlayers(hostAddr, maxPlayers) {
  const mp = Math.max(2, Number(maxPlayers) || 4);
  const arr = [
    { address: hostAddr || "HOST", role: "HOST", chatText: "", chatUntil: 0 },
  ];
  while (arr.length < mp) {
    arr.push({ address: null, role: "EMPTY", chatText: "", chatUntil: 0 });
  }
  return arr.slice(0, mp);
}

export default function GameLobby() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [ethInput, setEthInput] = useState("");
  const [chatInput, setChatInput] = useState("");

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [topic, setTopic] = useState("—");
  const [players, setPlayers] = useState(() => buildPlayers("HOST", 4));

  const [status, setStatus] = useState("");

  // 1) Load room meta by URL roomId
  useEffect(() => {
    if (!roomId) return;

    const raw = localStorage.getItem(`dc_room_${roomId}`);
    if (raw) {
      try {
        const meta = JSON.parse(raw);
        const t = meta?.topic || getRandomTopic();
        const host = meta?.host || "HOST";
        const mp = Number(meta?.maxPlayers) || 4;

        setTopic(t);
        setMaxPlayers(mp);
        setPlayers(buildPlayers(host, mp));
      } catch {
        setTopic(getRandomTopic());
        setMaxPlayers(4);
        setPlayers(buildPlayers("HOST", 4));
      }
    } else {
      // joining a room that isn't stored in this browser
      setTopic(getRandomTopic());
      setMaxPlayers(4);
      setPlayers(buildPlayers("HOST", 4));
    }
  }, [roomId]);

  // 2) Wallet auto-detect (no popup). If not connected -> go back to start
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) {
      setStatus("MetaMask не найден. Установи MetaMask.");
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        const acc = accounts?.[0] ?? null;

        if (!mounted) return;

        if (!acc) {
          setStatus("Кошелёк не подключён. Подключи на стартовой странице.");
          navigate("/", { replace: true });
          return;
        }

        setAccount(acc);
      } catch (e) {
        console.error("wallet init error:", e);
        setStatus("Ошибка MetaMask. Вернись на стартовую страницу.");
        navigate("/", { replace: true });
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      const acc = accs?.[0] ?? null;
      setAccount(acc);
      if (!acc) navigate("/", { replace: true });
    };

    const onChainChanged = () => window.location.reload();

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      mounted = false;
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [navigate]);

  // 3) When account appears -> auto occupy slot and load balance
  useEffect(() => {
    if (!account) return;

    (async () => {
      try {
        const b = await fetchTokenBalance(account);
        setTokenBalance(b);
      } catch {
        setTokenBalance(0);
      }
    })();

    setPlayers((prev) => {
      const next = [...prev];

      // already inside?
      const exists = next.some(
        (p) => p.address && p.address.toLowerCase?.() === account.toLowerCase()
      );
      if (exists) return prev;

      // if host placeholder -> make this wallet host and persist
      if (next[0]?.address === "HOST") {
        next[0] = { ...next[0], address: account, role: "HOST" };

        try {
          const key = `dc_room_${roomId}`;
          const raw = localStorage.getItem(key);
          const meta = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            key,
            JSON.stringify({
              ...meta,
              roomId,
              host: account,
              topic: meta.topic || topic || getRandomTopic(),
              maxPlayers: meta.maxPlayers || maxPlayers || 4,
              createdAt: meta.createdAt || Date.now(),
            })
          );
        } catch {}

        return next;
      }

      // else: take first empty slot
      const idx = next.findIndex((p) => !p.address);
      if (idx !== -1) {
        next[idx] = { ...next[idx], address: account, role: "PLAYER" };
        return next;
      }

      setStatus("Комната заполнена.");
      return prev;
    });
  }, [account, roomId, topic, maxPlayers]);

  // chat TTL cleanup
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setPlayers((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          if (!p.address) return p;
          if (p.chatUntil && p.chatUntil <= now && p.chatText) {
            changed = true;
            return { ...p, chatText: "", chatUntil: 0 };
          }
          return p;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const filledCount = useMemo(
    () => players.filter((p) => !!p.address).length,
    [players]
  );

  const hostAddress = useMemo(() => players?.[0]?.address || "—", [players]);

  const isHost = useMemo(() => {
    if (!account) return false;
    const h = players?.[0]?.address;
    if (!h) return false;
    if (h === "HOST") return true;
    return account.toLowerCase() === h.toLowerCase();
  }, [account, players]);

  const myIndex = useMemo(() => {
    if (!account) return -1;
    return players.findIndex(
      (p) => p.address && p.address.toLowerCase?.() === account.toLowerCase()
    );
  }, [account, players]);

  async function handleBuyTokens() {
    if (!account) return;

    const eth = Number(String(ethInput).replace(",", "."));
    if (!Number.isFinite(eth) || eth <= 0) {
      setStatus("Введи количество ETH больше 0.");
      return;
    }

    const bought = eth * TOKENS_PER_ETH;
    setTokenBalance((prev) => prev + bought);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)} (мок)`);
    setEthInput("");
  }

  function sendChat() {
    if (!account) return;
    if (myIndex === -1) return setStatus("Сначала займи слот в лобби.");

    const text = chatInput.trim();
    if (!text) return;

    const until = Date.now() + CHAT_TTL_MS;

    setPlayers((prev) => {
      const next = [...prev];
      const p = next[myIndex];
      next[myIndex] = { ...p, chatText: text, chatUntil: until };
      return next;
    });

    setChatInput("");
  }

  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

  function handleStartGame() {
    if (!roomId) return setStatus("Room ID отсутствует.");
    if (!account) return; // should not happen because redirect
    if (!isHost) return setStatus("Стартовать игру может только host.");
  
    // ✅ Only block if dev mode is OFF
    if (!DEV_ALLOW_SOLO_START && filledCount < 2) {
      return setStatus("Нужно минимум 2 игрока, чтобы начать.");
    }
  
    // ✅ Link Lobby -> Active
    navigate(`/active/${roomId}`);
  }
  

  function handleCopyRoomId() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomId || "");
      setStatus("ID комнаты скопирован.");
    } else {
      setStatus("Не удалось скопировать ID.");
    }
  }

  async function handleRefreshBalance() {
    if (!account) return;
    try {
      const b = await fetchTokenBalance(account);
      setTokenBalance(b);
      setStatus("Баланс обновлен");
    } catch {
      setStatus("Не удалось обновить баланс");
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
          <div className="wallet-balance">
            <span className="wallet-label">Balance</span>
            <span className="wallet-balance-value">{tokenBalance} tokens</span>
          </div>

          <span className="wallet-sep" />

          {account ? (
            <>
              <span className="wallet-label">Кошелек</span>
              <span className="wallet-address">{shortenAddress(account)}</span>
              <span className="lobby-dot ok" />
            </>
          ) : (
            <>
              <span className="wallet-disconnected">Не подключен</span>
              <span className="lobby-dot" />
            </>
          )}
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-body">
          <section className="lobby-left">
            {/* top row: back + chat + balance tools (no connect/test buttons) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <button className="btn outline small" onClick={() => navigate("/")}>
                ← Back
              </button>

              <div className="lobby-chatbar">
                <input
                  className="lobby-chat-input"
                  placeholder="Напиши сообщение игрокам (будет видно 2 минуты)..."
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
                <div className="lobby-pilllabel">GAME ROOM ID</div>
                <div className="lobby-pillvalue">
                  <span>{roomId}</span>
                  <button className="btn small copy" onClick={handleCopyRoomId}>
                    COPY
                  </button>
                </div>
                <div className="lobby-pillhint">
                  Host: {hostAddress === "HOST" ? "—" : shortenAddress(hostAddress)}
                </div>
              </div>

              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">GAME TOPIC</div>
                <div className="lobby-pillvalue">{topic}</div>
              </div>

              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">NUMBER OF PLAYERS</div>
                <div className="lobby-pillvalue">
                  {filledCount} / {maxPlayers}
                </div>
              </div>
            </div>

            <div className="lobby-players">
              {players.map((p, idx) => {
                const filled = !!p.address;
                const you =
                  account &&
                  p.address &&
                  p.address !== "HOST" &&
                  p.address.toLowerCase() === account.toLowerCase();

                const badge = idx === 0 && filled ? "HOST" : filled ? "PLAYER" : "EMPTY";
                const text =
                  p.address === "HOST"
                    ? "Waiting host wallet..."
                    : filled
                    ? shortenAddress(p.address)
                    : "Waiting...";

                const showChat = filled && p.chatText && p.chatUntil > Date.now();
                const avatar = AVATARS[idx] || girl1;

                return (
                  <div key={idx} className={`avatar-card ${filled ? "filled" : ""}`}>
                    {showChat && (
                      <div className="chat-bubble" title="Message disappears in 2 minutes">
                        {p.chatText}
                      </div>
                    )}

                    {filled ? (
                      <img src={avatar} alt={`player ${idx + 1}`} className="avatar-img" />
                    ) : (
                      <div className="avatar-placeholder" />
                    )}

                    <div className="bubble">
                      <div className="bubble-title">
                        {badge}
                        {you ? " • YOU" : ""}
                      </div>
                      <div className="bubble-text">{text}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lobby-actions">
            <button
              className={`btn ${isHost ? "primary" : "outline"}`}
              onClick={handleStartGame}
              disabled={!isHost || (!DEV_ALLOW_SOLO_START && filledCount < 2)}
              title={
                !isHost
                  ? "Только host может начать"
                  : (!DEV_ALLOW_SOLO_START && filledCount < 2)
                  ? "Нужно минимум 2 игрока"
                  : DEV_ALLOW_SOLO_START
                  ? "DEV: можно стартовать одному"
                  : ""
              }
            >
              START GAME
            </button>

              {account && !isHost && (
                <div className="lobby-note">Ты в лобби как игрок — жди, пока host нажмёт START.</div>
              )}

              {filledCount < 2 && account && (
                <div className="lobby-note" style={{ color: "#ff6b6b" }}>
                  Ожидание игроков... Нужно минимум 2 игрока для старта
                </div>
              )}
            </div>

            {status && <div className="status-bar">{status}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}