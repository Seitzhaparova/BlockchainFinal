// src/pages/Game_Lobby.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";
import { formatUnits } from "ethers";

import { connectWallet, getProvider, getSigner } from "../web3/eth.js";
import { getAddresses, getRoom, getToken } from "../web3/contracts.js";
import * as Topics from "../web3/topics.js";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];
const CHAT_TTL_MS = 2 * 60 * 1000;
const REFRESH_MS = 2000;

// avatars pool
const BODY_MAP = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  import: "default",
});

function pickRandomBody() {
  const bodies = Object.values(BODY_MAP);
  if (!bodies.length) return null;
  return bodies[Math.floor(Math.random() * bodies.length)];
}

function parseEthersError(e) {
  // ethers v6 shapes
  return (
    e?.shortMessage ||
    e?.info?.error?.message ||
    e?.error?.message ||
    e?.reason ||
    e?.message ||
    "Transaction failed"
  );
}

function topicLabelFromId(topicIdNumber) {
  // Try common exports from src/web3/topics.js, otherwise fallback
  const n = Number(topicIdNumber);
  if (!Number.isFinite(n)) return "—";

  // 1) function getTopicById(id)
  if (typeof Topics.getTopicById === "function") {
    try {
      const t = Topics.getTopicById(n);
      if (t) return t;
    } catch {}
  }

  // 2) array exports
  const arr =
    Topics.TOPICS ||
    Topics.TOPIC_NAMES ||
    Topics.TOPIC_LIST ||
    Topics.topics ||
    null;

  if (Array.isArray(arr) && arr[n]) return arr[n];

  // 3) fallback hardcoded
  const FALLBACK = [
    "Cozy girls' sleepover",
    "Study date at the library",
    "Running errands and grocery shopping",
    "Brunch at the city mall",
    "Neon glam party night",
  ];
  return FALLBACK[n] || `Topic #${n}`;
}

export default function GameLobby() {
  const navigate = useNavigate();
  const { roomId } = useParams(); // roomId is the ROOM ADDRESS (0x...)

  const [account, setAccount] = useState(null);

  const [host, setHost] = useState("");
  const [topic, setTopic] = useState("—");
  const [phase, setPhase] = useState(0);

  const [maxPlayers, setMaxPlayers] = useState(2);
  const [playersOnChain, setPlayersOnChain] = useState([]); // address[]
  const [joinedMe, setJoinedMe] = useState(false);

  const [betRaw, setBetRaw] = useState(0n);
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [betDisplay, setBetDisplay] = useState("0");

  const [myBalRaw, setMyBalRaw] = useState(0n);
  const [myBalDisplay, setMyBalDisplay] = useState("0");

  const [myAllowanceRaw, setMyAllowanceRaw] = useState(0n);

  const [status, setStatus] = useState("");
  const [busyJoin, setBusyJoin] = useState(false);
  const [busyStart, setBusyStart] = useState(false);

  // Chat (UI-only, not shared between users)
  const [chatInput, setChatInput] = useState("");
  const [chatByAddr, setChatByAddr] = useState({}); // { [addrLower]: { text, until } }

  // Stable avatar per address
  const bodiesRef = useRef(new Map());
  const getBodyFor = (addr) => {
    if (!addr) return null;
    const k = addr.toLowerCase();
    if (bodiesRef.current.has(k)) return bodiesRef.current.get(k);
    const b = pickRandomBody();
    bodiesRef.current.set(k, b);
    return b;
  };

  // 1) Auto-detect wallet (no popup)
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const provider = await getProvider();
        const accounts = await provider.send("eth_accounts", []);
        const acc = accounts?.[0] || null;
        if (!mounted) return;
        setAccount(acc);
      } catch (e) {
        setAccount(null);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleConnect() {
    try {
      setStatus("");
      const acc = await connectWallet();
      setAccount(acc);
    } catch (e) {
      setStatus(parseEthersError(e));
    }
  }

  // 2) Load room state (poll)
  useEffect(() => {
    if (!roomId) return;

    let alive = true;
    let timer = null;

    async function load() {
      try {
        setStatus("");
        const provider = await getProvider();
        const room = getRoom(roomId, provider);

        const [h, b, mp, tId, ph, ps] = await Promise.all([
          room.host(),
          room.betAmount(),
          room.maxPlayers(),
          room.topicId(),
          room.phase(),
          room.getPlayers(),
        ]);

        if (!alive) return;

        setHost(h);
        setBetRaw(b);
        setMaxPlayers(Number(mp));
        setPhase(Number(ph));
        setPlayersOnChain(ps || []);

        const tLabel = topicLabelFromId(tId);
        setTopic(tLabel);

        // token info
        const { token: tokenAddr } = getAddresses();
        const token = getToken(tokenAddr, provider);

        let dec = 18;
        try {
          dec = Number(await token.decimals());
        } catch {}
        setTokenDecimals(dec);
        setBetDisplay(formatUnits(b, dec));

        // per-account info
        if (account) {
          const [joined, bal, allowance] = await Promise.all([
            room.joined(account),
            token.balanceOf(account),
            token.allowance(account, roomId),
          ]);
          if (!alive) return;
          setJoinedMe(!!joined);
          setMyBalRaw(bal);
          setMyBalDisplay(formatUnits(bal, dec));
          setMyAllowanceRaw(allowance);
        } else {
          setJoinedMe(false);
          setMyBalRaw(0n);
          setMyBalDisplay("0");
          setMyAllowanceRaw(0n);
        }
      } catch (e) {
        if (!alive) return;
        setStatus("Failed to load room state (check ABI / address / network).");
        // console helps you debug
        console.error("load room error:", e);
      }
    }

    load();
    timer = setInterval(load, REFRESH_MS);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [roomId, account]);

  // 3) Chat TTL cleanup
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setChatByAddr((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k]?.until && next[k].until <= now) {
            delete next[k];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const filledCount = playersOnChain.length || 0;
  const isHost = useMemo(() => {
    if (!account || !host) return false;
    return account.toLowerCase() === host.toLowerCase();
  }, [account, host]);

  const phaseLabel = PHASE[phase] || `Phase ${phase}`;

  const needsApproval = useMemo(() => {
    if (!account) return false;
    if (!joinedMe && betRaw > 0n && myAllowanceRaw < betRaw) return true;
    return false;
  }, [account, joinedMe, betRaw, myAllowanceRaw]);

  // Build UI slots
  const slots = useMemo(() => {
    const mp = Math.max(2, Number(maxPlayers) || 2);
    const arr = [];
    for (let i = 0; i < mp; i++) {
      arr.push(playersOnChain[i] || null);
    }
    return arr;
  }, [playersOnChain, maxPlayers]);

  async function handleCopyRoom() {
    try {
      await navigator.clipboard.writeText(roomId || "");
      setStatus("Room address copied.");
    } catch {
      setStatus("Copy failed.");
    }
  }

  function sendChat() {
    if (!account) return setStatus("Connect wallet first.");
    const text = chatInput.trim();
    if (!text) return;
    const key = account.toLowerCase();
    setChatByAddr((prev) => ({
      ...prev,
      [key]: { text, until: Date.now() + CHAT_TTL_MS },
    }));
    setChatInput("");
  }

  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

  async function handleJoinGame() {
    if (!account) return setStatus("Connect wallet first.");
    if (!roomId) return setStatus("Room address missing.");

    try {
      setBusyJoin(true);
      setStatus("");

      const provider = await getProvider();
      const signer = await getSigner();

      const roomRead = getRoom(roomId, provider);
      const roomWrite = getRoom(roomId, signer);

      const { token: tokenAddr } = getAddresses();
      const tokenRead = getToken(tokenAddr, provider);
      const tokenWrite = getToken(tokenAddr, signer);

      // pre-checks (so MetaMask doesn’t fail silently)
      const [ph, alreadyJoined, bAmount, bal, allowance] = await Promise.all([
        roomRead.phase(),
        roomRead.joined(account),
        roomRead.betAmount(),
        tokenRead.balanceOf(account),
        tokenRead.allowance(account, roomId),
      ]);

      const phN = Number(ph);
      if (phN !== 0) return setStatus(`Cannot join: phase is ${PHASE[phN] || phN}`);
      if (alreadyJoined) return setStatus("You already joined this room.");
      if (bal < bAmount) return setStatus("Not enough DCT balance for the bet.");

      // APPROVE if needed
      if (allowance < bAmount) {
        setStatus("Approving DCT… (confirm in MetaMask)");
        // some tokens require setting to 0 first
        if (allowance > 0n) {
          const tx0 = await tokenWrite.approve(roomId, 0n);
          await tx0.wait();
        }
        const txA = await tokenWrite.approve(roomId, bAmount);
        await txA.wait();
      }

      // JOIN
      setStatus("Joining game… (confirm in MetaMask)");
      const txJ = await roomWrite.joinGame();
      await txJ.wait();

      setStatus("Joined ✅");
      // next poll will refresh players list
    } catch (e) {
      console.error("join error:", e);
      setStatus(parseEthersError(e));
    } finally {
      setBusyJoin(false);
    }
  }

  async function handleStartGame() {
    if (!account) return setStatus("Connect wallet first.");
    if (!isHost) return setStatus("Only host can start the game.");
    if (filledCount < 2) return setStatus("Need 2+ players to start (contract rule).");

    try {
      setBusyStart(true);
      setStatus("");

      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      setStatus("Starting game… (confirm in MetaMask)");
      const tx = await room.startGame();
      await tx.wait();

      // After startGame phase becomes Styling, so go Active
      navigate(`/active/${roomId}`);
    } catch (e) {
      console.error("start error:", e);
      setStatus(parseEthersError(e));
    } finally {
      setBusyStart(false);
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

        <div className="wallet-pill">
          {account ? (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="wallet-label">WALLET</span>
                <span className="wallet-address">{shortenAddress(account)}</span>
              </div>
              <span className="lobby-dot ok" />
            </>
          ) : (
            <>
              <span className="wallet-disconnected">Not connected</span>
              <button className="btn small" onClick={handleConnect}>
                Connect
              </button>
            </>
          )}
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-body">
          <section className="lobby-left">
            {/* top row: back + chat */}
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
              <button className="btn outline small" onClick={() => navigate("/")}>
                ← Back
              </button>

              <div className="lobby-chatbar">
                <input
                  className="lobby-chat-input"
                  placeholder="Write a message (visible for 2 minutes)…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={onChatKeyDown}
                />
                <button className="btn small lobby-chat-send" onClick={sendChat}>
                  Send
                </button>
              </div>
            </div>

            <div className="lobby-meta">
              <div className="lobby-pillbox">
                <div className="lobby-pilllabel">GAME ROOM</div>
                <div className="lobby-pillvalue">
                  <span>{shortenAddress(roomId || "")}</span>
                  <button className="btn small copy" onClick={handleCopyRoom}>
                    COPY
                  </button>
                </div>
                <div className="lobby-pillhint">Host: {shortenAddress(host)}</div>
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

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.75)" }}>
              <div>Bet: {betDisplay} DCT</div>
              <div>Phase: {phaseLabel}</div>
              <div>Your balance: {myBalDisplay} DCT</div>
            </div>

            <div className="lobby-players" style={{ marginTop: 18 }}>
              {slots.map((addr, idx) => {
                const filled = !!addr;
                const isMe = account && addr && addr.toLowerCase() === account.toLowerCase();
                const isSlotHost = host && addr && addr.toLowerCase() === host.toLowerCase();

                const chat = addr ? chatByAddr[addr.toLowerCase()] : null;
                const showChat = !!chat && chat.until > Date.now();

                return (
                  <div key={idx} className={`avatar-card ${filled ? "filled" : ""}`}>
                    {showChat && (
                      <div className="chat-bubble" title="Message disappears in 2 minutes">
                        {chat.text}
                      </div>
                    )}

                    {filled ? (
                      <img
                        src={getBodyFor(addr)}
                        alt="player"
                        style={{
                          width: "220px",
                          height: "320px",
                          objectFit: "contain",
                          display: "block",
                          margin: "0 auto",
                        }}
                      />
                    ) : (
                      <div className="avatar-placeholder" style={{ height: 320 }} />
                    )}

                    <div className="bubble">
                      <div className="bubble-title">
                        {isSlotHost ? "HOST" : filled ? "PLAYER" : "EMPTY"}
                        {isMe ? " • YOU" : ""}
                      </div>
                      <div className="bubble-text">
                        {filled ? shortenAddress(addr) : "Waiting…"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lobby-actions" style={{ marginTop: 16 }}>
              {!isHost && (
                <button
                  className="btn primary"
                  onClick={handleJoinGame}
                  disabled={!account || joinedMe || busyJoin}
                  title={
                    !account
                      ? "Connect wallet first"
                      : joinedMe
                      ? "Already joined"
                      : needsApproval
                      ? "Will ask to approve DCT first"
                      : "Join and pay bet"
                  }
                >
                  {busyJoin
                    ? "PLEASE WAIT…"
                    : joinedMe
                    ? "JOINED ✓"
                    : needsApproval
                    ? "APPROVE + JOIN"
                    : "JOIN GAME"}
                </button>
              )}

              {isHost && (
                <button
                  className="btn primary"
                  onClick={handleStartGame}
                  disabled={!account || busyStart || filledCount < 2}
                  title={filledCount < 2 ? "Need 2+ players (contract rule)" : "Start game on-chain"}
                >
                  {busyStart ? "STARTING…" : "START GAME"}
                </button>
              )}
            </div>

            {status && <div className="status-bar">{status}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
