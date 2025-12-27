// src/pages/Voting_Lobby.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { assertAddresses, getAddresses, getRoom } from "../web3/contracts";

import OutfitStage from "../components/OutfitStage.jsx";
import { ASSETS, NAME_MAPS } from "../utils/assetCatalogs";
import { decodeOutfit } from "../utils/outfitCodec";

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

function StarRow({ value, onChange, disabled }) {
  const v = Number(value) || 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          disabled={disabled}
          onClick={() => onChange(s)}
          className="btn outline small"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            opacity: disabled ? 0.65 : 1,
            background: s === v ? "rgba(255, 77, 166, 0.18)" : "rgba(255,255,255,0.75)",
          }}
        >
          {s} ★
        </button>
      ))}
    </div>
  );
}

export default function Voting_Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const assets = ASSETS;

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [phase, setPhase] = useState(0);
  const [players, setPlayers] = useState([]);
  const [votingDeadline, setVotingDeadline] = useState(0);

  const [hasVoted, setHasVoted] = useState(false);

  const [outfitCodes, setOutfitCodes] = useState({}); // addr -> string code
  const [decoded, setDecoded] = useState({}); // addr -> outfit obj
  const [ratings, setRatings] = useState({}); // addr -> 0..5

  const [timeLeft, setTimeLeft] = useState(0);

  const { token: TOKEN_ADDR } = getAddresses();
  const hasConfig = useMemo(() => {
    try {
      assertAddresses();
      return true;
    } catch {
      return false;
    }
  }, [TOKEN_ADDR]);

  useEffect(() => {
    (async () => {
      try {
        const provider = await getProvider().catch(() => null);
        if (!provider) return;
        const accounts = await provider.send("eth_accounts", []);
        if (accounts?.[0]) setAccount(accounts[0]);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!hasConfig) return;
    try {
      const provider = await getProvider();
      const room = getRoom(roomId, provider);

      const [ph, plist, dl] = await Promise.all([room.phase(), room.getPlayers(), room.votingDeadline()]);
      const phNum = Number(ph);

      setPhase(phNum);
      setPlayers(plist);
      setVotingDeadline(Number(dl));

      const nextCodes = {};
      for (const p of plist) {
        const [has, code] = await room.getOutfit(p);
        if (has) nextCodes[p] = code.toString();
      }
      setOutfitCodes(nextCodes);

      const nextDecoded = {};
      for (const [addr, codeStr] of Object.entries(nextCodes)) {
        nextDecoded[addr] = decodeOutfit(BigInt(codeStr), assets);
      }
      setDecoded(nextDecoded);

      // init ratings defaults (0) for all targets except self
      setRatings((prev) => {
        const next = { ...prev };
        for (const p of plist) {
          if (account && p.toLowerCase() === account.toLowerCase()) continue;
          if (!nextCodes[p]) continue;
          if (next[p] === undefined) next[p] = 0;
        }
        return next;
      });

      if (account) {
        const hv = await room.hasVoted(account);
        setHasVoted(Boolean(hv));
      }
    } catch (e) {
      console.error(e);
      setStatus("Failed to load voting data.");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, account]);

  // timer
  useEffect(() => {
    const t = setInterval(() => {
      if (!votingDeadline) return setTimeLeft(0);
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, votingDeadline - now));
    }, 500);
    return () => clearInterval(t);
  }, [votingDeadline]);

  useEffect(() => {
    if (phase === 3) navigate(`/result/${roomId}`);
    if (phase === 1) navigate(`/active/${roomId}`);
    if (phase === 0) navigate(`/lobby/${roomId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function onConnect() {
    try {
      setStatus("");
      const acc = await connectWallet();
      setAccount(acc);
      setStatus("Wallet connected ✅");
    } catch (e) {
      console.error(e);
      setStatus("Connect failed (Sepolia + MetaMask).");
    }
  }

  function setStar(target, stars) {
    setRatings((prev) => ({ ...prev, [target]: Number(stars) }));
  }

  async function submitVotes() {
    if (!account) return setStatus("Connect wallet first.");
    if (hasVoted) return setStatus("You already voted ✅");

    const targets = [];
    const stars = [];

    for (const p of players) {
      if (p.toLowerCase() === account.toLowerCase()) continue;
      if (!outfitCodes[p]) continue; // vote only for submitted outfits
      targets.push(p);
      stars.push(Number(ratings[p] ?? 0));
    }

    if (targets.length === 0) return setStatus("No available outfits to vote.");

    try {
      setStatus("Submitting votes... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const tx = await room.castVotes(targets, stars);
      await tx.wait();

      setStatus("Votes submitted ✅ (wait for finalize)");
      setHasVoted(true);
    } catch (e) {
      console.error(e);
      setStatus("Vote failed (must be in Voting phase, only joined players, one vote per player).");
    }
  }

  async function finalize() {
    try {
      setStatus("Finalizing... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const tx = await room.finalize();
      await tx.wait();

      setStatus("Finalized ✅");
      navigate(`/result/${roomId}`);
    } catch (e) {
      console.error(e);
      setStatus("Finalize failed (wait for deadline or all players voted).");
    }
  }

  const targets = players
    .filter((p) => !account || p.toLowerCase() !== account.toLowerCase())
    .filter((p) => outfitCodes[p]);

  const timeIsUp = timeLeft <= 0 && votingDeadline > 0;

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

      <main style={{ padding: "18px 16px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div
          style={{
            borderRadius: 22,
            padding: 16,
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 18px 40px rgba(33, 7, 58, 0.18)",
          }}
        >
          <div className="voting-top">
            <div>
              <h2 style={{ margin: 0 }}>Voting</h2>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Room: <b>{shortenAddress(roomId)}</b> • Phase: <b>{PHASE[phase] ?? phase}</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Voting timer: <b>{votingDeadline ? fmtTime(timeLeft) : "--:--"}</b>{" "}
                {timeIsUp ? <span style={{ marginLeft: 6 }}>(time up)</span> : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
              <button className="btn outline small" onClick={onConnect}>
                {account ? "Wallet connected" : "Connect wallet"}
              </button>
              <button className="btn primary" onClick={submitVotes} disabled={!account || hasVoted || phase !== 2}>
                {hasVoted ? "Voted ✅" : "Submit Votes (on-chain)"}
              </button>
              <button className="btn" onClick={finalize} disabled={phase !== 2}>
                Finalize (pays winners)
              </button>
            </div>
          </div>

          <div className="voting-instructions">
            Rate each submitted outfit with <b>0..5 stars</b>. Your vote is one transaction on Sepolia.
          </div>

          <div className="voting-players">
            {targets.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No submitted outfits yet.</div>
            ) : (
              targets.map((p) => {
                const outfitObj = decoded[p];
                return (
                  <div
                    key={p}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      gap: 14,
                      padding: 12,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.75)",
                      border: "1px solid rgba(0,0,0,0.10)",
                    }}
                  >
                    <div style={{ display: "grid", placeItems: "center" }}>
                      {outfitObj ? (
                        <OutfitStage outfit={outfitObj} width={160} height={260} nameMaps={NAME_MAPS} />
                      ) : (
                        <div style={{ opacity: 0.8 }}>Loading…</div>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{shortenAddress(p)}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>outfitCode: {outfitCodes[p]}</div>
                        </div>
                      </div>

                      <StarRow
                        value={ratings[p] ?? 0}
                        onChange={(s) => setStar(p, s)}
                        disabled={!account || hasVoted || phase !== 2}
                      />
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Tip: you can still give <b>0</b> if you don’t like it.
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {status && <div className="status-bar">{status}</div>}
        </div>
      </main>
    </div>
  );
}
