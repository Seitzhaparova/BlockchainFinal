// src/web3/abis.js

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// ✅ ONE export ONLY (and it includes tokensPerEth so Start_Page works)
export const TOKEN_SALE_ABI = [
  "function token() view returns (address)",
  "function tokensPerEth() view returns (uint256)",
  "function buyTokens() payable",
  "function sellTokens(uint256 tokenAmount)",
  "function quoteTokensForEth(uint256 ethWei) view returns (uint256)",
  "function quoteEthForTokens(uint256 tokenAmount) view returns (uint256)",
];

// ⚠️ IMPORTANT: your Start_Page uses factory.createGame(...) and listens for "GameCreated"
// So ABI must match that (if your Solidity uses createRoom/RoomCreated, tell me and I’ll swap)
export const GAME_FACTORY_ABI = [
  "function createGame(uint256 betAmount, uint256 maxPlayers, uint256 topicId) returns (address)",
  "event GameCreated(address indexed gameAddress, address indexed host, uint256 betAmount, uint256 topicId)",
];



export const GAME_ROOM_ABI = [
  "function host() view returns (address)",
  "function betAmount() view returns (uint256)",
  "function maxPlayers() view returns (uint256)",
  "function topicId() view returns (uint256)",
  "function phase() view returns (uint8)",
  "function stylingDeadline() view returns (uint256)",
  "function votingDeadline() view returns (uint256)",
  "function getPlayers() view returns (address[])",
  "function bank() view returns (address)",
  "function token() view returns (address)",

  "function joinGame()",
  "function startGame()",
  "function submitOutfit(uint256 outfitCode)",
  "function startVoting()",
  "function castVotes(address[] targets, uint8[] stars)",
  "function finalize()",
  "function cancelGame()",

  "function getOutfit(address player) view returns (bool hasOutfit, uint256 outfitCode)",
  "function getWinners() view returns (address[] winners, uint256 finalPot, uint256 payoutPerWinner)",

  "function joined(address) view returns (bool)",
  "function submitted(address) view returns (bool)",
  "function submittedCount() view returns (uint256)",
  "function hasVoted(address) view returns (bool)",
  "function totalStars(address) view returns (uint256)",
  "function voteCount(address) view returns (uint256)",
];
