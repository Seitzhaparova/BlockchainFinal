// src/pages/Game_Lobby.jsx
import React, { useMemo, useState } from "react";
import "../main_page.css";
import girlAvatar from "../assets/girl.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// Темы (пока локально, позже можно получать из контракта)
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

export default function GameLobby() {
  const [account, setAccount] = useState(null);

  // Мок-данные комнаты
  const [roomId] = useState("482913");
  const [maxPlayers] = useState(4);

  // Тема — рандом (позже фиксировать на createGame)
  const [topic] = useState(getRandomTopic());

  // Дефолт: хост уже в лобби (как после CREATE GAME)
  const [players, setPlayers] = useState([
    { address: "HOST", role: "HOST" },
    { address: null, role: "EMPTY" },
    { address: null, role: "EMPTY" },
    { address: null, role: "EMPTY" },
  ]);

  const [status, setStatus] = useState("");

  const filledCount = useMemo(
    () => players.filter((p) => !!p.address).length,
    [players]
  );

  const hostAddress = useMemo(() => players?.[0]?.address || "—", [players]);

  const isHost = useMemo(() => {
    if (!account) return false;
    const h = players?.[0]?.address;
    if (!h) return false;
    if (h === "HOST") return true; // заглушка до реального адреса
    return account.toLowerCase() === h.toLowerCase();
  }, [account, players]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Установи MetaMask, чтобы подключить кошелек.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_request_accounts",
      });
      const acc = accounts[0];
      setAccount(acc);
      setStatus("Кошелек подключен.");

      setPlayers((prev) => {
        const next = [...prev];

        // Если хост был заглушкой — заменяем на реальный адрес
        if (next[0]?.address === "HOST") {
          next[0] = { address: acc, role: "HOST" };
          return next;
        }

        // Если уже есть в лобби — ничего не делаем
        const exists = next.some(
          (p) => p.address && p.address.toLowerCase?.() === acc.toLowerCase()
        );
        if (exists) return next;

        // Иначе — занимает первый свободный слот
        const idx = next.findIndex((p) => !p.address);
        if (idx !== -1) next[idx] = { address: acc, role: "PLAYER" };
        else setStatus("Комната заполнена.");
        return next;
      });
    } catch (err) {
      console.error(err);
      setStatus("Подключение отменено.");
    }
  }

  function handleStartGame() {
    if (!account) return setStatus("Сначала подключи кошелек.");
    if (!isHost) return setStatus("Стартовать игру может только host.");
    if (filledCount < 2) return setStatus("Нужно минимум 2 игрока, чтобы начать.");

    // TODO: startGame(roomId) + переход на Game_Active.jsx
    setStatus("Игра стартует... (позже будет переход на Game_Active.jsx)");
    console.log("START GAME room:", roomId);
  }

  function handleCopyRoomId() {
    navigator.clipboard?.writeText(roomId);
    setStatus("ID комнаты скопирован.");
  }

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      {/* Один хедер (без дублей логотипа/кошелька) */}
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

      {/* Только левый блок на всю ширину (правый круг убран) */}
      <main className="lobby-main">
        <div className="lobby-body">
          <section className="lobby-left">
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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

            <div className="lobby-players">
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
                    {filled ? (
                      <img src={girlAvatar} alt="player" className="avatar-img" />
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
                disabled={!isHost}
                title={!isHost ? "Только host может начать" : ""}
              >
                START GAME
              </button>

              {!account && (
                <div className="lobby-note">
                  Сначала подключи кошелек, чтобы занять слот.
                </div>
              )}
              {account && !isHost && (
                <div className="lobby-note">
                  Ты в лобби как игрок — жди, пока host нажмёт START.
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
