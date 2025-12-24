// src/pages/Game_Lobby.jsx
import React, { useMemo, useState, useEffect } from "react";
import "../main_page.css";
import girl1 from "../assets/characters/girl1.png";
import girl2 from "../assets/characters/girl2.png";
import girl3 from "../assets/characters/girl3.png";
import girl4 from "../assets/characters/girl4.png";

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

// Моковый курс: 1 ETH -> 100 TOKENS
const TOKENS_PER_ETH = 100;

// Тайм-аут для сообщений чата (2 минуты)
const CHAT_TTL_MS = 2 * 60 * 1000;

// Моковая функция получения баланса
async function fetchTokenBalance(address) {
  // TODO: В реальном проекте здесь будет вызов контракта
  // Заглушка: возвращаем случайное число для демонстрации
  return Math.floor(Math.random() * 1000);
}

// Массив с аватарами для каждого слота
const AVATARS = [girl1, girl2, girl3, girl4];

export default function GameLobby() {
  const [account, setAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [ethInput, setEthInput] = useState(""); // Для покупки токенов
  const [chatInput, setChatInput] = useState(""); // Для чата

  // Мок-данные комнаты
  const [roomId] = useState("482913");
  const [maxPlayers] = useState(4);

  // Тема — рандом
  const [topic] = useState(getRandomTopic());

  // Дефолт: хост уже в лобби
  const [players, setPlayers] = useState([
    { address: "HOST", role: "HOST", chatText: "", chatUntil: 0 },
    { address: null, role: "EMPTY", chatText: "", chatUntil: 0 },
    { address: null, role: "EMPTY", chatText: "", chatUntil: 0 },
    { address: null, role: "EMPTY", chatText: "", chatUntil: 0 },
  ]);

  const [status, setStatus] = useState("");

  // Функция для тестирования чата без кошелька
  const testChatWithoutWallet = () => {
    const demoAddress = "0x1234567890abcdef1234567890abcdef12345678";
    setAccount(demoAddress);

    // Автоматически заполняем всех игроков с сообщениями
    setPlayers([
      {
        address: demoAddress,
        role: "HOST",
        chatText: "Привет всем! Я демо-хост 👑",
        chatUntil: Date.now() + CHAT_TTL_MS,
      },
      {
        address: "0xabcdef1234567890abcdef1234567890abcdef12",
        role: "PLAYER",
        chatText: "Готов играть! 😎",
        chatUntil: Date.now() + CHAT_TTL_MS,
      },
      {
        address: "0x7890abcdef1234567890abcdef1234567890abcd",
        role: "PLAYER",
        chatText: "Жду старта игры ⏳",
        chatUntil: Date.now() + CHAT_TTL_MS,
      },
      {
        address: "0x34567890abcdef1234567890abcdef12345678ab",
        role: "PLAYER",
        chatText: "Давайте уже начинать! 🚀",
        chatUntil: Date.now() + CHAT_TTL_MS,
      },
    ]);

    setTokenBalance(500);
    setStatus("Демо-режим активирован! Чат работает без MetaMask. Вы - HOST.");
  };

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

  // Индекс текущего игрока в массиве (если он в лобби)
  const myIndex = useMemo(() => {
    if (!account) return -1;

    // Проверяем обычных игроков
    const idx = players.findIndex(
      (p) =>
        p.address &&
        p.address !== "HOST" &&
        p.address.toLowerCase() === account.toLowerCase()
    );
    if (idx !== -1) return idx;

    // Проверяем хост
    const hostIdx = players.findIndex(
      (p) => p.address && p.address.toLowerCase() === account.toLowerCase()
    );
    return hostIdx;
  }, [account, players]);

  // Загрузка баланса при изменении аккаунта
  useEffect(() => {
    if (account) {
      loadTokenBalance();
    } else {
      setTokenBalance(0);
    }
  }, [account]);

  // Авто-очистка сообщений чата (каждую секунду убираем истёкшие)
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

  async function loadTokenBalance() {
    try {
      // В реальном проекте здесь будет запрос к контракту
      const balance = await fetchTokenBalance(account);
      setTokenBalance(balance);
    } catch (error) {
      console.error("Ошибка при получении баланса:", error);
      setTokenBalance(0);
    }
  }

  // Покупка токенов
  async function handleBuyTokens() {
    if (!account) {
      setStatus("Сначала подключи кошелек.");
      return;
    }

    const eth = Number(String(ethInput).replace(",", "."));

    if (!Number.isFinite(eth) || eth <= 0) {
      setStatus("Введи количество ETH больше 0.");
      return;
    }

    // TODO: Реальная логика позже
    // await contract.buyTokens({ value: parseEther(ethInput) });

    // Мок: начислим токены
    const bought = eth * TOKENS_PER_ETH;
    setTokenBalance((prev) => prev + bought);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)} (мок)`);
    setEthInput("");
  }

  // Отправка сообщения в чат
  function sendChat() {
    if (!account) return setStatus("Сначала подключи кошелек.");
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

  // Обработка нажатия Enter в чате
  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

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
          next[0] = { ...next[0], address: acc, role: "HOST" };
          return next;
        }

        // Если уже есть в лобби — ничего не делаем
        const exists = next.some(
          (p) => p.address && p.address.toLowerCase() === acc.toLowerCase()
        );
        if (exists) return next;

        // Иначе — занимает первый свободный слот
        const idx = next.findIndex((p) => !p.address);
        if (idx !== -1)
          next[idx] = { ...next[idx], address: acc, role: "PLAYER" };
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
    if (filledCount < 2)
      return setStatus("Нужно минимум 2 игрока, чтобы начать.");

    // TODO: startGame(roomId) + переход на Game_Active.jsx
    setStatus("Игра стартует... (позже будет переход на Game_Active.jsx)");
    console.log("START GAME room:", roomId);
  }

  function handleCopyRoomId() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomId);
      setStatus("ID комнаты скопирован.");
    } else {
      setStatus("Не удалось скопировать ID.");
    }
  }

  // Функция для обновления баланса
  function handleRefreshBalance() {
    if (account) {
      loadTokenBalance();
      setStatus("Баланс обновлен");
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

        {/* Блок баланса токенов и кошелька */}
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
              {/* Чат-инпут слева */}
              <div className="lobby-chatbar">
                <input
                  className="lobby-chat-input"
                  placeholder={
                    account
                      ? "Напиши сообщение (будет видно 2 минуты)..."
                      : "Подключи кошелек, чтобы писать..."
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={onChatKeyDown}
                  disabled={!account}
                />
                <button
                  className="btn small lobby-chat-send"
                  onClick={sendChat}
                  disabled={!account}
                >
                  Send
                </button>
              </div>

              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                {/* КНОПКА ДЛЯ ТЕСТА БЕЗ КОШЕЛЬКА */}
                {!account && (
                  <button
                    className="btn small"
                    onClick={testChatWithoutWallet}
                    style={{
                      background: "linear-gradient(135deg, #4CAF50, #2196F3)",
                      color: "white",
                      border: "none",
                    }}
                  >
                    Тест чата (без MetaMask)
                  </button>
                )}

                <button className="btn outline small" onClick={connectWallet}>
                  {account ? "Кошелек подключен" : "Подключить кошелек"}
                </button>
                {account && (
                  <>
                    <button
                      className="btn outline small"
                      onClick={handleRefreshBalance}
                      title="Обновить баланс"
                    >
                      ↻ Баланс
                    </button>

                    {/* Блок покупки токенов в лобби */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "rgba(0, 0, 0, 0.1)",
                        padding: "4px 8px",
                        borderRadius: "20px",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="ETH"
                        value={ethInput}
                        onChange={(e) => setEthInput(e.target.value)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "999px",
                          border: "1px solid var(--border-soft)",
                          background: "rgba(11, 6, 32, 0.9)",
                          color: "var(--text-main)",
                          fontSize: "11px",
                          width: "60px",
                        }}
                      />
                      <button
                        className="btn small"
                        onClick={handleBuyTokens}
                        style={{
                          padding: "2px 8px",
                          fontSize: "10px",
                          background: "rgba(36, 12, 58, 0.85)",
                          color: "#fff",
                        }}
                      >
                        Купить
                      </button>
                    </div>
                  </>
                )}
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
                  Host:{" "}
                  {hostAddress === "HOST" ? "—" : shortenAddress(hostAddress)}
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

                const badge =
                  idx === 0 && filled ? "HOST" : filled ? "PLAYER" : "EMPTY";

                const text =
                  p.address === "HOST"
                    ? "Waiting host wallet..."
                    : filled
                    ? shortenAddress(p.address)
                    : "Waiting...";

                // Проверяем, нужно ли показывать сообщение чата
                const showChat =
                  filled && p.chatText && p.chatUntil > Date.now();

                // Получаем соответствующий аватар для этого слота
                const avatar = AVATARS[idx] || girl1;

                return (
                  <div
                    key={idx}
                    className={`avatar-card ${filled ? "filled" : ""}`}
                  >
                    {/* Бабл сообщения: показываем только если есть текст и не истёк TTL */}
                    {showChat && (
                      <div
                        className="chat-bubble"
                        title="Message disappears in 2 minutes"
                      >
                        {p.chatText}
                      </div>
                    )}

                    {filled ? (
                      <img
                        src={avatar}
                        alt={`player ${idx + 1}`}
                        className="avatar-img"
                        style={{
                          objectFit: "cover",
                          width: "auto",
                          height: "100%",
                          borderRadius: "999px",
                        }}
                      />
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
                disabled={!isHost || filledCount < 2}
                title={
                  !isHost
                    ? "Только host может начать"
                    : filledCount < 2
                    ? "Нужно минимум 2 игрока"
                    : ""
                }
              >
                START GAME
              </button>

              {!account && (
                <div className="lobby-note">
                  Сначала подключи кошелек, чтобы занять слот и писать в чат.
                </div>
              )}
              {account && !isHost && (
                <div className="lobby-note">
                  Ты в лобби как игрок — жди, пока host нажмёт START.
                </div>
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
