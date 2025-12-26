// src/pages/Result_Page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

// Fallback avatars (temporary)
import girl1 from "../assets/icons_girls/girl1.png";
import girl2 from "../assets/icons_girls/girl2.png";
import girl3 from "../assets/icons_girls/girl3.png";
import girl4 from "../assets/icons_girls/girl4.png";

// ✅ NEW: fashion show background (full scene, replaces confetti)
import bgImg from "../assets/results/background.png";



function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// mock balance
async function fetchTokenBalance(_address) {
  return Math.floor(Math.random() * 1000);
}

function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

const AVATARS = [girl1, girl2, girl3, girl4];
const CHAT_TTL_MS = 5 * 1000; 

// Skeleton JSON loader (future: replace with contract/backend)
function loadResultsSkeleton(roomId) {
  // Expected JSON shape (example):
  // {
  //   winners: [
  //     { rank: 1, address: "0x...", score: 5, avatarIndex: 0 },
  //     { rank: 2, address: "0x...", score: 4, avatarIndex: 1 },
  //     { rank: 3, address: "0x...", score: 4, avatarIndex: 2 }
  //   ]
  // }
  try {
    const raw = localStorage.getItem(`dc_results_${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildWinnersFromJson(resultsJson) {
  const fallback = [
    { rank: 1, address: "", score: "", avatarIndex: 0, chatText: "", chatUntil: 0 },
    { rank: 2, address: "", score: "", avatarIndex: 1, chatText: "", chatUntil: 0 },
    { rank: 3, address: "", score: "", avatarIndex: 2, chatText: "", chatUntil: 0 },
  ];

  if (!resultsJson?.winners || !Array.isArray(resultsJson.winners)) return fallback;

  const map = new Map();
  for (const w of resultsJson.winners) {
    const r = Number(w?.rank);
    if (r === 1 || r === 2 || r === 3) map.set(r, w);
  }

  return [1, 2, 3].map((r, i) => {
    const w = map.get(r) || {};
    return {
      rank: r,
      address: w.address || "",
      score: typeof w.score === "number" ? w.score : w.score || "",
      avatarIndex: Number.isFinite(Number(w.avatarIndex)) ? Number(w.avatarIndex) : i,
      chatText: "",
      chatUntil: 0,
    };
  });
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);

  const [status, setStatus] = useState("");
  const [chatInput, setChatInput] = useState("");

  const [winners, setWinners] = useState(() => {
    const json = loadResultsSkeleton(roomId);
    return buildWinnersFromJson(json);
  });

  // Wallet auto-detect (no popup). If not connected -> go start
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
      } catch (e) {
        console.error("wallet init error:", e);
        setStatus("Ошибка MetaMask. Вернись на стартовую страницу.");
        navigate("/", { replace: true });
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      const acc = accs?.[0] ?? null;
      setAccount(acc);
      if (!acc) navigate("/", { replace: true });
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

  // Load balance
  useEffect(() => {
    if (!account) return;
    (async () => {
      try {
        const b = await fetchTokenBalance(account);
        setTokenBalance(b);
      } catch {
        setTokenBalance(0);
      }
    })();
  }, [account]);

  // Load winners JSON by roomId (skeleton)
  useEffect(() => {
    const json = loadResultsSkeleton(roomId);
    setWinners(buildWinnersFromJson(json));
  }, [roomId]);

  // chat TTL cleanup
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setWinners((prev) => {
        let changed = false;
        const next = prev.map((w) => {
          if (w.chatUntil && w.chatUntil <= now && w.chatText) {
            changed = true;
            return { ...w, chatText: "", chatUntil: 0 };
          }
          return w;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const myWinnerIndex = useMemo(() => {
    if (!account) return -1;
    return winners.findIndex(
      (w) => w.address && w.address.toLowerCase?.() === account.toLowerCase()
    );
  }, [account, winners]);

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;

    if (myWinnerIndex === -1) {
      setStatus("Твой кошелёк не в топ-3 (пока чат показывается только над победителями).");
      setChatInput("");
      return;
    }

    const until = Date.now() + CHAT_TTL_MS;

    setWinners((prev) => {
      const next = [...prev];
      next[myWinnerIndex] = { ...next[myWinnerIndex], chatText: text, chatUntil: until };
      return next;
    });

    setChatInput("");
    setStatus("");
  }

  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

  function handleLeaveRoom() {
    navigate("/", { replace: true });
  }

  // ✅ Your tuned positions (girls + info bubbles)
  const slotPos = {
    1: { left: "50%", bottom: "50%", size: 190 },
    2: { left: "30%", bottom: "40%", size: 165 },
    3: { left: "70%", bottom: "35%", size: 165 },
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
        <section className="active-card" style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr minmax(240px, 320px)",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {/* CENTER STAGE */}
            <div
              style={{
                position: "relative",
                borderRadius: 18,
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(0,0,0,0.06)",
                minHeight: 520,
                padding: 18,
                display: "grid",
                placeItems: "end center",
                paddingBottom: 0,
                overflow: "hidden",
              }}
            >
              {/* ✅ Fashion show background behind everything */}
              <img
                src={bgImg}
                alt="fashion-show background"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />

              {/* Podium + winners */}
              <div
                style={{
                  position: "relative",
                  width: "min(980px, 100%)",
                  height: 470,
                  zIndex: 1, // above bg
                }}
              >

                {/* Winners on top of podium */}
                {winners.map((w) => {
                  const pos = slotPos[w.rank] || slotPos[3];
                  const avatar = AVATARS[w.avatarIndex % AVATARS.length] || girl1;

                  const showChat = w.chatText && w.chatUntil > Date.now();
                  const walletText = w.address ? shortenAddress(w.address) : "—";
                  const scoreText = w.score !== "" ? w.score : "—";

                  return (
                    <div
                      key={w.rank}
                      style={{
                        position: "absolute",
                        left: pos.left,
                        bottom: pos.bottom,
                        transform: "translateX(-50%)",
                        display: "grid",
                        justifyItems: "center",
                        gap: 10,
                        zIndex: 2, // ✅ ensure above podium
                      }}
                    >
                      {/* Player info bubble */}
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          background: "rgba(255,155,227,0.35)",
                          border: "1px solid rgba(0,0,0,0.10)",
                          color: "rgba(36,12,58,0.92)",
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: "center",
                          boxShadow: "0 10px 22px rgba(33,7,58,0.12)",
                          maxWidth: 220,
                        }}
                        title="Will be filled from JSON later"
                      >
                        <div>Player: {walletText}</div>
                        <div>Score: {scoreText}</div>
                      </div>

                      {/* Avatar + chat bubble anchor */}
                      <div
                        style={{
                          position: "relative",
                          width: pos.size,
                          height: pos.size + 40,
                        }}
                      >
                        {showChat && (
                          <div className="chat-bubble" title="Message is visible by others">
                            {w.chatText}
                          </div>
                        )}

                        <img
                          src={avatar}
                          alt={`winner ${w.rank}`}
                          style={{
                            width: pos.size,
                            height: pos.size + 30,
                            objectFit: "contain",
                            display: "block",
                            filter: "drop-shadow(0 14px 20px rgba(33,7,58,0.14))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <aside
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "stretch",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    borderRadius: 16,
                    padding: "12px 12px",
                    background: "rgba(255,155,227,0.20)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "rgba(36,12,58,0.92)",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontSize: 12,
                  }}
                >
                  Chat for lobby:
                </div>

                <div className="lobby-chatbar" style={{ maxWidth: "100%", marginTop: -2 }}>
                  <input
                    className="lobby-chat-input"
                    placeholder="Write message..."
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

                {status && <div className="status-bar">{status}</div>}
              </div>

              <button className="btn primary" onClick={handleLeaveRoom}>
                LEAVE ROOM
              </button>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
