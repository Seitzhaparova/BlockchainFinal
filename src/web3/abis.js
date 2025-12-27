// src/web3/abis.js

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const TOKEN_SALE_ABI = [
  "function buyTokens() payable",
];

export const GAME_FACTORY_ABI = [
  "function createRoom(uint256 betAmount, uint256 maxPlayers, uint256 topicId) returns (address)",
  "event RoomCreated(address indexed room, address indexed host, uint256 betAmount, uint256 maxPlayers, uint256 topicId)",
];

export const GAME_ROOM_ABI = [
  // base info
  "function host() view returns (address)",
  "function betAmount() view returns (uint256)",
  "function maxPlayers() view returns (uint256)",
  "function topicId() view returns (uint256)",
  "function phase() view returns (uint8)",
  "function stylingDeadline() view returns (uint256)",
  "function votingDeadline() view returns (uint256)",
  "function getPlayers() view returns (address[])",

  // IMPORTANT: add these getters (they exist because variables are public in Solidity)
  "function bank() view returns (address)",
  "function token() view returns (address)",

  // actions
  "function joinGame()",
  "function startGame()",
  "function submitOutfit(uint256 outfitCode)",
  "function startVoting()",
  "function castVotes(address[] targets, uint8[] stars)",
  "function finalize()",
  "function cancelGame()",

  // views
  "function getOutfit(address player) view returns (bool hasOutfit, uint256 outfitCode)",
  "function getWinners() view returns (address[] winners, uint256 finalPot, uint256 payoutPerWinner)",

  // extra public getters (mappings/vars) – used by GUI
  "function joined(address) view returns (bool)",
  "function submitted(address) view returns (bool)",
  "function submittedCount() view returns (uint256)",
  "function hasVoted(address) view returns (bool)",
  "function totalStars(address) view returns (uint256)",
  "function voteCount(address) view returns (uint256)",
];
