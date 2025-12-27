export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const TOKEN_SALE_ABI = [
  "function tokensPerEth() view returns (uint256)",
  "function buyTokens() payable",
];

export const GAME_FACTORY_ABI = [
  "function bank() view returns (address)",
  "function createGame(uint256 betAmount, uint256 maxPlayers, uint256 topicId) returns (address)",
  "event GameCreated(address indexed gameAddress, address indexed host, uint256 betAmount, uint256 topicId)",
  "function getAllGames() view returns (address[])",
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
  "function joinGame()",
  "function startGame()",
  "function submitOutfit(uint256 outfitCode)",
  "function startVoting()",
  "function castVotes(address[] targets, uint8[] stars)",
  "function finalize()",
  "function getOutfit(address player) view returns (bool hasOutfit, uint256 outfitCode)",
  "function getWinners() view returns (address[] winners, uint256 finalPot, uint256 payoutPerWinner)",
];
