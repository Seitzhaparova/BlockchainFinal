// src/pages/Game_Active.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../main_page.css";

// Заменить на существующий аватар из вашей коллекции
import girlAvatar from "../assets/characters/girl1.png"; // Или любой другой из girl1, girl2, girl3, girl4

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function GameActive() {
  const [account, setAccount] = useState(null);

  // Мок-данные игры (позже с контракта)
  const [roomId] = useState("482913");
  const [topic] = useState("DARK ELEGANCE");

  // Выбор предметов
  const [selected, setSelected] = useState({
    hair: null,
    shoes: null,
    top: null,
    skirt: null,
    dress: null,
  });

  const [status, setStatus] = useState("");

  // ===== Таймер: 2 минуты =====
  const [timeLeft, setTimeLeft] = useState(120); // seconds

  useEffect(() => {
    if (timeLeft <= 0) return;

    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) {
      setStatus(
        "Время вышло. Образ зафиксирован/ожидание (логика будет позже)."
      );
    }
  }, [timeLeft]);

  const timeIsUp = timeLeft <= 0;

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

  const outfitText = useMemo(() => {
    const parts = [];
    if (selected.hair) parts.push(`Hair: ${selected.hair}`);
    if (selected.shoes) parts.push(`Shoes: ${selected.shoes}`);
    if (selected.top) parts.push(`Top: ${selected.top}`);
    if (selected.skirt) parts.push(`Skirt: ${selected.skirt}`);
    if (selected.dress) parts.push(`Dress: ${selected.dress}`);
    return parts.length
      ? parts.join(" • ")
      : "Выбери вещи справа, чтобы собрать образ.";
  }, [selected]);

  function pickItem(type, value) {
    if (timeIsUp) return; // после окончания времени не даём менять (по желанию)
    setSelected((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    setStatus(`Выбрано: ${type} = ${value}`);
  }

  function handleSubmitOutfit() {
    if (!account) return setStatus("Сначала подключи кошелек.");
    if (timeIsUp) return setStatus("Время вышло — изменить/сохранить нельзя.");

    // TODO: отправка выбора на контракт/бек
    setStatus("Образ сохранён. Ждём остальных игроков...");
    console.log("SUBMIT OUTFIT:", { roomId, selected });
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

      <main className="active-main">
        <section className="active-card">
          <div className="active-top">
            <div className="active-leftTop">
              <div className="active-topicBubble">
                <div className="active-bubbleTitle">
                  I need to dress in style
                </div>
                <div className="active-bubbleText">[{topic}]</div>
              </div>

              <div className="active-avatarWrap">
                <div className="active-silhouette" aria-hidden="true" />
              </div>

              <div className="active-miniProfile">
                <img className="active-miniImg" src={girlAvatar} alt="player" />
                <div className="active-miniText">
                  <div className="active-miniLabel">ROOM</div>
                  <div className="active-miniValue">{roomId}</div>
                </div>
              </div>
            </div>

            <div className="active-wardrobe">
              <div className="active-wardrobeFrame">
                <div className="active-wardrobePlaceholder" />
              </div>
            </div>

            <div className="active-rightPanel">
              <button className="btn outline small" onClick={connectWallet}>
                {account ? "Кошелек подключен" : "Подключить кошелек"}
              </button>

              <div className="active-items">
                <button
                  className={`active-item ${selected.hair ? "selected" : ""}`}
                  onClick={() => pickItem("hair", "Hair 01")}
                  title="Hair"
                  disabled={timeIsUp}
                >
                  <div className="active-itemIcon">👩‍🦱</div>
                </button>

                <button
                  className={`active-item ${selected.shoes ? "selected" : ""}`}
                  onClick={() => pickItem("shoes", "Heels 01")}
                  title="Shoes"
                  disabled={timeIsUp}
                >
                  <div className="active-itemIcon">👠</div>
                </button>

                <button
                  className={`active-item ${selected.top ? "selected" : ""}`}
                  onClick={() => pickItem("top", "Top 01")}
                  title="Top"
                  disabled={timeIsUp}
                >
                  <div className="active-itemIcon">👚</div>
                </button>

                <button
                  className={`active-item ${selected.skirt ? "selected" : ""}`}
                  onClick={() => pickItem("skirt", "Skirt 01")}
                  title="Skirt"
                  disabled={timeIsUp}
                >
                  <div className="active-itemIcon">👗</div>
                </button>

                <button
                  className={`active-item ${selected.dress ? "selected" : ""}`}
                  onClick={() => pickItem("dress", "Dress 01")}
                  title="Dress"
                  disabled={timeIsUp}
                >
                  <div className="active-itemIcon">🖤</div>
                </button>
              </div>
            </div>
          </div>

          <div className="active-bottom">
            <div className="active-outfitLine">{outfitText}</div>

            {/* Таймер внизу */}
            <div className={`active-timer ${timeIsUp ? "danger" : ""}`}>
              <span className="active-timerLabel">TIME LEFT: </span>
              <span className="active-timerValue">{formatMMSS(timeLeft)}</span>
            </div>

            <button
              className="btn primary"
              onClick={handleSubmitOutfit}
              disabled={timeIsUp}
              title={timeIsUp ? "Время вышло" : ""}
            >
              Save outfit
            </button>
          </div>

          {status && <div className="status-bar">{status}</div>}
        </section>
      </main>
    </div>
  );
}
