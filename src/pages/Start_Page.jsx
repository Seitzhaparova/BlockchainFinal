// src/pages/Start_Page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../main_page.css";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// Mock rate: 1 ETH -> 100 TOKENS
const TOKENS_PER_ETH = 100;

// Topics (same as lobby)
const GAME_TOPICS = ["NEON GLAM", "CYBER FAIRY", "FUTURISTIC RUNWAY", "Y2K ICON", "DARK ELEGANCE"];
function getRandomTopic() {
  return GAME_TOPICS[Math.floor(Math.random() * GAME_TOPICS.length)];
}

// Safer MetaMask provider getter
function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

// Функции для работы с именами и балансами
const TOKEN_BALANCE_KEY = "dresschain_token_balance";
const PLAYER_NAMES_KEY = "dresschain_player_names";

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

export default function StartPage() {
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const [roomIdInput, setRoomIdInput] = useState("");
  const [status, setStatus] = useState("");

  const [tokenBalance, setTokenBalance] = useState(0);
  const [ethInput, setEthInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  const prettyTokens = useMemo(() => {
    if (!Number.isFinite(tokenBalance)) return "0";
    return String(Math.floor(tokenBalance));
  }, [tokenBalance]);

  // Auto-check if wallet is already connected
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    let mounted = true;

    async function init() {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        const acc = accounts?.[0] ?? null;
        const cid = await eth.request({ method: "eth_chainId" });

        if (!mounted) return;
        setAccount(acc);
        setChainId(cid);
        
        if (acc) {
          // Загружаем баланс и имя
          const balance = loadTokenBalance(acc);
          setTokenBalance(balance);
          
          const name = loadPlayerName(acc);
          setPlayerName(name);
          
          // Если имя не установлено - показываем модалку
          if (!name) {
            setShowNameModal(true);
          }
        }
      } catch (e) {
        console.error("wallet init error:", e);
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      const acc = accs?.[0] ?? null;
      setAccount(acc);
      setStatus(acc ? "Аккаунт изменён." : "Кошелёк отключён.");
      
      if (acc) {
        // Загружаем баланс и имя для нового аккаунта
        const balance = loadTokenBalance(acc);
        setTokenBalance(balance);
        
        const name = loadPlayerName(acc);
        setPlayerName(name);
        
        if (!name) {
          setShowNameModal(true);
        }
      }
    };

    const onChainChanged = () => window.location.reload();

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      mounted = false;
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  async function connectWallet() {
    const eth = getEthereum();

    if (!eth) {
      setStatus("MetaMask не найден. Установи расширение MetaMask в браузер.");
      return null;
    }

    try {
      setIsConnecting(true);
      setStatus("");

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const acc = accounts?.[0] ?? null;
      const cid = await eth.request({ method: "eth_chainId" });

      setAccount(acc);
      setChainId(cid);
      
      if (acc) {
        // Загружаем баланс и имя
        const balance = loadTokenBalance(acc);
        setTokenBalance(balance);
        
        const name = loadPlayerName(acc);
        setPlayerName(name);
        
        // Показываем модалку для установки имени, если его нет
        if (!name) {
          setShowNameModal(true);
        }
      }

      setStatus(acc ? "Кошелёк подключён." : "Не удалось получить аккаунт.");
      return acc;
    } catch (err) {
      console.error(err);
      if (err?.code === 4001) setStatus("Подключение отменено пользователем.");
      else if (err?.code === -32002) setStatus("Окно MetaMask уже открыто (запрос ожидает).");
      else setStatus("Ошибка подключения кошелька.");
      return null;
    } finally {
      setIsConnecting(false);
    }
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
    setShowNameModal(false);
    setStatus(`Имя сохранено: ${trimmedName}`);
  }

  async function requireWallet() {
    if (account) return account;
    return await connectWallet();
  }

  async function handleCreateGame() {
    const acc = await requireWallet();
    if (!acc) return;

    const fakeId = Math.floor(100000 + Math.random() * 900000).toString();
    const topic = getRandomTopic();

    // mock "room storage" for this browser
    localStorage.setItem(
      `dc_room_${fakeId}`,
      JSON.stringify({
        roomId: fakeId,
        topic,
        host: acc,
        maxPlayers: 4,
        createdAt: Date.now(),
      })
    );

    // ✅ redirect to lobby
    navigate(`/lobby/${fakeId}`);
  }

  async function handleJoinGame() {
    const id = roomIdInput.trim();
    if (!id) {
      setStatus("Введи ID комнаты.");
      return;
    }

    const acc = await requireWallet();
    if (!acc) return;

    navigate(`/lobby/${id}`);
  }

  async function handleBuyTokens() {
    const acc = await requireWallet();
    if (!acc) return;

    const eth = Number(String(ethInput).replace(",", "."));
    if (!Number.isFinite(eth) || eth <= 0) {
      setStatus("Введи количество ETH больше 0.");
      return;
    }

    const bought = eth * TOKENS_PER_ETH;
    const newBalance = tokenBalance + bought;
    
    // Сохраняем баланс
    saveTokenBalance(acc, newBalance);
    setTokenBalance(newBalance);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)}`);
    setEthInput("");
  }

  const connected = !!account;

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      {/* Модалка для установки имени */}
      {showNameModal && account && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            padding: "30px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          }}>
            <h3 style={{ 
              margin: "0 0 15px 0", 
              color: "#240C3A",
              textAlign: "center"
            }}>
              Добро пожаловать в DressChain! 👗
            </h3>
            <p style={{ 
              color: "#666", 
              marginBottom: "20px",
              textAlign: "center",
              fontSize: "14px"
            }}>
              Сначала установите игровое имя, которое будут видеть другие участники
            </p>
            <div style={{ marginBottom: "20px" }}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Введите ваше имя"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "2px solid #ff4da6",
                  fontSize: "16px",
                  outline: "none",
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                }}
              />
              <div style={{
                fontSize: "12px",
                color: "#999",
                marginTop: "5px",
                textAlign: "center"
              }}>
                Можно использовать до 20 символов
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSaveName}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "linear-gradient(135deg, #ffd86b, #ff4da6)",
                  color: "#2b1220",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Сохранить имя и начать
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="start-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>

        <div className="wallet-pill">
          <div className="wallet-balance">
            <span className="wallet-label">Balance</span>
            <span className="wallet-balance-value">{prettyTokens} tokens</span>
          </div>

          <span className="wallet-sep" />

          {connected ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)" }}>
                {playerName ? playerName : "Без имени"}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)" }}>
                {shortenAddress(account)}
              </div>
            </div>
          ) : (
            <span className="wallet-disconnected">Не подключен</span>
          )}
        </div>
      </header>

      <main className="start-main">
        <div className="start-card">
          <h1 className="start-title">Step on the Chain Runway</h1>
          <p className="start-subtitle">
            Создай комнату, одень образ по теме и соревнуйся за модную славу и игровой банк токенов.
          </p>

          <div className="start-actions">
            <button className="btn primary" onClick={connectWallet} disabled={isConnecting}>
              {connected ? "Кошелек подключен" : isConnecting ? "Подключение..." : "Подключить кошелек"}
            </button>

            {connected && (
              <>
                <button className="btn outline" onClick={handleCreateGame}>
                  Создать игру
                </button>

                <div className="buy-section">
                  <label className="buy-label">Купить токен(ы)</label>
                  <div className="buy-row">
                    <input
                      type="text"
                      placeholder="Number of ETH"
                      value={ethInput}
                      onChange={(e) => setEthInput(e.target.value)}
                      className="buy-input"
                    />
                    <button className="btn small buy-btn" onClick={handleBuyTokens}>
                      Купить
                    </button>
                  </div>
                  <div className="buy-hint">1 ETH = 100 токенов. Баланс: {prettyTokens} токенов</div>
                </div>

                <div className="join-section">
                  <label className="join-label">Подключиться к игре</label>
                  <div className="join-row">
                    <input
                      type="text"
                      placeholder="Введи ID комнаты"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      className="join-input"
                    />
                    <button className="btn small" onClick={handleJoinGame}>
                      Войти
                    </button>
                  </div>
                </div>
                
                {/* Кнопка смены имени */}
                {playerName && (
                  <button 
                    className="btn small outline" 
                    onClick={() => setShowNameModal(true)}
                    style={{ marginTop: "10px" }}
                  >
                    Изменить имя: "{playerName}"
                  </button>
                )}
              </>
            )}
          </div>

          {status && <div className="status-bar">{status}</div>}
        </div>

        <div className="start-side">
          <div className="side-silhouette">
            <div className="silhouette-inner">Runway ready</div>
          </div>
        </div>
      </main>
    </div>
  );
}