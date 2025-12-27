// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameBank is Ownable {
    IERC20 public token;

    address public factory; // set once after deploy
    mapping(address => bool) public isRoom;

    // per room pot
    mapping(address => uint256) public pot;

    // room => player => deposited
    mapping(address => mapping(address => uint256)) public depositOf;

    event FactorySet(address factory);
    event RoomRegistered(address indexed room);
    event Deposited(address indexed room, address indexed player, uint256 amount, uint256 roomPot);
    event PaidOut(address indexed room, address[] winners, uint256 payoutPerWinner, uint256 totalPot);
    event Refunded(address indexed room, uint256 totalPot);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyRoom() {
        require(isRoom[msg.sender], "Only room");
        _;
    }

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
    }

    function setFactory(address factoryAddress) external onlyOwner {
        require(factory == address(0), "Factory already set");
        require(factoryAddress != address(0), "Bad address");
        factory = factoryAddress;
        emit FactorySet(factoryAddress);
    }

    function registerRoom(address room) external onlyFactory {
        require(room != address(0), "Bad address");
        isRoom[room] = true;
        emit RoomRegistered(room);
    }

    // Called by GameRoom. Player must approve BANK beforehand.
    function deposit(address player, uint256 amount) external onlyRoom {
        require(player != address(0), "Bad player");
        require(amount > 0, "Bad amount");

        require(token.transferFrom(player, address(this), amount), "transferFrom failed");

        depositOf[msg.sender][player] += amount;
        pot[msg.sender] += amount;

        emit Deposited(msg.sender, player, amount, pot[msg.sender]);
    }

    // Splits whole pot among winners
    function payout(address[] calldata winners)
        external
        onlyRoom
        returns (uint256 payoutPerWinner, uint256 totalPot)
    {
        totalPot = pot[msg.sender];
        require(totalPot > 0, "Empty pot");
        require(winners.length > 0, "No winners");

        payoutPerWinner = totalPot / winners.length;
        uint256 remainder = totalPot - (payoutPerWinner * winners.length);

        pot[msg.sender] = 0;

        for (uint256 i = 0; i < winners.length; i++) {
            uint256 pay = payoutPerWinner + (i == 0 ? remainder : 0);
            require(token.transfer(winners[i], pay), "transfer failed");
        }

        emit PaidOut(msg.sender, winners, payoutPerWinner, totalPot);
    }

    function refund(address[] calldata players) external onlyRoom {
        uint256 totalPot = pot[msg.sender];
        pot[msg.sender] = 0;

        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            uint256 amt = depositOf[msg.sender][p];
            if (amt > 0) {
                depositOf[msg.sender][p] = 0;
                require(token.transfer(p, amt), "refund transfer failed");
            }
        }

        emit Refunded(msg.sender, totalPot);
    }

    function getPot(address room) external view returns (uint256) {
        return pot[room];
    }
}
