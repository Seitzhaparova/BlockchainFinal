import { Contract, isAddress } from "ethers";
import { ERC20_ABI, TOKEN_SALE_ABI, GAME_FACTORY_ABI, GAME_ROOM_ABI } from "./abis";

export function getAddresses() {
  const token = import.meta.env.VITE_TOKEN_ADDRESS;
  const sale = import.meta.env.VITE_TOKEN_SALE_ADDRESS;
  const factory = import.meta.env.VITE_GAME_FACTORY_ADDRESS;

  return { token, sale, factory };
}

export function assertAddresses() {
  const { token, sale, factory } = getAddresses();
  if (!isAddress(token) || !isAddress(sale) || !isAddress(factory)) {
    throw new Error("Missing/invalid contract addresses in .env (VITE_TOKEN_ADDRESS, VITE_TOKEN_SALE_ADDRESS, VITE_GAME_FACTORY_ADDRESS)");
  }
}

export function getToken(addr, signerOrProvider) {
  return new Contract(addr, ERC20_ABI, signerOrProvider);
}

export function getTokenSale(addr, signerOrProvider) {
  return new Contract(addr, TOKEN_SALE_ABI, signerOrProvider);
}

export function getFactory(addr, signerOrProvider) {
  return new Contract(addr, GAME_FACTORY_ABI, signerOrProvider);
}

export function getRoom(roomAddr, signerOrProvider) {
  return new Contract(roomAddr, GAME_ROOM_ABI, signerOrProvider);
}
