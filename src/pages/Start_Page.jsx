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

// Safer MetaMask provider getter (handles multiple injected providers)
function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;

  // Some wallets inject multiple providers
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

export default function StartPage() {
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const [roomIdInput, setRoomIdInput] = useState("");
  const [status, setStatus] = useState("");

  const [tokenBalance, setTokenBalance] = useState(0);
  const [ethInput, setEthInput] = useState("");

  const prettyTokens = useMemo(() => {
    if (!Number.isFinite(tokenBalance)) return "0";
    return String(Math.floor(tokenBalance));
  }, [tokenBalance]);

  // Auto-check if wallet is already connected (no popup)
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
      } catch (e) {
        console.error("init wallet error:", e);
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      setAccount(accs?.[0] ?? null);
      setStatus(accs?.[0] ? "Аккаунт изменён." : "Кошелёк отключён.");
    };

    const onChainChanged = (cid) => {
      setChainId(cid);
      window.location.reload();
    };

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

      // ✅ Correct MetaMask method:
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const acc = accounts?.[0] ?? null;
      const cid = await eth.request({ method: "eth_chainId" });

      setAccount(acc);
      setChainId(cid);

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

  async function requireWallet() {
    if (account) return account;
    return await connectWallet();
  }

  async function handleCreateGame() {
    const acc = await requireWallet();
    if (!acc) return;

    const fakeId = Math.floor(100000 + Math.random() * 900000).toString();
    const topic = getRandomTopic();

    // mock “room storage” for this browser
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

    // TODO (real): contract.buyTokens({ value: ... })
    const bought = eth * TOKENS_PER_ETH;
    setTokenBalance((prev) => prev + bought);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)} (мок)`);
    setEthInput("");
  }

  const connected = !!account;

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
            <span className="wallet-balance-value">{prettyTokens} tokens</span>
          </div>

          <span className="wallet-sep" />

          {connected ? (
            <>
              <span className="wallet-label">Кошелек</span>
              <span className="wallet-address">{shortenAddress(account)}</span>
              <span style={{ opacity: 0.7, marginLeft: 8, fontSize: 12 }}>
                {chainId ? `(${chainId})` : ""}
              </span>
            </>
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

            <button className="btn outline" onClick={handleCreateGame} disabled={isConnecting}>
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
                  disabled={isConnecting}
                />
                <button className="btn small buy-btn" onClick={handleBuyTokens} disabled={isConnecting}>
                  Купить
                </button>
              </div>
              <div className="buy-hint">Покупка доступна только при подключённом кошельке и сумме ETH &gt; 0.</div>
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
                  disabled={isConnecting}
                />
                <button className="btn small" onClick={handleJoinGame} disabled={isConnecting}>
                  Войти
                </button>
              </div>
            </div>
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