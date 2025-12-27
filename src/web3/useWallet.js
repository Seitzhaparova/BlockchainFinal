import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { CHAIN_ID } from "./config";

export function useWallet() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [balanceEth, setBalanceEth] = useState("");

  const hasWallet = typeof window !== "undefined" && !!window.ethereum;

  const refreshBalance = useCallback(async (prov, addr) => {
    if (!prov || !addr) return;
    const bal = await prov.getBalance(addr);
    setBalanceEth(ethers.formatEther(bal));
  }, []);

  const connect = useCallback(async () => {
    if (!hasWallet) throw new Error("No injected wallet found (MetaMask).");
    const prov = new ethers.BrowserProvider(window.ethereum);
    await prov.send("eth_requestAccounts", []);
    const sg = await prov.getSigner();
    const addr = await sg.getAddress();
    const net = await prov.getNetwork();

    setProvider(prov);
    setSigner(sg);
    setAddress(addr);
    setChainId(Number(net.chainId));
    await refreshBalance(prov, addr);
  }, [hasWallet, refreshBalance]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress("");
    setChainId(null);
    setBalanceEth("");
  }, []);

  const isWrongNetwork = useMemo(() => {
    if (chainId == null) return false;
    return Number(chainId) !== Number(CHAIN_ID);
  }, [chainId]);

  useEffect(() => {
    if (!hasWallet) return;

    const onAccountsChanged = () => connect().catch(() => {});
    const onChainChanged = () => connect().catch(() => {});

    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [hasWallet, connect]);

  return {
    hasWallet,
    provider,
    signer,
    address,
    chainId,
    balanceEth,
    isWrongNetwork,
    connect,
    disconnect,
    refreshBalance: () => refreshBalance(provider, address),
  };
}
