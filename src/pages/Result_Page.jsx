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

// Podium background
import bgImg from "../assets/results/background.png";

// Fallback girl avatars (used only if outfit decode fails)
import girl1 from "../assets/icons_girls/girl1.png";
import girl2 from "../assets/icons_girls/girl2.png";
import girl3 from "../assets/icons_girls/girl3.png";
import girl4 from "../assets/icons_girls/girl4.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function isZeroAddress(a) {
  return (
    !a ||
    a === "0x0000000000000000000000000000000000000000" ||
    a.toLowerCase?.() === "0x0000000000000000000000000000000000000000"
  );
}

// optional: show saved name (Nasiba UI stored it here)
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

/**
 * Podium positions INSIDE the podium container.
 * (You can tweak these if you want.)
 */
const PODIUM_POS = [
  { left: "50%", top: "72%", scale: 1.0 }, // 1st
  { left: "31%", top: "82%", scale: 0.9 }, // 2nd
  { left: "69%", top: "84%", scale: 0.9 }, // 3rd
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

  const [rows, setRows] = useState([]); // sorted leaderboard (all submitted)
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
      const tokenToUse = tokenAddr && !isZeroAddress(tokenAddr) ? tokenAddr : tokenEnv;

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

      // leaderboard from totalStars/voteCount for submitted outfits
      const entries = await Promise.all(
        (Array.isArray(plist) ? plist : []).map(async (p) => {
          const [has, code] = await room.getOutfit(p);
          if (!has) return null;

          const [ts, vc] = await Promise.all([room.totalStars(p), room.voteCount(p)]);
          const tsBI = BigInt(ts.toString());
          const vcBI = BigInt(vc.toString());
          const avgScaled = vcBI > 0n ? (tsBI * 1_000_000n) / vcBI : 0n;

          // ✅ decode outfit for podium render (same as Voting)
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
    <div
      className="result-root"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
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

      {/* Header (brand + back) */}
      <div style={{ position: "relative", zIndex: 3, padding: "16px 20px 0" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className="brand">
            <span className="brand-mark">★</span>
            <span className="brand-name">DressChain</span>
          </div>

          <button className="btn outline small" onClick={() => navigate("/")}>
            Back to Start
          </button>
        </div>
      </div>

      {/* ✅ 1) PODIUM FIRST */}
      <section style={{ position: "relative", zIndex: 2, padding: "12px 20px 0" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            borderRadius: 26,
            overflow: "hidden",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(6px)",
          }}
        >
          {/* this box controls podium height */}
          <div style={{ position: "relative", height: "min(720px, 72vh)" }}>
            {/* absolute podium layer inside this container */}
            <div style={{ position: "absolute", inset: 0 }}>
              {top3.map((p, i) => {
                const pos = PODIUM_POS[i] || PODIUM_POS[PODIUM_POS.length - 1];
                const name = loadPlayerName(p.addr) || shortenAddress(p.addr);
                const avg = p.voteCount > 0n ? Number(p.avgScaled) / 1_000_000 : 0;

                // size for OutfitStage
                const baseW = 140;
                const baseH = 240;
                const w = Math.round(baseW * (pos.scale || 1));
                const h = Math.round(baseH * (pos.scale || 1));

                return (
                  <div
                    key={p.addr}
                    style={{
                      position: "absolute",
                      left: pos.left,
                      top: pos.top,
                      transform: "translate(-50%, -100%)",
                      textAlign: "center",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {/* real outfit (preferred), fallback avatar */}
                    {p.outfitObj ? (
                      <div
                        style={{
                          width: w,
                          height: h,
                          filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
                        }}
                      >
                        <OutfitStage outfit={p.outfitObj} width={w} height={h} nameMaps={NAME_MAPS} />
                      </div>
                    ) : (
                      <img
                        src={avatarForAddress(p.addr)}
                        alt=""
                        draggable={false}
                        style={{
                          width: `${95 * (pos.scale || 1)}px`,
                          height: "auto",
                          filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
                        }}
                      />
                    )}

                    <div className="result-badge" title={p.addr} style={{ marginTop: 8 }}>
                      <b>#{i + 1}</b> {name} • {avg.toFixed(2)}★
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ✅ 2) RESULTS INFO SECOND */}
      <section style={{ position: "relative", zIndex: 3, padding: "14px 20px 0" }}>
        <div className="result-card" style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Results</h2>
          </div>

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
      </section>

      {/* ✅ 3) LEADERBOARD THIRD */}
      <section style={{ position: "relative", zIndex: 3, padding: "14px 20px 26px" }}>
        <div className="result-card result-leaderboard" style={{ maxWidth: 980, margin: "0 auto" }}>
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
      </section>
    </div>
  );
}
