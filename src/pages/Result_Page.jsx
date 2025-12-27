import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import { formatUnits } from "ethers";
import { getProvider } from "../web3/eth";
import { topicText } from "../web3/topics";
import { assertAddresses, getAddresses, getRoom, getToken } from "../web3/contracts";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export default function Result_Page() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");

  const [topicId, setTopicId] = useState(0);
  const [winners, setWinners] = useState([]);
  const [finalPot, setFinalPot] = useState("0");
  const [payoutPerWinner, setPayoutPerWinner] = useState("0");

  const [tokenSymbol, setTokenSymbol] = useState("DCT");
  const [tokenDecimals, setTokenDecimals] = useState(18);

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

      const [tId, res, sym, dec] = await Promise.all([
        room.topicId(),
        room.getWinners(),
        token.symbol(),
        token.decimals(),
      ]);

      setTopicId(Number(tId));
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));

      // res = [winners[], finalPot, payoutPerWinner]
      setWinners(res[0]);
      setFinalPot(res[1].toString());
      setPayoutPerWinner(res[2].toString());
    } catch (e) {
      console.error(e);
      setStatus("Failed to load results. Maybe game not finalized yet.");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <div className="page-root">
      <div className="card">
        <h2>Results</h2>

        <div style={{ marginBottom: 8 }}>
          <b>Room:</b> {shortenAddress(roomId)}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Topic:</b> {topicText(topicId)}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Final pot:</b> {formatUnits(finalPot, tokenDecimals)} {tokenSymbol}
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Payout per winner:</b> {formatUnits(payoutPerWinner, tokenDecimals)} {tokenSymbol}
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>Winners {winners.length > 1 ? "(Tie!)" : ""}</h3>
          {winners.length === 0 ? (
            <div>No winners yet (finalize not done)</div>
          ) : (
            <ol>
              {winners.map((w) => (
                <li key={w}>{shortenAddress(w)}</li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => navigate("/")}>
            Back to Start
          </button>
        </div>

        {status && <div className="status-bar">{status}</div>}
      </div>
    </div>
  );
}
