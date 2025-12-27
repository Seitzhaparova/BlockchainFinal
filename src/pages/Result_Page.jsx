// src/pages/Result_Page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { formatUnits } from "ethers";
import { getProvider } from "../web3/eth";
import { topicText } from "../web3/topics";
import { assertAddresses, getAddresses, getRoom, getToken } from "../web3/contracts";

// Podium background
import bgImg from "../assets/results/background.png";

// Fallback girl avatars
import girl1 from "../assets/icons_girls/girl1.png";
import girl2 from "../assets/icons_girls/girl2.png";
import girl3 from "../assets/icons_girls/girl3.png";
import girl4 from "../assets/icons_girls/girl4.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
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

// rank positions on background (tune if needed)
const PODIUM_POS = [
  // 1st
  { left: "50%", top: "52%", scale: 1.15 },
  // 2nd
  { left: "29%", top: "61%", scale: 1.0 },
  // 3rd
  { left: "71%", top: "63%", scale: 1.0 },
];

export default function Result_Page() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");

  const [topicId, setTopicId] = useState(0);

  const [tokenSymbol, setTokenSymbol] = useState("DCT");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [finalPot, setFinalPot] = useState("0");
  const [payoutPerWinner, setPayoutPerWinner] = useState("0");
  const [winners, setWinners] = useState([]);

  const [rows, setRows] = useState([]); // sorted leaderboard (all submitted)
  const top3 = useMemo(() => rows.slice(0, 3), [rows]);

  const { token: TOKEN_ADDR } = getAddresses();
  const hasConfig = useMemo(() => {
    try {
      assertAddresses();
      return true;
    } catch {
      return false;
    }
  }, [TOKEN_ADDR]);

  async function refresh() {
    if (!hasConfig) return;

    try {
      const provider = await getProvider();
      const room = getRoom(roomId, provider);
      const token = getToken(TOKEN_ADDR, provider);

      const [tId, plist, sym, dec, res] = await Promise.all([
        room.topicId(),
        room.getPlayers(),
        token.symbol(),
        token.decimals(),
        room.getWinners(), // (winners, finalPot, payoutPerWinner) after finalize
      ]);

      setTopicId(Number(tId));
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));

      setWinners(res[0] || []);
      setFinalPot((res[1] || 0n).toString());
      setPayoutPerWinner((res[2] || 0n).toString());

      // Build leaderboard from on-chain totalStars/voteCount for submitted outfits
      const next = [];

      // NOTE: room.getOutfit is the safest "submitted?" check
      // totalStars/voteCount are public mappings in contract
      const promises = plist.map(async (p) => {
        const [has, code] = await room.getOutfit(p);
        if (!has) return;

        const [ts, vc] = await Promise.all([room.totalStars(p), room.voteCount(p)]);

        const tsBI = BigInt(ts.toString());
        const vcBI = BigInt(vc.toString());

        // avgScaled = avg * 1e6 to sort deterministically
        const avgScaled = vcBI > 0n ? (tsBI * 1_000_000n) / vcBI : 0n;

        next.push({
          addr: p,
          outfitCode: code.toString(),
          totalStars: tsBI,
          voteCount: vcBI,
          avgScaled,
        });
      });

      await Promise.all(promises);

      next.sort((a, b) => {
        if (a.avgScaled !== b.avgScaled) return a.avgScaled < b.avgScaled ? 1 : -1;
        if (a.totalStars !== b.totalStars) return a.totalStars < b.totalStars ? 1 : -1;
        // stable tiebreaker
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
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
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

      {/* Top bar */}
      <div style={{ position: "relative", zIndex: 2, padding: "18px 20px" }}>
        <div className="brand" style={{ marginBottom: 10 }}>
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>

        <div
          className="card"
          style={{
            maxWidth: 980,
            margin: "0 auto",
            backdropFilter: "blur(10px)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Results</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

          {status && <div className="status-bar" style={{ marginTop: 12 }}>{status}</div>}
        </div>
      </div>

      {/* Podium avatars */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {top3.map((p, i) => {
          const pos = PODIUM_POS[i] || PODIUM_POS[PODIUM_POS.length - 1];
          const name = loadPlayerName(p.addr) || shortenAddress(p.addr);
          const avg = p.voteCount > 0n ? Number(p.avgScaled) / 1_000_000 : 0;

          return (
            <div
              key={p.addr}
              style={{
                position: "absolute",
                left: pos.left,
                top: pos.top,
                transform: "translate(-50%, -100%)",
                textAlign: "center",
              }}
            >
              <img
                src={avatarForAddress(p.addr)}
                alt=""
                draggable={false}
                style={{
                  width: `${90 * pos.scale}px`,
                  height: "auto",
                  filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(10,10,20,0.55)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "white",
                  fontSize: 12,
                  backdropFilter: "blur(8px)",
                  maxWidth: 220,
                }}
              >
                <b>#{i + 1}</b> {name} • {avg.toFixed(2)}★
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 20px 24px" }}>
        <div className="card" style={{ maxWidth: 980, margin: "520px auto 0 auto" }}>
          <h3 style={{ marginTop: 0 }}>Leaderboard (computed from totalStars/voteCount)</h3>

          {rows.length === 0 ? (
            <div style={{ opacity: 0.85 }}>No submitted outfits yet, or voting not happened.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.85 }}>
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

                    return (
                      <tr key={r.addr} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                        <td style={{ padding: "10px 8px" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {name}{" "}
                          {winners?.some((w) => w.toLowerCase() === r.addr.toLowerCase()) ? (
                            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>🏆</span>
                          ) : null}
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

          <div style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => navigate("/")}>
              Back to Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
