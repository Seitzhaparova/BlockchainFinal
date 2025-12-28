// src/pages/Game_Active.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "../main_page.css";

import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { topicText } from "../web3/topics";
import { getRoom } from "../web3/contracts";

import iconAppearance from "../assets/icons/appearence.png";
import iconUp from "../assets/icons/up.png";
import iconBottom from "../assets/icons/bottom.png";
import iconDress from "../assets/icons/dress.png";
import iconShoes from "../assets/icons/shoes.png";
import iconAcc from "../assets/icons/accessories.png";

import OutfitStage from "../components/OutfitStage.jsx";
import { ASSETS, NAME_MAPS } from "../utils/assetCatalogs";
import { encodeOutfit } from "../utils/outfitCodec";

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function fmtTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function withNone(items, label = "None") {
  return [{ key: "__none__", url: null, label: "__none__", pretty: label }, ...items];
}

export default function Game_Active() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const devSolo = new URLSearchParams(location.search).get("dev") === "1";

  const assets = ASSETS;

  const defaultSelected = useMemo(() => {
    return {
      body: assets.bodies?.[0]?.url ?? null,
      hair: assets.hairs?.[0]?.url ?? null,
      shoes: assets.shoes?.[0]?.url ?? null,
      up: null,
      down: null,
      dress: null,
      hairclips: null,
      headphones: null,
      necklace: null,
      stockings: null,
      socks: null,
    };
  }, [assets]);

  const [selected, setSelected] = useState(defaultSelected);
  const [panel, setPanel] = useState("appearance");

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [topicId, setTopicId] = useState(0);

  // IMPORTANT: start null + guard redirects
  const [phase, setPhase] = useState(null);
  const [phaseLoaded, setPhaseLoaded] = useState(false);

  const [host, setHost] = useState("");
  const [stylingDeadline, setStylingDeadline] = useState(0);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const inFlightRef = useRef(false);

  useEffect(() => {
    setSelected((prev) => ({
      ...defaultSelected,
      ...prev,
      body: prev.body ?? defaultSelected.body,
      hair: prev.hair ?? defaultSelected.hair,
      shoes: prev.shoes ?? defaultSelected.shoes,
    }));
  }, [defaultSelected]);

  useEffect(() => {
    (async () => {
      try {
        const provider = await getProvider().catch(() => null);
        if (!provider) return;
        const accounts = await provider.send("eth_accounts", []);
        if (accounts?.[0]) setAccount(accounts[0]);
      } catch {}
    })();
  }, []);

  async function refresh() {
    if (!roomId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const provider = await getProvider();
      const room = getRoom(roomId, provider);

      const [tId, ph, h, dl] = await Promise.all([
        room.topicId(),
        room.phase(),
        room.host(),
        room.stylingDeadline(),
      ]);

      setTopicId(Number(tId));
      setPhase(Number(ph));
      setHost(h);
      setStylingDeadline(Number(dl));
      setPhaseLoaded(true);

      if (account) {
        const [hasOutfit] = await room.getOutfit(account);
        setHasSubmitted(Boolean(hasOutfit));
      }
    } catch (e) {
      console.error(e);
      setStatus("Failed to load room (wrong address, wrong network, or RPC issue).");
      // IMPORTANT: do NOT reset phase to 0 on error
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, account]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!stylingDeadline) return setTimeLeft(0);
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, stylingDeadline - now));
    }, 500);
    return () => clearInterval(t);
  }, [stylingDeadline]);

  // ✅ guarded routing: prevents lobby<->active bouncing
  useEffect(() => {
    if (!phaseLoaded) return;
    if (typeof phase !== "number") return;

    const path = location.pathname;

    if (!devSolo && phase === 0 && !path.startsWith(`/lobby/`)) {
      navigate(`/lobby/${roomId}`, { replace: true });
      return;
    }
    if (phase === 2 && !path.startsWith(`/voting/`)) {
      navigate(`/voting/${roomId}`, { replace: true });
      return;
    }
    if (phase === 3 && !path.startsWith(`/result/`)) {
      navigate(`/result/${roomId}`, { replace: true });
      return;
    }
  }, [phase, phaseLoaded, devSolo, roomId, navigate, location.pathname]);

  const isHost = account && host && account.toLowerCase() === host.toLowerCase();
  const timeIsUp = timeLeft <= 0 && stylingDeadline > 0;
  const uiDisabled = timeIsUp || hasSubmitted;

  async function onConnect() {
    try {
      setStatus("");
      const acc = await connectWallet();
      setAccount(acc);
      setStatus("Wallet connected ✅");
    } catch (e) {
      console.error(e);
      setStatus("Connect failed (check MetaMask + correct network).");
    }
  }

  function pickBody(url) {
    setSelected((p) => ({ ...p, body: url }));
  }
  function pickHair(url) {
    setSelected((p) => ({ ...p, hair: url }));
  }
  function pickShoes(url) {
    setSelected((p) => ({ ...p, shoes: url }));
  }
  function pickUp(url) {
    setSelected((p) => ({ ...p, dress: null, up: url }));
  }
  function pickDown(url) {
    setSelected((p) => ({ ...p, dress: null, down: url }));
  }
  function pickDress(url) {
    setSelected((p) => ({ ...p, up: null, down: null, dress: url }));
  }
  function pickAccessory(key, url) {
    setSelected((p) => ({ ...p, [key]: url }));
  }

  async function submitOutfit() {
    if (!account) return setStatus("Connect wallet first.");
    if (hasSubmitted) return setStatus("You already submitted ✅");
    if (!selected.body || !selected.hair || !selected.shoes) {
      return setStatus("Pick body + hair + shoes first.");
    }

    try {
      setStatus("Submitting outfit on-chain... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const code = encodeOutfit(selected, assets);
      const tx = await room.submitOutfit(code);
      await tx.wait();

      setStatus("Outfit submitted ✅ (wait for host to start voting)");
      setHasSubmitted(true);
    } catch (e) {
      console.error(e);
      setStatus("Submit failed (must be Styling phase, only joined players).");
    }
  }

  async function startVoting() {
    if (!account) return setStatus("Connect wallet first.");
    try {
      setStatus("Starting voting... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const tx = await room.startVoting();
      await tx.wait();

      setStatus("Voting started ✅");
      navigate(`/voting/${roomId}`, { replace: true });
    } catch (e) {
      console.error(e);
      setStatus("Start voting failed (only host, need enough outfits / time).");
    }
  }

  function WardrobeGrid({ title, items, selectedUrl, onPick, allowNone }) {
    const data = allowNone ? withNone(items) : items;
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(0,0,0,0.06)",
            color: "rgba(36, 12, 58, 0.92)",
            fontWeight: 700,
            marginBottom: 10,
            opacity: uiDisabled ? 0.8 : 1,
          }}
        >
          {title} {uiDisabled ? "(locked)" : ""}
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {data.map((it) => {
              const isSel = selectedUrl === it.url;
              const isNone = it.url === null;
              return (
                <button
                  key={it.key}
                  onClick={() => onPick(it.url)}
                  disabled={uiDisabled}
                  title={it.pretty + (uiDisabled ? " (locked)" : "")}
                  style={{
                    borderRadius: 16,
                    border: isSel
                      ? "1px solid rgba(255, 77, 166, 0.65)"
                      : "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.78)",
                    cursor: uiDisabled ? "not-allowed" : "pointer",
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    boxShadow: isSel ? "0 10px 22px rgba(255, 77, 166, 0.18)" : "none",
                    opacity: uiDisabled ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.6)",
                      border: "1px dashed rgba(36, 12, 58, 0.20)",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {isNone ? (
                      <div style={{ fontWeight: 800, opacity: 0.65 }}>NONE</div>
                    ) : (
                      <img
                        src={it.url}
                        alt={it.pretty}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          filter: uiDisabled ? "grayscale(20%)" : "none",
                        }}
                        draggable={false}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: uiDisabled ? "rgba(36,12,58,0.5)" : "rgba(36,12,58,0.75)",
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {it.pretty}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function WardrobeAppearance() {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", gap: 12 }}>
        <div style={{ height: "50%", minHeight: 200 }}>
          <WardrobeGrid title="Skin (Body)" items={assets.bodies} selectedUrl={selected.body} onPick={pickBody} />
        </div>
        <div style={{ height: "50%", minHeight: 200 }}>
          <WardrobeGrid title="Hair color" items={assets.hairs} selectedUrl={selected.hair} onPick={pickHair} />
        </div>
      </div>
    );
  }

  function WardrobeAccessories() {
    return (
      <div style={{ width: "100%", height: "100%", overflowY: "auto", paddingRight: 6, display: "grid", gap: 12 }}>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid
            title="Hairclips"
            items={assets.accessories.hairclips}
            selectedUrl={selected.hairclips}
            onPick={(url) => pickAccessory("hairclips", url)}
            allowNone
          />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid
            title="Headphones"
            items={assets.accessories.headphones}
            selectedUrl={selected.headphones}
            onPick={(url) => pickAccessory("headphones", url)}
            allowNone
          />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid
            title="Necklace"
            items={assets.accessories.necklace}
            selectedUrl={selected.necklace}
            onPick={(url) => pickAccessory("necklace", url)}
            allowNone
          />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid
            title="Stockings"
            items={assets.accessories.stockings}
            selectedUrl={selected.stockings}
            onPick={(url) => pickAccessory("stockings", url)}
            allowNone
          />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid
            title="Socks"
            items={assets.accessories.socks}
            selectedUrl={selected.socks}
            onPick={(url) => pickAccessory("socks", url)}
            allowNone
          />
        </div>
      </div>
    );
  }

  const wardrobeContent = useMemo(() => {
    if (panel === "appearance") return <WardrobeAppearance />;
    if (panel === "shoes") return <WardrobeGrid title="Shoes" items={assets.shoes} selectedUrl={selected.shoes} onPick={pickShoes} />;
    if (panel === "up") return <WardrobeGrid title="Up" items={assets.up} selectedUrl={selected.up} onPick={pickUp} allowNone />;
    if (panel === "down") return <WardrobeGrid title="Down" items={assets.down} selectedUrl={selected.down} onPick={pickDown} allowNone />;
    if (panel === "dress") return <WardrobeGrid title="Dress" items={assets.dress} selectedUrl={selected.dress} onPick={pickDress} allowNone />;
    return <WardrobeAccessories />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, assets, selected, uiDisabled]);

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      <header className="start-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn outline small" onClick={() => navigate(`/lobby/${roomId}`)}>
            ← Back to Lobby
          </button>

          <div className="wallet-pill">
            {account ? (
              <>
                <span className="wallet-label">Wallet</span>
                <span className="wallet-address">{shortenAddress(account)}</span>
                <span className="lobby-dot ok" />
              </>
            ) : (
              <>
                <span className="wallet-disconnected">Not connected</span>
                <span className="lobby-dot" />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="active-main">
        <section className="active-card">
          <div className="active-top">
            <div className="active-leftTop">
              <div className="active-topicBubble">
                <div className="active-bubbleTitle">I need to dress in style</div>
                <div className="active-bubbleText">[{topicText(topicId)}]</div>
                <div className="active-bubbleText" style={{ opacity: 0.7 }}>
                  Room: {shortenAddress(roomId)}
                </div>
              </div>

              <div className="active-avatarWrap">
                <OutfitStage outfit={selected} width={180} height={300} nameMaps={NAME_MAPS} />
              </div>

              <div className="active-miniProfile">
                <img className="active-miniImg" src={selected.body ?? assets.bodies?.[0]?.url} alt="player" />
                <div className="active-miniText">
                  <div className="active-miniLabel">PHASE</div>
                  <div className="active-miniValue">
                    {phaseLoaded && typeof phase === "number" ? (PHASE[phase] ?? phase) : "Loading…"}
                  </div>
                </div>
              </div>
            </div>

            <div className="active-wardrobe">
              <div className="active-wardrobeFrame">
                <div className="active-wardrobePlaceholder" />
                <div style={{ position: "absolute", inset: 10, borderRadius: 18, padding: 10, overflow: "hidden" }}>
                  {wardrobeContent}
                </div>
              </div>
            </div>

            <div className="active-rightPanel">
              <button className="btn outline small" onClick={onConnect}>
                {account ? "Wallet connected" : "Connect wallet"}
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                Styling timer: <b>{stylingDeadline ? fmtTime(timeLeft) : "--:--"}</b>{" "}
                {uiDisabled ? <span style={{ marginLeft: 6 }}>(locked)</span> : null}
              </div>

              <div className="active-items">
                <button className={`active-item ${panel === "appearance" ? "selected" : ""}`} onClick={() => setPanel("appearance")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconAppearance} alt="appearance" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "up" ? "selected" : ""}`} onClick={() => setPanel("up")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconUp} alt="up" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "down" ? "selected" : ""}`} onClick={() => setPanel("down")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconBottom} alt="down" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "dress" ? "selected" : ""}`} onClick={() => setPanel("dress")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconDress} alt="dress" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "shoes" ? "selected" : ""}`} onClick={() => setPanel("shoes")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconShoes} alt="shoes" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "acc" ? "selected" : ""}`} onClick={() => setPanel("acc")} disabled={uiDisabled}>
                  <div className="active-itemIcon">
                    <img src={iconAcc} alt="acc" draggable={false} style={{ width: 26, height: 26 }} />
                  </div>
                </button>
              </div>

              <div className="active-bottom" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={submitOutfit} disabled={!account || hasSubmitted || phase !== 1}>
                  {hasSubmitted ? "Submitted ✅" : "Submit Outfit (on-chain)"}
                </button>

                {isHost && (
                  <button className="btn" onClick={startVoting} disabled={!account || phase !== 1}>
                    Host: Start Voting
                  </button>
                )}

                {status && <div className="status-bar">{status}</div>}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
