// src/pages/Start_Page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../main_page.css";

import { formatUnits, parseEther, parseUnits, isAddress } from "ethers";
import { connectWallet, getProvider, getSigner } from "../web3/eth";
import { TOPICS } from "../web3/topics";
import {
  assertAddresses,
  getAddresses,
  getFactory,
  getToken,
  getTokenSale,
} from "../web3/contracts";

// ✅ fix for assistant image (Vite way)
import assistantImg from "../assets/characters/girl1.png";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export default function Start_Page() {
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");

  const [tokenSymbol, setTokenSymbol] = useState("DCT");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenBalance, setTokenBalance] = useState("0");

  const [tokensPerEth, setTokensPerEth] = useState(null);
  const [saleEthLiquidity, setSaleEthLiquidity] = useState("0");

  const [ethToSpend, setEthToSpend] = useState("");
  const [tokensToSell, setTokensToSell] = useState("");
  const [sellQuoteEth, setSellQuoteEth] = useState("");

  const [betTokens, setBetTokens] = useState("10");
  const [maxPlayers, setMaxPlayers] = useState("4");

  const [topicMode, setTopicMode] = useState("random"); // "random" | "fixed"
  const [topicFixed, setTopicFixed] = useState("0");

  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [recentRooms, setRecentRooms] = useState([]);

  const { token: TOKEN_ADDR, sale: SALE_ADDR, factory: FACTORY_ADDR } = getAddresses();

  const hasConfig = useMemo(() => {
    try {
      assertAddresses();
      return true;
    } catch {
      return false;
    }
  }, [TOKEN_ADDR, SALE_ADDR, FACTORY_ADDR]);

  function loadRecents() {
    try {
      const raw = localStorage.getItem("dc_recent_rooms");
      const arr = raw ? JSON.parse(raw) : [];
      setRecentRooms(Array.isArray(arr) ? arr : []);
    } catch {
      setRecentRooms([]);
    }
  }

  function pushRecent(roomAddr) {
    try {
      const raw = localStorage.getItem("dc_recent_rooms");
      const arr = raw ? JSON.parse(raw) : [];
      const next = [roomAddr, ...arr.filter((x) => x !== roomAddr)].slice(0, 8);
      localStorage.setItem("dc_recent_rooms", JSON.stringify(next));
      setRecentRooms(next);
    } catch {}
  }

  async function refresh() {
    if (!hasConfig || !account) return;

    try {
      const provider = await getProvider();
      const token = getToken(TOKEN_ADDR, provider);
      const sale = getTokenSale(SALE_ADDR, provider);

      const [sym, dec, bal] = await Promise.all([
        token.symbol(),
        token.decimals(),
        token.balanceOf(account),
      ]);

      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));
      setTokenBalance(formatUnits(bal, Number(dec)));

      // rate + liquidity (don’t let UI break if sale call fails)
      try {
        const rate = await sale.tokensPerEth();
        setTokensPerEth(rate.toString());
      } catch {
        setTokensPerEth(null);
      }

      try {
        const ethBal = await provider.getBalance(SALE_ADDR);
        setSaleEthLiquidity(formatUnits(ethBal, 18));
      } catch {
        setSaleEthLiquidity("0");
      }
    } catch (e) {
      console.error(e);
    }
  }

  // estimate ETH you’ll receive for selling tokens
  useEffect(() => {
    (async () => {
      if (!hasConfig || !SALE_ADDR) return setSellQuoteEth("");
      const t = String(tokensToSell || "").replace(",", ".").trim();
      const n = Number(t);
      if (!Number.isFinite(n) || n <= 0) return setSellQuoteEth("");

      try {
        const provider = await getProvider();
        const sale = getTokenSale(SALE_ADDR, provider);
        const amt = parseUnits(t, tokenDecimals);

        // contract quote
        const ethOut = await sale.quoteEthForTokens(amt);
        setSellQuoteEth(formatUnits(ethOut, 18));
      } catch {
        setSellQuoteEth("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensToSell, tokenDecimals, hasConfig, SALE_ADDR]);

  useEffect(() => {
    loadRecents();
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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function onConnect() {
    try {
      setStatus("");
      const acc = await connectWallet();
      setAccount(acc);
      setStatus("Wallet connected ✅");
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus("Failed to connect wallet (make sure Sepolia is selected).");
    }
  }

  async function buyTokens() {
    if (!hasConfig) return setStatus("Missing .env contract addresses.");
    if (!account) return setStatus("Connect wallet first.");

    const ethStr = String(ethToSpend).replace(",", ".").trim();
    const ethNum = Number(ethStr);
    if (!Number.isFinite(ethNum) || ethNum <= 0) return setStatus("Enter ETH amount > 0");

    try {
      setStatus("Buying tokens... confirm MetaMask");
      const signer = await getSigner();
      const sale = getTokenSale(SALE_ADDR, signer);

      const tx = await sale.buyTokens({ value: parseEther(ethStr) });
      await tx.wait();

      setStatus("Tokens purchased ✅");
      setEthToSpend("");
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus("Buy failed. Check Sepolia ETH + TokenSale funded with tokens.");
    }
  }

  async function sellTokensForEth() {
    if (!hasConfig) return setStatus("Missing .env contract addresses.");
    if (!account) return setStatus("Connect wallet first.");

    const tStr = String(tokensToSell).replace(",", ".").trim();
    const tNum = Number(tStr);
    if (!Number.isFinite(tNum) || tNum <= 0) return setStatus("Enter token amount > 0");

    try {
      setStatus("Selling tokens... confirm MetaMask (approve + sell)");
      const signer = await getSigner();
      const token = getToken(TOKEN_ADDR, signer);
      const sale = getTokenSale(SALE_ADDR, signer);

      const amt = parseUnits(tStr, tokenDecimals);

      // approve if needed
      const allowance = await token.allowance(account, SALE_ADDR);
      if (allowance < amt) {
        const txA = await token.approve(SALE_ADDR, amt);
        await txA.wait();
      }

      // sell
      const tx = await sale.sellTokens(amt);
      await tx.wait();

      setStatus("Sold ✅ ETH sent to your wallet");
      setTokensToSell("");
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus("Sell failed. Sale must have enough ETH liquidity + you need gas ETH.");
    }
  }

    async function createGame() {
      if (!hasConfig) return setStatus("Missing .env contract addresses.");
      if (!account) return setStatus("Connect wallet first.");

      const mp = Math.max(2, Math.min(10, Number(maxPlayers) || 4));

      const topicId =
        topicMode === "fixed"
          ? Math.max(0, Math.min(TOPICS.length - 1, Number(topicFixed) || 0))
          : Math.floor(Math.random() * TOPICS.length);

      try {
        setStatus("Creating game... confirm MetaMask");
        const signer = await getSigner();
        const factory = getFactory(FACTORY_ADDR, signer);

        const betUnits = parseUnits(String(betTokens || "0"), tokenDecimals);

        // keep your current call (since tx succeeds)
        const tx = await factory.createGame(betUnits, mp, topicId);
        const receipt = await tx.wait();

        let roomAddr = null;

        // 1) Parse logs only from the FACTORY address
        for (const log of receipt.logs) {
          if (!log?.address) continue;
          if (log.address.toLowerCase() !== FACTORY_ADDR.toLowerCase()) continue;

          try {
            const parsed = factory.interface.parseLog(log);

            // Accept both common event names
            if (parsed?.name === "GameCreated" || parsed?.name === "RoomCreated") {
              // safest: first event argument is the new room address
              roomAddr =
                parsed.args?.gameAddress ||
                parsed.args?.room ||
                parsed.args?.game ||
                parsed.args?.[0];

              break;
            }
          } catch {
            // ignore non-matching logs
          }
        }

        // 2) Fallback: query events from that block (super reliable)
        if (!roomAddr) {
          try {
            const fromBlock = receipt.blockNumber;
            const toBlock = receipt.blockNumber;

            // try both filters if ABI has them
            const ev1 = factory.filters?.GameCreated?.();
            const ev2 = factory.filters?.RoomCreated?.();

            const [logs1, logs2] = await Promise.all([
              ev1 ? factory.queryFilter(ev1, fromBlock, toBlock) : Promise.resolve([]),
              ev2 ? factory.queryFilter(ev2, fromBlock, toBlock) : Promise.resolve([]),
            ]);

            const all = [...logs1, ...logs2];

            const mine = all.find((e) => e.transactionHash === receipt.hash) || all[all.length - 1];
            if (mine?.args) {
              roomAddr =
                mine.args.gameAddress ||
                mine.args.room ||
                mine.args.game ||
                mine.args[0];
            }
          } catch {}
        }

        if (!roomAddr || !isAddress(roomAddr)) {
          setStatus("Game created, but room address not detected. (Event parsing issue)");
          return;
        }

        pushRecent(roomAddr);
        setStatus("Game created ✅");
        navigate(`/lobby/${roomAddr}`);
      } catch (e) {
        console.error(e);
        setStatus("Create failed. Check deployment + Sepolia.");
      }
    }


  function joinGame() {
    const id = joinRoomInput.trim();
    if (!isAddress(id)) return setStatus("Paste GameRoom address (0x...)");
    pushRecent(id);
    navigate(`/lobby/${id}`);
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
          <div className="wallet-balance">
            <span className="wallet-label">Balance</span>
            <span className="wallet-balance-value">
              {tokenBalance} {tokenSymbol}
            </span>
          </div>
          <span className="wallet-sep" />
          {account ? (
            <span className="wallet-address">{shortenAddress(account)}</span>
          ) : (
            <span className="wallet-disconnected">Not connected</span>
          )}
        </div>
      </header>

      <main className="start-main">
        <div className="start-card">
          <h1 className="start-title">Multiplayer On-Chain Dress-Up</h1>

          {!hasConfig && (
            <div className="status-bar">
              ⚠️ Add deployed addresses into <b>.env</b>: VITE_TOKEN_ADDRESS / VITE_TOKEN_SALE_ADDRESS / VITE_GAME_FACTORY_ADDRESS
            </div>
          )}

          <button className="btn primary" onClick={onConnect}>
            {account ? "Wallet connected" : "Connect MetaMask (Sepolia)"}
          </button>

          {/* BUY */}
          <div className="buy-section">
            <div className="buy-label">
              Buy tokens with ETH{" "}
              {tokensPerEth
                ? `(rate: ${formatUnits(tokensPerEth, tokenDecimals)} ${tokenSymbol} / 1 ETH)`
                : ""}
            </div>
            <div className="buy-row">
              <input
                className="buy-input"
                placeholder="ETH amount (e.g. 0.01)"
                value={ethToSpend}
                onChange={(e) => setEthToSpend(e.target.value)}
              />
              <button className="btn small buy-btn" onClick={buyTokens}>
                Buy
              </button>
            </div>
          </div>

          {/* SELL */}
          <div className="buy-section" style={{ marginTop: 14 }}>
            <div className="buy-label">
              Receive ETH from tokens{" "}
              <span style={{ opacity: 0.85 }}>
                (sale ETH liquidity: {saleEthLiquidity} ETH)
              </span>
            </div>

            <div className="buy-row">
              <input
                className="buy-input"
                placeholder={`Token amount (e.g. 50 ${tokenSymbol})`}
                value={tokensToSell}
                onChange={(e) => setTokensToSell(e.target.value)}
              />
              <button className="btn small buy-btn" onClick={sellTokensForEth}>
                Sell
              </button>
            </div>

            {sellQuoteEth ? (
              <div className="buy-hint">
                Estimated receive: <b>{sellQuoteEth} ETH</b>
              </div>
            ) : (
              <div className="buy-hint">
                Tip: You still need a tiny amount of Sepolia ETH for gas (approve + sell).
              </div>
            )}
          </div>

          {/* CREATE */}
          <div className="join-section">
            <div className="join-label">Create a new room</div>

            <div className="join-row" style={{ gap: 8, alignItems: "center" }}>
              <input
                className="join-input"
                placeholder="Bet (tokens)"
                value={betTokens}
                onChange={(e) => setBetTokens(e.target.value)}
                style={{ maxWidth: 160 }}
              />
              <input
                className="join-input"
                placeholder="Max players (2..10)"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                style={{ maxWidth: 190 }}
              />
              <button className="btn small" onClick={createGame}>
                Create
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, opacity: 0.85 }}>
                <input
                  type="radio"
                  checked={topicMode === "random"}
                  onChange={() => setTopicMode("random")}
                  style={{ marginRight: 6 }}
                />
                Random topic (on-chain)
              </label>

              <label style={{ fontSize: 12, opacity: 0.85 }}>
                <input
                  type="radio"
                  checked={topicMode === "fixed"}
                  onChange={() => setTopicMode("fixed")}
                  style={{ marginRight: 6 }}
                />
                Choose topic
              </label>

              {topicMode === "fixed" && (
                <select
                  value={topicFixed}
                  onChange={(e) => setTopicFixed(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(11, 6, 32, 0.9)",
                    color: "white",
                    fontSize: 12,
                  }}
                >
                  {TOPICS.map((t, i) => (
                    <option key={i} value={String(i)}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* JOIN */}
          <div className="join-section">
            <div className="join-label">Join existing room</div>
            <div className="join-row">
              <input
                className="join-input"
                placeholder="GameRoom address (0x...)"
                value={joinRoomInput}
                onChange={(e) => setJoinRoomInput(e.target.value)}
              />
              <button className="btn small" onClick={joinGame}>
                Join
              </button>
            </div>
          </div>

          {/* RECENTS */}
          {recentRooms.length > 0 && (
            <div className="join-section">
              <div className="join-label">Recent rooms</div>
              <div style={{ display: "grid", gap: 8 }}>
                {recentRooms.map((addr) => (
                  <button
                    key={addr}
                    className="btn outline small"
                    onClick={() => navigate(`/lobby/${addr}`)}
                    style={{ justifyContent: "space-between" }}
                  >
                    <span>{shortenAddress(addr)}</span>
                    <span style={{ opacity: 0.75 }}>Open →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && <div className="status-bar">{status}</div>}
        </div>

        {/* Right column assistant */}
        <div className="start-side">
          <div className="side-silhouette">
            <div
              style={{
                position: "relative",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                padding: "16px 20px",
                maxWidth: "280px",
                margin: "0 auto 25px",
                border: "2px solid rgba(255, 77, 166, 0.3)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                color: "#240C3A",
                fontSize: "14px",
                lineHeight: "1.4",
                textAlign: "center",
                zIndex: 2,
              }}
            >
              {!account ? (
                <>
                  <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#ff4da6" }}>
                    👋 Welcome, fashionista!
                  </div>
                  <div>To start the game, connect your MetaMask crypto wallet!</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#ff4da6" }}>
                    🎉 Awesome!
                  </div>
                  <div>Ready to walk the blockchain runway? Create a game or join an existing one!</div>
                </>
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "12px solid transparent",
                  borderRight: "12px solid transparent",
                  borderTop: "12px solid rgba(255, 255, 255, 0.95)",
                }}
              />
            </div>

            <div
              style={{
                position: "relative",
                width: "220px",
                height: "350px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={assistantImg}
                alt="Fashion Assistant"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))",
                }}
              />
            </div>

            <div
              className="silhouette-inner"
              style={{
                marginTop: "20px",
                opacity: "0.7",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              Runway ready
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
