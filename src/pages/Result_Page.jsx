// src/pages/Result_Page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { formatUnits } from "ethers";
import { getProvider } from "../web3/eth.js";
import { topicText } from "../web3/topics.js";
import { getAddresses, getRoom, getToken } from "../web3/contracts.js";

// ✅ Render real outfits (same as Voting page)
import OutfitStage from "../components/OutfitStage.jsx";
import { ASSETS, NAME_MAPS } from "../utils/assetCatalogs";
import { decodeOutfit } from "../utils/outfitCodec";

// Background
import bgImg from "../assets/results/background.png";

// Fallback icons (only if outfit decode fails)
import girl1 from "../assets/icons_girls/girl1.png";
import girl2 from "../assets/icons_girls/girl2.png";
import girl3 from "../assets/icons_girls/girl3.png";
import girl4 from "../assets/icons_girls/girl4.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function loadPlayerName(address) {
  if (!address) return "";
  try {
    const stored = localStorage.getItem("dresschain_player_names");
    if (stored) {
      const names = JSON.parse(stored);
      return names[address.toLowerCase()] || "";
    }
  } catch {}
  return "";
}

const AVATARS = [girl1, girl2, girl3, girl4];
function avatarForAddress(addr) {
  const hex = (addr || "").toLowerCase().replace(/^0x/, "");
  const last2 = hex.slice(-2);
  const n = parseInt(last2 || "0", 16);
  const idx = Number.isFinite(n) ? n % AVATARS.length : 0;
  return AVATARS[idx];
}

// tuned for your podium image
const PODIUM_POS = [
  { left: "50%", top: "80%", scale: 1.1 }, // 1st
  { left: "25%", top: "95%", scale: 0.95 }, // 2nd
  { left: "80%", top: "100%", scale: 0.95 }, // 3rd
];

export default function Result_Page() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const assets = ASSETS;

  const [status, setStatus] = useState("");
  const [topicId, setTopicId] = useState(0);

  const [tokenSymbol, setTokenSymbol] = useState("DCT");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [finalPot, setFinalPot] = useState("0");
  const [payoutPerWinner, setPayoutPerWinner] = useState("0");
  const [winners, setWinners] = useState([]);

  const [rows, setRows] = useState([]);
  const top3 = useMemo(() => rows.slice(0, 3), [rows]);

  async function refresh() {
    if (!roomId) return;

    try {
      const provider = await getProvider();
      const room = getRoom(roomId, provider);

      // token address: prefer room.token(), fallback to env token
      let tokenAddr = null;
      try {
        tokenAddr = await room.token();
      } catch {}

      const { token: tokenEnv } = getAddresses();
      const tokenToUse =
        tokenAddr && tokenAddr !== "0x0000000000000000000000000000000000000000"
          ? tokenAddr
          : tokenEnv;

      const token = tokenToUse ? getToken(tokenToUse, provider) : null;

      const [tId, plist, res, sym, dec] = await Promise.all([
        room.topicId(),
        room.getPlayers(),
        room.getWinners(), // (winners, finalPot, payoutPerWinner)
        token ? token.symbol().catch(() => "DCT") : Promise.resolve("DCT"),
        token ? token.decimals().catch(() => 18) : Promise.resolve(18),
      ]);

      setTopicId(Number(tId));
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));

      setWinners(res?.[0] || []);
      setFinalPot((res?.[1] || 0n).toString());
      setPayoutPerWinner((res?.[2] || 0n).toString());

      const entries = await Promise.all(
        (Array.isArray(plist) ? plist : []).map(async (p) => {
          const [has, code] = await room.getOutfit(p);
          if (!has) return null;

          const [ts, vc] = await Promise.all([room.totalStars(p), room.voteCount(p)]);
          const tsBI = BigInt(ts.toString());
          const vcBI = BigInt(vc.toString());
          const avgScaled = vcBI > 0n ? (tsBI * 1_000_000n) / vcBI : 0n;

          let outfitObj = null;
          try {
            const codeBI = typeof code === "bigint" ? code : BigInt(code.toString());
            outfitObj = decodeOutfit(codeBI, assets);
          } catch {
            outfitObj = null;
          }

          return {
            addr: p,
            outfitCode: code.toString(),
            outfitObj,
            totalStars: tsBI,
            voteCount: vcBI,
            avgScaled,
          };
        })
      );

      const next = entries.filter(Boolean);

      next.sort((a, b) => {
        if (a.avgScaled !== b.avgScaled) return a.avgScaled < b.avgScaled ? 1 : -1;
        if (a.totalStars !== b.totalStars) return a.totalStars < b.totalStars ? 1 : -1;
        return a.addr.toLowerCase().localeCompare(b.addr.toLowerCase());
      });

      setRows(next);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Failed to load results. (Wrong room / wrong network / game not ended yet)");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      {/* background */}
      <img
        src={bgImg}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* header */}
      <div style={{ position: "relative", zIndex: 3, padding: "18px 20px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div className="brand">
            <span className="brand-mark">★</span>
            <span className="brand-name">DressChain</span>
          </div>
          <button className="btn outline small" onClick={() => navigate("/")}>
            Back to Start
          </button>
        </div>
      </div>

      {/* ✅ PODIUM FIRST (NO BLUR PANEL) */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 20px", marginTop: 6 }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            height: 560,
            position: "relative",
            background: "transparent",
          }}
        >
          {top3.map((p, i) => {
            const pos = PODIUM_POS[i] || PODIUM_POS[PODIUM_POS.length - 1];
            const name = loadPlayerName(p.addr) || shortenAddress(p.addr);
            const avg = p.voteCount > 0n ? Number(p.avgScaled) / 1_000_000 : 0;

            // avatar/outfit size
            const baseW = 115;
            const baseH = 220;
            const w = Math.round(baseW * (pos.scale || 1));
            const h = Math.round(baseH * (pos.scale || 1));

            // badge goes ABOVE the avatar (absolute, doesn't change the avatar "feet" position)
            const badgeTop = -36; // tweak if you want higher/lower

            return (
              <div
                key={p.addr}
                style={{
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  transform: "translate(-50%, -100%)",
                }}
              >
                {/* wrapper keeps avatar position stable; badge is absolutely positioned above */}
                <div style={{ position: "relative", width: w, height: h, display: "grid", placeItems: "center" }}>
                  {/* ✅ BADGE ABOVE */}
                  <div
                    style={{
                      position: "absolute",
                      top: badgeTop,
                      left: "50%",
                      transform: "translateX(-50%)",
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(20, 12, 32, 0.55)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "white",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      maxWidth: 260,
                      pointerEvents: "none",
                      userSelect: "none",
                      boxShadow: "0 10px 18px rgba(0,0,0,0.18)",
                    }}
                    title={p.addr}
                  >
                    <b>#{i + 1}</b> {name} • {avg.toFixed(2)}★
                  </div>

                  {/* avatar/outfit */}
                  {p.outfitObj ? (
                    <div style={{ width: w, height: h, filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))" }}>
                      <OutfitStage outfit={p.outfitObj} width={w} height={h} nameMaps={NAME_MAPS} />
                    </div>
                  ) : (
                    <img
                      src={avatarForAddress(p.addr)}
                      alt=""
                      draggable={false}
                      style={{
                        width: w,
                        height: "auto",
                        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))",
                        userSelect: "none",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ RESULTS SECOND */}
      <div style={{ position: "relative", zIndex: 3, padding: "0 20px", marginTop: 10 }}>
        <div className="result-card" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ margin: 0 }}>Results</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <b>Room:</b> {shortenAddress(roomId)}
            </div>
            <div>
              <b>Topic:</b> {topicText(topicId)}
            </div>
            <div>
              <b>Final pot (on-chain):</b> {formatUnits(finalPot, tokenDecimals)} {tokenSymbol}
            </div>
            <div>
              <b>Payout per winner:</b> {formatUnits(payoutPerWinner, tokenDecimals)} {tokenSymbol}
            </div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
            Winners from contract:{" "}
            {winners?.length ? winners.map(shortenAddress).join(", ") : "— (not finalized yet)"}
          </div>

          {status && (
            <div className="status-bar" style={{ marginTop: 12 }}>
              {status}
            </div>
          )}
        </div>
      </div>

      {/* ✅ LEADERBOARD THIRD */}
      <div style={{ position: "relative", zIndex: 3, padding: "18px 20px 26px" }}>
        <div className="result-card result-leaderboard" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0 }}>Leaderboard (computed from totalStars/voteCount)</h3>

          {rows.length === 0 ? (
            <div style={{ opacity: 0.85 }}>No submitted outfits yet, or voting not happened.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.9 }}>
                    <th style={{ padding: "10px 8px" }}>Rank</th>
                    <th style={{ padding: "10px 8px" }}>Player</th>
                    <th style={{ padding: "10px 8px" }}>Avg ★</th>
                    <th style={{ padding: "10px 8px" }}>Total stars</th>
                    <th style={{ padding: "10px 8px" }}>Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const name = loadPlayerName(r.addr) || shortenAddress(r.addr);
                    const avg = r.voteCount > 0n ? Number(r.avgScaled) / 1_000_000 : 0;
                    const isWinner = winners?.some((w) => w.toLowerCase() === r.addr.toLowerCase());

                    return (
                      <tr key={r.addr} style={{ borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                        <td style={{ padding: "10px 8px" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {name} {isWinner ? <span style={{ marginLeft: 8 }}>🏆</span> : null}
                        </td>
                        <td style={{ padding: "10px 8px" }}>{avg.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px" }}>{r.totalStars.toString()}</td>
                        <td style={{ padding: "10px 8px" }}>{r.voteCount.toString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
