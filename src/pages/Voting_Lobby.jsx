import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { assertAddresses, getAddresses, getRoom } from "../web3/contracts";

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export default function Voting_Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [phase, setPhase] = useState(0);
  const [players, setPlayers] = useState([]);
  const [outfits, setOutfits] = useState({}); // addr => outfitCode
  const [ratings, setRatings] = useState({}); // addr => stars 0..5

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

      const [ph, plist] = await Promise.all([room.phase(), room.getPlayers()]);
      const phNum = Number(ph);
      setPhase(phNum);
      setPlayers(plist);

      // load outfits (only those submitted)
      const nextOutfits = {};
      for (const p of plist) {
        const [has, code] = await room.getOutfit(p);
        if (has) nextOutfits[p] = code.toString();
      }
      setOutfits(nextOutfits);
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
  }, [roomId]);

  useEffect(() => {
    if (phase === 3) navigate(`/result/${roomId}`);
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

    const targets = [];
    const stars = [];

    for (const p of players) {
      if (p.toLowerCase() === account.toLowerCase()) continue;
      if (!outfits[p]) continue; // vote only submitted outfits

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

  return (
    <div className="page-root">
      <div className="card">
        <h2>Voting</h2>
        <div style={{ marginBottom: 8 }}>
          <b>Room:</b> {shortenAddress(roomId)}
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>Phase:</b> {PHASE[phase] ?? phase}
        </div>

        <button className="btn primary" onClick={onConnect}>
          {account ? `Connected: ${shortenAddress(account)}` : "Connect MetaMask (Sepolia)"}
        </button>

        <div style={{ marginTop: 16 }}>
          <h3>Rate outfits (0..5 stars)</h3>

          {players
            .filter((p) => p.toLowerCase() !== (account || "").toLowerCase())
            .filter((p) => outfits[p])
            .map((p) => (
              <div key={p} style={{ marginBottom: 10 }}>
                <div>
                  <b>{shortenAddress(p)}</b> — outfitCode: <span>{outfits[p]}</span>
                </div>
                <select value={ratings[p] ?? 0} onChange={(e) => setStar(p, e.target.value)}>
                  {[0, 1, 2, 3, 4, 5].map((x) => (
                    <option key={x} value={x}>
                      {x} ★
                    </option>
                  ))}
                </select>
              </div>
            ))}

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={submitVotes}>
              Submit Votes
            </button>
            <button className="btn" style={{ marginLeft: 10 }} onClick={finalize}>
              Finalize (pays winners)
            </button>
          </div>
        </div>

        {status && <div className="status-bar">{status}</div>}
      </div>
    </div>
  );
}
