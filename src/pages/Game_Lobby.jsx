// src/pages/Game_Lobby.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

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

// Глобальное хранилище балансов и имен игроков
const TOKEN_BALANCE_KEY = "dresschain_token_balance";
const PLAYER_NAMES_KEY = "dresschain_player_names";

// Загружаем баланс из localStorage
function loadTokenBalance(address) {
  if (!address) return 0;
  try {
    const stored = localStorage.getItem(TOKEN_BALANCE_KEY);
    if (stored) {
      const balances = JSON.parse(stored);
      return balances[address.toLowerCase()] || 0;
    }
  } catch (e) {
    console.error("Error loading token balance:", e);
  }
  return 0;
}

// Сохраняем баланс в localStorage
function saveTokenBalance(address, amount) {
  if (!address) return;
  try {
    const stored = localStorage.getItem(TOKEN_BALANCE_KEY);
    const balances = stored ? JSON.parse(stored) : {};
    balances[address.toLowerCase()] = amount;
    localStorage.setItem(TOKEN_BALANCE_KEY, JSON.stringify(balances));
  } catch (e) {
    console.error("Error saving token balance:", e);
  }
}

// Загружаем имя игрока
function loadPlayerName(address) {
  if (!address) return "";
  try {
    const stored = localStorage.getItem(PLAYER_NAMES_KEY);
    if (stored) {
      const names = JSON.parse(stored);
      return names[address.toLowerCase()] || "";
    }
  } catch (e) {
    console.error("Error loading player name:", e);
  }
  return "";
}

// Сохраняем имя игрока
function savePlayerName(address, name) {
  if (!address) return;
  try {
    const stored = localStorage.getItem(PLAYER_NAMES_KEY);
    const names = stored ? JSON.parse(stored) : {};
    names[address.toLowerCase()] = name.trim();
    localStorage.setItem(PLAYER_NAMES_KEY, JSON.stringify(names));
  } catch (e) {
    console.error("Error saving player name:", e);
  }
}

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
    {
      address: hostAddr || "HOST",
      role: "HOST",
      chatText: "",
      chatUntil: 0,
      playerName: "",
    },
  ];
  while (arr.length < mp) {
    arr.push({
      address: null,
      role: "EMPTY",
      chatText: "",
      chatUntil: 0,
      playerName: "",
    });
  }
  return arr.slice(0, mp);
}

// Загружаем тела динамически
const BODY_MAP = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  import: "default",
});

// Функция для получения случайного тела
function getRandomBody() {
  const bodies = Object.values(BODY_MAP);
  return bodies[Math.floor(Math.random() * bodies.length)];
}

export default function GameLobby() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [ethInput, setEthInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [topic, setTopic] = useState("—");
  const [players, setPlayers] = useState(() => buildPlayers("HOST", 4));

  const [status, setStatus] = useState("");

  // Ref для хранения зафиксированных тел игроков
  const playerBodiesRef = useRef(new Map());

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

        // Загружаем баланс и имя при подключении
        const balance = loadTokenBalance(acc);
        setTokenBalance(balance);

        const name = loadPlayerName(acc);
        setPlayerName(name);
      } catch (e) {
        console.error("wallet init error:", e);
        setStatus("Ошибка MetaMask. Вернись на стартовой странице.");
        navigate("/", { replace: true });
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      const acc = accs?.[0] ?? null;
      if (!acc) {
        navigate("/", { replace: true });
        return;
      }
      setAccount(acc);

      // Загружаем баланс и имя для нового аккаунта
      const balance = loadTokenBalance(acc);
      setTokenBalance(balance);

      const name = loadPlayerName(acc);
      setPlayerName(name);
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

    // Обновляем имя игрока в состоянии
    const name = loadPlayerName(account);
    if (name !== playerName) {
      setPlayerName(name);
    }

    setPlayers((prev) => {
      const next = [...prev];

      // already inside?
      const exists = next.some(
        (p) => p.address && p.address.toLowerCase?.() === account.toLowerCase()
      );

      if (exists) {
        // Обновляем имя для существующего игрока
        const existingIdx = next.findIndex(
          (p) =>
            p.address && p.address.toLowerCase?.() === account.toLowerCase()
        );
        if (existingIdx !== -1) {
          next[existingIdx] = {
            ...next[existingIdx],
            playerName: name,
          };
        }
        return next;
      }

      // if host placeholder -> make this wallet host and persist
      if (next[0]?.address === "HOST") {
        next[0] = {
          ...next[0],
          address: account,
          role: "HOST",
          playerName: name,
        };

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
        next[idx] = {
          ...next[idx],
          address: account,
          role: "PLAYER",
          playerName: name,
        };
        return next;
      }

      setStatus("Комната заполнена.");
      return prev;
    });
  }, [account, roomId, topic, maxPlayers, playerName]);

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

  // Функция для получения зафиксированного тела игрока
  const getPlayerBody = useMemo(() => {
    const bodies = Object.values(BODY_MAP);
    return (playerAddress, playerIndex) => {
      const key = playerAddress || `placeholder_${playerIndex}`;

      // Если тело уже сохранено - возвращаем его
      if (playerBodiesRef.current.has(key)) {
        return playerBodiesRef.current.get(key);
      }

      // Иначе выбираем случайное тело и сохраняем
      const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
      playerBodiesRef.current.set(key, randomBody);
      return randomBody;
    };
  }, []);

  async function handleBuyTokens() {
    if (!account) return;

    const eth = Number(String(ethInput).replace(",", "."));
    if (!Number.isFinite(eth) || eth <= 0) {
      setStatus("Введи количество ETH больше 0.");
      return;
    }

    const bought = eth * TOKENS_PER_ETH;
    const newBalance = tokenBalance + bought;

    // Сохраняем баланс
    saveTokenBalance(account, newBalance);
    setTokenBalance(newBalance);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)}`);
    setEthInput("");
  }

  function handleSaveName() {
    if (!account) return;

    const trimmedName = playerName.trim();
    if (trimmedName.length === 0) {
      setStatus("Имя не может быть пустым.");
      return;
    }

    if (trimmedName.length > 20) {
      setStatus("Имя не может быть длиннее 20 символов.");
      return;
    }

    // Сохраняем имя
    savePlayerName(account, trimmedName);
    setPlayerName(trimmedName);

    // Обновляем состояние игроков
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.address && p.address.toLowerCase() === account.toLowerCase()) {
          return { ...p, playerName: trimmedName };
        }
        return p;
      })
    );

    setIsEditingName(false);
    setStatus(`Имя сохранено: ${trimmedName}`);
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

    // Проверяем, есть ли у всех игроков имена
    const playersWithoutNames = players.filter(
      (p) => p.address && p.address !== "HOST" && !p.playerName
    );

    if (playersWithoutNames.length > 0) {
      setStatus("Не все игроки установили свои имена.");
      return;
    }

    // ✅ Only block if dev mode is OFF
    if (!DEV_ALLOW_SOLO_START && filledCount < 2) {
      return setStatus("Нужно минимум 2 игрока, чтобы начать.");
    }

    // Сохраняем информацию об игроках для передачи в активную игру
    try {
      const key = `dc_room_players_${roomId}`;
      const playersInfo = players
        .filter((p) => p.address && p.address !== "HOST")
        .map((p) => ({
          address: p.address,
          name: p.playerName || shortenAddress(p.address),
        }));

      localStorage.setItem(key, JSON.stringify(playersInfo));
    } catch (e) {
      console.error("Error saving players info:", e);
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
      const b = loadTokenBalance(account);
      setTokenBalance(b);
      setStatus("Баланс обновлен");
    } catch {
      setStatus("Не удалось обновить баланс");
    }
  }

  // Получаем отображаемое имя для игрока
  const getDisplayName = (player) => {
    if (!player.address) return "";
    if (player.playerName) return player.playerName;
    return shortenAddress(player.address);
  };

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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="wallet-label">Игрок</span>
                <span
                  className="wallet-address"
                  style={{ cursor: "pointer" }}
                  onClick={() => setIsEditingName(true)}
                  title="Нажмите чтобы изменить имя"
                >
                  {playerName || shortenAddress(account)}
                </span>
              </div>
              <span className="lobby-dot ok" />
            </div>
          ) : (
            <>
              <span className="wallet-disconnected">Не подключен</span>
              <span className="lobby-dot" />
            </>
          )}
        </div>
      </header>

      {isEditingName && account && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "white",
            padding: "15px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            zIndex: 100,
            width: "300px",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Введите ваше имя"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "2px solid #ff4da6",
                fontSize: "14px",
                outline: "none",
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSaveName}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "#ff4da6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Сохранить
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                style={{
                  padding: "8px 12px",
                  background: "#eee",
                  color: "#666",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="lobby-main">
        <div className="lobby-body">
          <section className="lobby-left">
            {/* top row: back + chat + balance tools */}
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
              <button
                className="btn outline small"
                onClick={() => navigate("/")}
              >
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
                <button
                  className="btn small lobby-chat-send"
                  onClick={sendChat}
                >
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
                  Host:{" "}
                  {hostAddress === "HOST" ? "—" : getDisplayName(players[0])}
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
                const displayName = getDisplayName(p);
                const text =
                  p.address === "HOST"
                    ? "Waiting host wallet..."
                    : filled
                    ? displayName
                    : "Waiting...";

                const showChat =
                  filled && p.chatText && p.chatUntil > Date.now();

                return (
                  <div
                    key={idx}
                    className={`avatar-card ${filled ? "filled" : ""}`}
                  >
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
                        src={getPlayerBody(p.address, idx)}
                        alt={`player ${idx + 1}`}
                        style={{
                          width: "80px",
                          height: "140px",
                          objectFit: "contain",
                          display: "block",
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
                      <div
                        className="bubble-text"
                        style={{
                          fontWeight: p.playerName ? "bold" : "normal",
                          color: p.playerName ? "#240C3A" : "#666",
                        }}
                      >
                        {text}
                        {you && playerName && (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#ff4da6",
                              marginTop: "2px",
                            }}
                          >
                            (это вы)
                          </div>
                        )}
                      </div>
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
                    : !DEV_ALLOW_SOLO_START && filledCount < 2
                    ? "Нужно минимум 2 игрока"
                    : DEV_ALLOW_SOLO_START
                    ? "DEV: можно стартовать одному"
                    : ""
                }
              >
                START GAME
              </button>

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

              {/* Подсказка про имена */}
              {players.some(
                (p) => p.address && p.address !== "HOST" && !p.playerName
              ) && (
                <div className="lobby-note" style={{ color: "#ff9b23" }}>
                  ⚠️ Некоторые игроки не установили имена. Нажмите на свой адрес
                  вверху, чтобы установить имя.
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
