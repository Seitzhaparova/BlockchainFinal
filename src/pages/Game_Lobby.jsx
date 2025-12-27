// src/pages/Game_Lobby.jsx - ОБНОВЛЕННАЯ ВЕРСИЯ
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";
import {
  getTokenBalance,
  deductEntryFee,
  saveBetInfo,
} from "../utils/outfitStorage";

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
      isBot: false,
    },
  ];
  while (arr.length < mp) {
    arr.push({
      address: null,
      role: "EMPTY",
      chatText: "",
      chatUntil: 0,
      playerName: "",
      isBot: false,
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

// Список имен для ботов
const BOT_NAMES = [
  "FashionBot_1",
  "GlitterAI",
  "RetroVibe",
  "StyleMaster",
  "TrendSetter",
  "ChicBot",
  "VogueAI",
  "RunwayPro",
  "CoutureBot",
  "GlamourAI",
];

// Список адресов для ботов
const BOT_ADDRESSES = [
  "0xBot1A1B2C3D4E5F6",
  "0xBot2G7H8I9J0K1L2",
  "0xBot3M3N4O5P6Q7R8",
  "0xBot4S9T0U1V2W3X4",
  "0xBot5Y5Z6A7B8C9D0",
  "0xBot6E1F2G3H4I5J6",
  "0xBot7K7L8M9N0O1P2",
  "0xBot8Q2R3S4T5U6V7",
  "0xBot9W8X9Y0Z1A2B3",
  "0xBot10C3D4E5F6G7H8",
];

// Генерируем ботов
function generateBots(count) {
  const bots = [];
  const usedIndices = new Set();

  for (let i = 0; i < count; i++) {
    let index;
    do {
      index = Math.floor(Math.random() * BOT_NAMES.length);
    } while (usedIndices.has(index));

    usedIndices.add(index);

    bots.push({
      address: BOT_ADDRESSES[index],
      name: BOT_NAMES[index],
      role: "BOT",
      chatText: "",
      chatUntil: 0,
      playerName: BOT_NAMES[index],
      isBot: true,
      body: getRandomBody(),
    });
  }

  return bots;
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
  const [hasBots, setHasBots] = useState(false);

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
        const bots = meta?.hasBots || false;

        setTopic(t);
        setMaxPlayers(mp);
        setHasBots(bots);

        if (bots) {
          // Если в комнате уже есть боты, восстанавливаем их
          const playersWithBots = buildPlayers(host, mp);
          playersWithBots[0] = {
            ...playersWithBots[0],
            address: host,
            role: "HOST",
            playerName: loadPlayerName(host),
          };

          // Заполняем пустые слоты ботами
          const emptySlots = playersWithBots.filter((p) => !p.address);
          if (emptySlots.length > 0) {
            const bots = generateBots(emptySlots.length);
            let botIndex = 0;

            for (let i = 0; i < playersWithBots.length; i++) {
              if (!playersWithBots[i].address && bots[botIndex]) {
                playersWithBots[i] = bots[botIndex];
                botIndex++;
              }
            }
          }

          setPlayers(playersWithBots);
        } else {
          setPlayers(buildPlayers(host, mp));
        }
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
              hasBots: hasBots,
              createdAt: meta.createdAt || Date.now(),
            })
          );
        } catch {}

        return next;
      }

      // else: take first empty slot that is not a bot
      const idx = next.findIndex((p) => !p.address && !p.isBot);
      if (idx !== -1) {
        next[idx] = {
          ...next[idx],
          address: account,
          role: "PLAYER",
          playerName: name,
          isBot: false,
        };
        return next;
      }

      setStatus("Комната заполнена.");
      return prev;
    });
  }, [account, roomId, topic, maxPlayers, playerName, hasBots]);

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
    return (playerAddress, playerIndex, isBot = false) => {
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

  // Функция для игры с ботами
  function handlePlayWithBots() {
    if (!account) {
      setStatus("Сначала подключи кошелек.");
      return;
    }

    if (!isHost) {
      setStatus("Только host может добавить ботов.");
      return;
    }

    setStatus("Добавляем ботов в комнату...");

    // Обновляем состояние комнаты
    try {
      const key = `dc_room_${roomId}`;
      const raw = localStorage.getItem(key);
      const meta = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        key,
        JSON.stringify({
          ...meta,
          hasBots: true,
          isBotGame: true,
        })
      );
    } catch (e) {
      console.error("Error saving bot game flag:", e);
    }

    // Добавляем ботов в пустые слоты
    setPlayers((prev) => {
      const next = [...prev];
      const emptySlots = next.filter((p) => !p.address);

      if (emptySlots.length === 0) {
        setStatus("Нет пустых слотов для ботов.");
        return prev;
      }

      const bots = generateBots(emptySlots.length);
      let botIndex = 0;

      for (let i = 0; i < next.length; i++) {
        if (!next[i].address && bots[botIndex]) {
          next[i] = bots[botIndex];
          botIndex++;
        }
      }

      setHasBots(true);
      setStatus(`Добавлено ${bots.length} ботов! Теперь можно начать игру.`);
      return next;
    });
  }

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
    if (!account) return;
    if (!isHost) return setStatus("Стартовать игру может только host.");

    // Проверяем, есть ли у всех игроков имена
    const playersWithoutNames = players.filter(
      (p) => p.address && p.address !== "HOST" && !p.isBot && !p.playerName
    );

    if (playersWithoutNames.length > 0) {
      setStatus("Не все игроки установили свои имена.");
      return;
    }

    // Если игра с реальными людьми (без ботов) - проверяем баланс
    if (!hasBots) {
      const realPlayers = players.filter((p) => p.address && !p.isBot);

      // Проверяем баланс всех реальных игроков
      const playersWithInsufficientBalance = realPlayers.filter((p) => {
        const balance = getTokenBalance(p.address);
        return balance < ENTRY_FEE_AMOUNT;
      });

      if (playersWithInsufficientBalance.length > 0) {
        const playersList = playersWithInsufficientBalance
          .map((p) => p.playerName || shortenAddress(p.address))
          .join(", ");
        setStatus(
          `Недостаточно токенов у игроков: ${playersList}. Нужно минимум ${ENTRY_FEE_AMOUNT} токенов.`
        );
        return;
      }

      // Списание ставок для всех реальных игроков
      let allDeducted = true;
      realPlayers.forEach((player) => {
        const deducted = deductEntryFee(roomId, player.address, hasBots);
        if (!deducted) allDeducted = false;
        if (deducted) {
          saveBetInfo(roomId, player.address, ENTRY_FEE_AMOUNT);
        }
      });

      if (!allDeducted) {
        setStatus("Ошибка при списании токенов. Проверьте баланс.");
        return;
      }
    }

    // ✅ Only block if dev mode is OFF and no bots
    if (!hasBots && !DEV_ALLOW_SOLO_START && filledCount < 2) {
      return setStatus("Нужно минимум 2 игрока, чтобы начать.");
    }

    // Сохраняем информацию об игроках
    try {
      const key = `dc_room_players_${roomId}`;
      const playersInfo = players
        .filter((p) => p.address && p.address !== "HOST")
        .map((p) => ({
          address: p.address,
          name: p.playerName || (p.isBot ? p.name : shortenAddress(p.address)),
          isBot: p.isBot || false,
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
    if (player.isBot) return player.name;
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
                  idx === 0 && filled
                    ? "HOST"
                    : p.isBot
                    ? "BOT"
                    : filled
                    ? "PLAYER"
                    : "EMPTY";

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
                    className={`avatar-card ${filled ? "filled" : ""} ${
                      p.isBot ? "bot" : ""
                    }`}
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
                      <>
                        {p.isBot && (
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              background: "#240C3A",
                              color: "white",
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              fontWeight: "bold",
                              zIndex: 2,
                            }}
                          >
                            🤖 BOT
                          </div>
                        )}
                        <img
                          src={p.body || getPlayerBody(p.address, idx, p.isBot)}
                          alt={`player ${idx + 1}`}
                          style={{
                            width: "80px",
                            height: "140px",
                            objectFit: "contain",
                            display: "block",
                            filter: p.isBot ? "sepia(0.3)" : "none",
                          }}
                        />
                      </>
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
                          color: p.isBot
                            ? "#8B4513"
                            : p.playerName
                            ? "#240C3A"
                            : "#666",
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
              {isHost && (
                <>
                  <button
                    className={`btn ${
                      isHost && hasBots ? "primary" : "outline"
                    }`}
                    onClick={handleStartGame}
                    disabled={!isHost}
                    title={
                      !hasBots && filledCount < 2
                        ? "Нужно минимум 2 игрока или добавьте ботов"
                        : ""
                    }
                  >
                    START GAME
                  </button>

                  <button
                    className="btn outline"
                    onClick={handlePlayWithBots}
                    disabled={hasBots}
                    title={
                      hasBots
                        ? "Боты уже добавлены"
                        : "Добавить ботов в пустые слоты"
                    }
                  >
                    {hasBots ? "Боты добавлены ✓" : "🎮 Играть с ботами"}
                  </button>
                </>
              )}

              {account && !isHost && (
                <div className="lobby-note">
                  Ты в лобби как игрок — жди, пока host нажмёт START.
                </div>
              )}

              {!hasBots && filledCount < 2 && account && (
                <div className="lobby-note" style={{ color: "#ff6b6b" }}>
                  Ожидание игроков... Нужно минимум 2 игрока для старта
                  <br />
                  Или host может добавить ботов кнопкой выше
                </div>
              )}

              {/* Индикатор режима */}
              {hasBots && (
                <div
                  className="lobby-note"
                  style={{
                    color: "#8B4513",
                    background: "rgba(139, 69, 19, 0.1)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    marginTop: "10px",
                  }}
                >
                  <strong>🎮 Режим игры с ботами</strong>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>
                    Боты будут автоматически сгенерированы с случайными образами
                  </div>
                </div>
              )}

              {/* Подсказка про имена */}
              {players.some(
                (p) =>
                  p.address && p.address !== "HOST" && !p.isBot && !p.playerName
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
