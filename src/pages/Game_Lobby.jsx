// src/pages/Game_Lobby.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";
import girlAvatar from "../assets/characters/Body_1.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

const GAME_TOPICS = ["NEON GLAM", "CYBER FAIRY", "FUTURISTIC RUNWAY", "Y2K ICON", "DARK ELEGANCE"];
function getRandomTopic() {
  return GAME_TOPICS[Math.floor(Math.random() * GAME_TOPICS.length)];
}

function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  return eth;
}

export default function GameLobby() {
  const navigate = useNavigate();
  const { roomId } = useParams(); // ✅ /lobby/:roomId

  const [account, setAccount] = useState(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [topic, setTopic] = useState("—");

  const [players, setPlayers] = useState([
    { address: "HOST", role: "HOST" },
    { address: null, role: "EMPTY" },
    { address: null, role: "EMPTY" },
    { address: null, role: "EMPTY" },
  ]);

  const [status, setStatus] = useState("");

  // Load room meta (mock) from localStorage by roomId
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

        const emptySlots = Array.from({ length: Math.max(0, mp - 1) }, () => ({
          address: null,
          role: "EMPTY",
        }));

        setPlayers([{ address: host, role: "HOST" }, ...emptySlots].slice(0, mp));
      } catch {
        setTopic(getRandomTopic());
      }
    } else {
      // no meta in this browser -> still show lobby with random topic
      setTopic(getRandomTopic());
      setMaxPlayers(4);
      setPlayers([
        { address: "HOST", role: "HOST" },
        { address: null, role: "EMPTY" },
        { address: null, role: "EMPTY" },
        { address: null, role: "EMPTY" },
      ]);
    }
  }, [roomId]);

  // Auto-check wallet (no popup)
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    let mounted = true;

    async function init() {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        if (!mounted) return;
        setAccount(accounts?.[0] ?? null);
      } catch (e) {
        console.error(e);
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      setAccount(accs?.[0] ?? null);
      setStatus(accs?.[0] ? "Аккаунт изменён." : "Кошелёк отключён.");
    };

    eth.on?.("accountsChanged", onAccountsChanged);

    return () => {
      mounted = false;
      eth.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  const filledCount = useMemo(() => players.filter((p) => !!p.address).length, [players]);
  const hostAddress = useMemo(() => players?.[0]?.address || "—", [players]);

  const isHost = useMemo(() => {
    if (!account) return false;
    if (!hostAddress) return false;
    if (hostAddress === "HOST") return true; // placeholder until a real host connects
    return account.toLowerCase() === hostAddress.toLowerCase();
  }, [account, hostAddress]);

  async function connectWallet() {
    const eth = getEthereum();
    if (!eth) {
      setStatus("MetaMask не найден. Установи расширение MetaMask.");
      return;
    }

    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const acc = accounts?.[0] ?? null;
      if (!acc) return;

      setAccount(acc);
      setStatus("Кошелек подключен.");

      setPlayers((prev) => {
        const next = [...prev];

        // If host is placeholder -> host becomes this acc (and persist)
        if (next[0]?.address === "HOST") {
          next[0] = { address: acc, role: "HOST" };
          try {
            const raw = localStorage.getItem(`dc_room_${roomId}`);
            const meta = raw ? JSON.parse(raw) : {};
            meta.roomId = roomId;
            meta.host = acc;
            meta.topic = meta.topic || topic;
            meta.maxPlayers = meta.maxPlayers || maxPlayers;
            localStorage.setItem(`dc_room_${roomId}`, JSON.stringify(meta));
          } catch {}
          return next;
        }

        // Already in lobby?
        const exists = next.some((p) => p.address && p.address.toLowerCase?.() === acc.toLowerCase());
        if (exists) return next;

        // Take first empty slot
        const idx = next.findIndex((p) => !p.address);
        if (idx !== -1) next[idx] = { address: acc, role: "PLAYER" };
        else setStatus("Комната заполнена.");
        return next;
      });
    } catch (err) {
      console.error(err);
      if (err?.code === 4001) setStatus("Подключение отменено пользователем.");
      else setStatus("Ошибка подключения кошелька.");
    }
  }

  function handleStartGame() {
    if (!account) return setStatus("Сначала подключи кошелек.");
    if (!isHost) return setStatus("Стартовать игру может только host.");
    // if (filledCount < 2) return setStatus("Нужно минимум 2 игрока, чтобы начать."); UNCOMMENT THIS FOR MULTIPLAYER

    // ✅ go to active page
    navigate(`/active/${roomId}`);
  }

  function handleCopyRoomId() {
    navigator.clipboard?.writeText(roomId || "");
    setStatus("ID комнаты скопирован.");
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button className="btn outline small" onClick={() => navigate("/")}>
                ← Back
              </button>

              <button className="btn outline small" onClick={connectWallet}>
                {account ? "Кошелек подключен" : "Подключить кошелек"}
              </button>
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

            <div className="lobby-players" style={{ gridTemplateColumns: `repeat(${Math.min(4, maxPlayers)}, minmax(0, 1fr))` }}>
              {players.map((p, idx) => {
                const filled = !!p.address;
                const you =
                  account &&
                  p.address &&
                  p.address !== "HOST" &&
                  p.address.toLowerCase?.() === account.toLowerCase();

                const badge = idx === 0 && filled ? "HOST" : filled ? "PLAYER" : "EMPTY";

                const text =
                  p.address === "HOST"
                    ? "Waiting host wallet..."
                    : filled
                    ? shortenAddress(p.address)
                    : "Waiting...";

                return (
                  <div key={idx} className={`avatar-card ${filled ? "filled" : ""}`}>
                    {filled ? <img src={girlAvatar} alt="player" className="avatar-img" /> : <div className="avatar-placeholder" />}

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
                disabled={!isHost}
                title={!isHost ? "Только host может начать" : ""}
              >
                START GAME
              </button>

              {!account && <div className="lobby-note">Сначала подключи кошелек, чтобы занять слот.</div>}
              {account && !isHost && <div className="lobby-note">Ты в лобби как игрок — жди, пока host нажмёт START.</div>}
            </div>

            {status && <div className="status-bar">{status}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
