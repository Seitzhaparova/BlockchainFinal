// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IGameBank {
   function deposit(address from, uint256 amount) external;
   function payout(address[] calldata winners) external;
   function refund(address[] calldata players) external;
}


contract GameRoom {
   IERC20 public token;
   IGameBank public bank;


   address public host;
   uint256 public betAmount;
   uint256 public maxPlayers;


   address[] public players;
   bool public gameActive;


   event PlayerJoined(address player, uint256 totalPlayers);
   event GameStarted();
   event WinnersPaid(address[] winners);
   event GameCanceled();


   modifier onlyHost() {
       require(msg.sender == host, "Only host");
       _;
   }


   constructor(
       address _token,
       address _bank,
       uint256 _betAmount,
       uint256 _maxPlayers
   ) {
       token = IERC20(_token);
       bank = IGameBank(_bank);
       host = msg.sender;
       betAmount = _betAmount;
       maxPlayers = _maxPlayers;
       gameActive = true;
   }


   /* ================= JOIN GAME ================= */


   function joinGame() external {
       require(gameActive, "Game not active");
       require(players.length < maxPlayers, "Room full");
       require(!_isPlayer(msg.sender), "Already joined");


       // Игрок должен заранее approve банку
       bank.deposit(msg.sender, betAmount);


       players.push(msg.sender);
       emit PlayerJoined(msg.sender, players.length);


       if (players.length == maxPlayers) {
           emit GameStarted();
       }
   }


   /* ================= PICK WINNERS ================= */


   function pickWinners(address[] calldata winners) external onlyHost {
       require(gameActive, "Game not active");
       require(winners.length > 0, "No winners");
       require(winners.length <= players.length, "Too many winners");


       for (uint256 i = 0; i < winners.length; i++) {
           require(_isPlayer(winners[i]), "Winner not a player");
       }


       bank.payout(winners);


       gameActive = false;
       emit WinnersPaid(winners);
   }


   /* ================= CANCEL GAME ================= */


   function cancelGame() external onlyHost {
       require(gameActive, "Game already ended");


       // возвращаем каждому игроку ставку через банк
       bank.refund(players);


       gameActive = false;
       emit GameCanceled();
   }


   /* ================= NEW ROUND ================= */


   function startNewRound() external onlyHost {
       require(!gameActive, "Game still active");


       delete players;
       gameActive = true;
   }


   /* ================= VIEWS ================= */


   function getPlayers() external view returns (address[] memory) {
       return players;
   }


   function getPlayerCount() external view returns (uint256) {
       return players.length;
   }


   /* ================= INTERNAL ================= */


   function _isPlayer(address user) internal view returns (bool) {
       for (uint256 i = 0; i < players.length; i++) {
           if (players[i] == user) return true;
       }
       return false;
   }
}
