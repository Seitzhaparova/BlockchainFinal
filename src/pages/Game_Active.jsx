import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { topicText } from "../web3/topics";
import { assertAddresses, getAddresses, getRoom } from "../web3/contracts";

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export default function Game_Active() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [topicId, setTopicId] = useState(0);
  const [phase, setPhase] = useState(0);

  // Minimal outfit input (you can replace this later with your full dress-up UI)
  const [outfitCode, setOutfitCode] = useState("0");

  const { token: TOKEN_ADDR, factory: FACTORY_ADDR } = getAddresses();
  const hasConfig = useMemo(() => {
    try {
      assertAddresses();
      return true;
    } catch {
      return false;
    }
  }, [TOKEN_ADDR, FACTORY_ADDR]);

  async function refresh() {
    if (!hasConfig) return;
    try {
      const provider = await getProvider();
      const room = getRoom(roomId, provider);

      const [tId, ph] = await Promise.all([room.topicId(), room.phase()]);
      setTopicId(Number(tId));
      setPhase(Number(ph));
    } catch (e) {
      console.error(e);
      setStatus("Failed to load room (wrong address or not Sepolia).");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (phase === 2) navigate(`/voting/${roomId}`);
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

  async function submit() {
    if (!account) return setStatus("Connect wallet first.");
    try {
      setStatus("Submitting outfit... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const tx = await room.submitOutfit(BigInt(outfitCode || "0"));
      await tx.wait();

      setStatus("Outfit submitted ✅ (wait for voting)");
    } catch (e) {
      console.error(e);
      setStatus("Submit failed (must be in Styling phase, only joined players).");
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
      navigate(`/voting/${roomId}`);
    } catch (e) {
      console.error(e);
      setStatus("Start voting failed (only host, need 2+ outfits and deadline/all submitted).");
    }
  }

  return (
    <div className="page-root">
      <div className="card">
        <h2>Game Active</h2>
        <div style={{ marginBottom: 8 }}>
          <b>Room:</b> {shortenAddress(roomId)}
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>Phase:</b> {PHASE[phase] ?? phase}
        </div>

        <div style={{ margin: "14px 0", fontSize: 18 }}>
          👗 <b>I need to dress for:</b> {topicText(topicId)}
        </div>

        <button className="btn primary" onClick={onConnect}>
          {account ? `Connected: ${shortenAddress(account)}` : "Connect MetaMask (Sepolia)"}
        </button>

        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <b>Outfit code</b> (temporary):
          </div>
          <input
            className="join-input"
            value={outfitCode}
            onChange={(e) => setOutfitCode(e.target.value)}
            placeholder="uint256 (e.g., 12345)"
          />

          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={submit}>
              Submit Outfit (on-chain)
            </button>
            <button className="btn" style={{ marginLeft: 10 }} onClick={startVoting}>
              Host: Start Voting
            </button>
          </div>
        </div>

        {status && <div className="status-bar">{status}</div>}
      </div>
    </div>
  );
}
