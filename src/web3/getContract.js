import { ethers } from "ethers";
import abi from "./abi/GameABI.json";
import { CONTRACT_ADDRESS } from "./config";

export function getGameContract(signerOrProvider) {
  if (!CONTRACT_ADDRESS) throw new Error("Missing VITE_CONTRACT_ADDRESS");
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signerOrProvider);
}
