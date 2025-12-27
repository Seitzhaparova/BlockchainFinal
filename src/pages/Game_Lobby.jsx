import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { formatUnits } from "ethers";
import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { topicText } from "../web3/topics";
import { assertAddresses, getAddresses, getFactory, getRoom, getToken } from "../web3/contracts";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

const PHASE = ["Lobby", "Styling", "Voting", "Ended", "Canceled"];

export default function Game_Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [topicId, setTopicId] = useState(0);
  const [host, setHost] = useState("");
  const [betAmount, setBetAmount] = useState("0");
  const [betPretty, setBetPretty] = useState("0");
  const [tokenSymbol, setTokenSymbol] = useState("DCT");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [phase, setPhase] = useState(0);
  const [players, setPlayers] = useState([]);

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
      const token = getToken(TOKEN_ADDR, provider);

      const [tId, h, bet, ph, plist, sym, dec] = await Promise.all([
        room.topicId(),
        room.host(),
        room.betAmount(),
        room.phase(),
        room.getPlayers(),
        token.symbol(),
        token.decimals(),
      ]);

      setTopicId(Number(tId));
      setHost(h);
      setBetAmount(bet.toString());
      setPhase(Number(ph));
      setPlayers(plist);
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));
      setBetPretty(formatUnits(bet, Number(dec)));
    } catch (e) {
      console.error(e);
      setStatus("Failed to load room (wrong address or not deployed on Sepolia).");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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

  async function approveAndJoin() {
    if (!hasConfig) return setStatus("Missing addresses in .env.");
    if (!account) return setStatus("Connect wallet first.");

    try {
      setStatus("Preparing approval...");

      const signer = await getSigner();
      const factory = getFactory(FACTORY_ADDR, signer);
      const bankAddr = await factory.bank();

      const token = getToken(TOKEN_ADDR, signer);
      const allowance = await token.allowance(account, bankAddr);

      if (allowance < BigInt(betAmount)) {
        setStatus("Approving tokens... confirm MetaMask");
        const txA = await token.approve(bankAddr, betAmount);
        await txA.wait();
      }

      setStatus("Joining room... confirm MetaMask");
      const room = getRoom(roomId, signer);
      const txJ = await room.joinGame();
      await txJ.wait();

      setStatus("Joined ✅");
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus("Join failed. Common reasons: no tokens, no approval, wrong network.");
    }
  }

  async function startGame() {
    if (!account) return setStatus("Connect wallet first.");
    try {
      setStatus("Starting game... confirm MetaMask");
      const signer = await getSigner();
      const room = getRoom(roomId, signer);

      const tx = await room.startGame();
      await tx.wait();

      setStatus("Game started ✅");
      navigate(`/active/${roomId}`);
    } catch (e) {
      console.error(e);
      setStatus("Start failed (only host can start, need 2+ players).");
    }
  }

  // Auto-redirect if phase changes
  useEffect(() => {
    if (phase === 1) navigate(`/active/${roomId}`);
    if (phase === 2) navigate(`/voting/${roomId}`);
    if (phase === 3) navigate(`/result/${roomId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const isHost = account && host && account.toLowerCase() === host.toLowerCase();

  return (
    <div className="page-root">
      <div className="card">
        <h2>Game Lobby</h2>

        <div style={{ marginBottom: 8 }}>
          <b>Room:</b> {shortenAddress(roomId)}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Topic:</b> {topicText(topicId)}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Bet:</b> {betPretty} {tokenSymbol}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Host:</b> {shortenAddress(host)}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Phase:</b> {PHASE[phase] ?? phase}
        </div>

        <button className="btn primary" onClick={onConnect}>
          {account ? `Connected: ${shortenAddress(account)}` : "Connect MetaMask (Sepolia)"}
        </button>

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={approveAndJoin}>
            Approve + Join (pay bet to bank)
          </button>

          {isHost && (
            <button className="btn" style={{ marginLeft: 10 }} onClick={startGame}>
              Start Game (2+ players)
            </button>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>Players ({players.length})</h3>
          <ul>
            {players.map((p) => (
              <li key={p}>{shortenAddress(p)}</li>
            ))}
          </ul>
        </div>

        {status && <div className="status-bar">{status}</div>}
      </div>
    </div>
  );
}
