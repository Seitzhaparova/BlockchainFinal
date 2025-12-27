// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "./gameRoom.sol";


contract GameFactory {
   GameRoom[] public games;
   address public tokenAddress;
   address public bankAddress;


   event GameCreated(
       address indexed gameAddress,
       address indexed host,
       uint256 betAmount
   );


   constructor(address _tokenAddress, address _bankAddress) {
       tokenAddress = _tokenAddress;
       bankAddress = _bankAddress;
   }


   function createGame(
       uint256 _betAmount,
       uint256 _maxPlayers
   ) external returns (address) {
       GameRoom newGame = new GameRoom(
           tokenAddress,
           bankAddress,
           _betAmount,
           _maxPlayers
       );


       games.push(newGame);


       emit GameCreated(
           address(newGame),
           msg.sender,
           _betAmount
       );


       return address(newGame);
   }


   function getAllGames() external view returns (address[] memory) {
       address[] memory gameAddresses = new address[](games.length);
       for (uint256 i = 0; i < games.length; i++) {
           gameAddresses[i] = address(games[i]);
       }
       return gameAddresses;
   }


   function getGamesCount() external view returns (uint256) {
       return games.length;
   }
}




