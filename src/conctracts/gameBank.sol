// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract GameBank {
   IERC20 public token;
   address public factory;


   // баланс каждого игрока
   mapping(address => uint256) public balances;


   event Deposit(address indexed from, uint256 amount);
   event Payout(address[] winners, uint256 share, uint256 remainder);
   event Refund(address indexed player, uint256 amount);


   modifier onlyFactory() {
       require(msg.sender == factory, "Only factory");
       _;
   }


   constructor(address _token) {
       token = IERC20(_token);
       factory = msg.sender;
   }


   /* ================= DEPOSIT ================= */


   /**
    * @notice вызывается GameRoom при входе игрока
    */
   function deposit(address from, uint256 amount) external onlyFactory {
       require(
           token.transferFrom(from, address(this), amount),
           "Transfer failed"
       );


       balances[from] += amount;
       emit Deposit(from, amount);
   }


   /* ================= PAYOUT ================= */


   /**
    * @notice делит банк между победителями
    * остаток остаётся на балансе банка
    */
   function payout(address[] calldata winners) external onlyFactory {
       require(winners.length > 0, "No winners");


       uint256 totalBalance = 0;
       for (uint256 i = 0; i < winners.length; i++) {
           totalBalance += balances[winners[i]];
       }
       require(totalBalance > 0, "Empty bank");


       uint256 share = totalBalance / winners.length;
       uint256 remainder = totalBalance % winners.length;


       require(share > 0, "Prize too small");


       for (uint256 i = 0; i < winners.length; i++) {
           token.transfer(winners[i], share);
           balances[winners[i]] = 0; // обнуляем баланс игрока
       }


       // остаток остаётся на балансе банка
       emit Payout(winners, share, remainder);
   }


   /* ================= REFUND ================= */


   function refund(address[] calldata players) external onlyFactory {
       for (uint256 i = 0; i < players.length; i++) {
           uint256 amount = balances[players[i]];
           if (amount > 0) {
               balances[players[i]] = 0;
               token.transfer(players[i], amount);
               emit Refund(players[i], amount);
           }
       }
   }


   /* ================= VIEW ================= */


   function getBalance(address player) external view returns (uint256) {
       return balances[player];
   }
}
