// StartPage.jsx without images
import React, { useState } from "react";
import "../main_page.css";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export default function StartPage() {
  const [account, setAccount] = useState(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [status, setStatus] = useState("");

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

    // TODO: здесь потом будет вызов смарт-контракта:
    // const id = await contract.createGame();
    // setCreatedRoomId(id.toString());

    // Временно — фейковый ID (6 цифр), чтобы проверить интерфейс:
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

    // TODO: здесь потом будет логика подключения к комнате / переход на экран игры
    console.log("Join room:", roomIdInput);
    setStatus(`Пытаемся подключиться к комнате ${roomIdInput}...`);
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
              <span className="wallet-address">
                {shortenAddress(account)}
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
          {/* Здесь позже можно вставить манекен / превью образа */}
          <div className="side-tag">Season 01 • Neon Glam</div>
          <div className="side-silhouette">
            <div className="silhouette-inner">Runway ready</div>
          </div>
        </div>
      </main>
    </div>
  );
}
