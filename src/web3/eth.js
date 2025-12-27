import { BrowserProvider } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111; // 0xaa36a7
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

export function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;

  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

export async function ensureSepolia() {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask not found");

  const chainIdHex = await eth.request({ method: "eth_chainId" });
  if (chainIdHex === SEPOLIA_CHAIN_HEX) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
  } catch (err) {
    // 4902 = chain not added
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_HEX,
            chainName: "Sepolia",
            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet() {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask not found");

  await ensureSepolia();

  const accounts = await eth.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0] ?? null;
  return account;
}

export async function getProvider() {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask not found");
  await ensureSepolia();
  return new BrowserProvider(eth);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}
