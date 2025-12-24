// src/pages/Start_Page.jsx
import React, { useMemo, useState } from "react";
import "../main_page.css";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// Мок-курс: 1 ETH -> 100 TOKENS (поменяешь потом)
const TOKENS_PER_ETH = 100;

export default function StartPage() {
  const [account, setAccount] = useState(null);

  const [roomIdInput, setRoomIdInput] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [status, setStatus] = useState("");

  // ===== NEW: баланс токенов игрока =====
  const [tokenBalance, setTokenBalance] = useState(0);

  // ===== NEW: покупка токенов (ввод ETH) =====
  const [ethInput, setEthInput] = useState("");

  const prettyTokens = useMemo(() => {
    // чтобы не было длинных дробей
    if (!Number.isFinite(tokenBalance)) return "0";
    return String(Math.floor(tokenBalance));
  }, [tokenBalance]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Установи MetaMask, чтобы подключить кошелек.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_request_accounts",
      });
      setAccount(accounts[0]);
      setStatus("Кошелек подключен.");

      // TODO позже:
      // 1) получить баланс токенов из контракта по accounts[0]
      // setTokenBalance(await contract.balanceOf(accounts[0]));
    } catch (err) {
      console.error(err);
      setStatus("Подключение отменено.");
    }
  }

  async function handleCreateGame() {
    if (!account) {
      setStatus("Сначала подключи кошелек.");
      return;
    }

    // TODO: вызов контракта createGame()
    const fakeId = Math.floor(100000 + Math.random() * 900000).toString();
    setCreatedRoomId(fakeId);
    setStatus("Комната создана. Отправь ID другу.");
  }

  function handleJoinGame() {
    if (!roomIdInput.trim()) {
      setStatus("Введи ID комнаты.");
      return;
    }
    if (!account) {
      setStatus("Сначала подключи кошелек.");
      return;
    }

    // TODO: joinGame(roomId) + переход на /lobby/:id
    console.log("Join room:", roomIdInput);
    setStatus(`Пытаемся подключиться к комнате ${roomIdInput}...`);
  }

  // ===== NEW: покупка токенов =====
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

    // TODO: Реальная логика позже:
    // await contract.buyTokens({ value: parseEther(ethInput) });
    // const newBalance = await contract.balanceOf(account);
    // setTokenBalance(Number(newBalance));

    // Мок: начислим токены
    const bought = eth * TOKENS_PER_ETH;
    setTokenBalance((prev) => prev + bought);
    setStatus(`Успешно куплено токенов: +${Math.floor(bought)} (мок)`);
    setEthInput("");
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

        {/* NEW: баланс + статус кошелька */}
        <div className="wallet-pill">
          <div className="wallet-balance">
            <span className="wallet-label">Balance</span>
            <span className="wallet-balance-value">{prettyTokens} tokens</span>
          </div>

          <span className="wallet-sep" />

          {account ? (
            <>
              <span className="wallet-label">Кошелек</span>
              <span className="wallet-address">{shortenAddress(account)}</span>
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
            Создай комнату, одень образ по теме и соревнуйся за модную славу
            и игровой банк токенов.
          </p>

          <div className="start-actions">
            <button className="btn primary" onClick={connectWallet}>
              {account ? "Кошелек подключен" : "Подключить кошелек"}
            </button>

            <button className="btn outline" onClick={handleCreateGame}>
              Создать игру
            </button>

            {/* NEW: покупка токенов */}
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
              <div className="buy-hint">
                Покупка доступна только при подключённом кошельке и сумме ETH &gt; 0.
              </div>
            </div>

            {createdRoomId && (
              <div className="room-id-box">
                <span className="room-id-label">ID твоей комнаты</span>
                <span className="room-id-value">{createdRoomId}</span>
                <span className="room-id-hint">
                  Скопируй и отправь друзьям, чтобы они подключились.
                </span>
              </div>
            )}

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