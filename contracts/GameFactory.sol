// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./GameRoom.sol";
import "./GameBank.sol";

contract GameFactory {
    address public token;
    GameBank public bank;

    uint256 public stylingDuration; // seconds
    uint256 public votingDuration;  // seconds

    address[] public allGames;

    event GameCreated(address indexed gameAddress, address indexed host, uint256 betAmount, uint256 topicId);

    constructor(address tokenAddress, address bankAddress, uint256 _stylingDuration, uint256 _votingDuration) {
        token = tokenAddress;
        bank = GameBank(bankAddress);
        stylingDuration = _stylingDuration;
        votingDuration = _votingDuration;
    }

    function createGame(uint256 betAmount, uint256 maxPlayers, uint256 topicId) external returns (address) {
        require(maxPlayers >= 2 && maxPlayers <= 10, "maxPlayers 2..10");
        require(betAmount > 0, "bet > 0");
        require(topicId < 5, "topic 0..4");

        GameRoom room = new GameRoom(
            token,
            address(bank),
            msg.sender,
            betAmount,
            maxPlayers,
            topicId,
            stylingDuration,
            votingDuration
        );

        bank.registerRoom(address(room));

        allGames.push(address(room));

        emit GameCreated(address(room), msg.sender, betAmount, topicId);
        return address(room);
    }

    function getAllGames() external view returns (address[] memory) {
        return allGames;
    }
}
