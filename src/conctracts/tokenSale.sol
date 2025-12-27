// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract TokenSale {
   IERC20 public token;
   address public owner;
   uint256 public rate; // tokens per ETH


   constructor(address _token, uint256 _rate) {
       token = IERC20(_token);
       rate = _rate;
       owner = msg.sender;
   }


   function buyTokens() external payable {
       require(msg.value > 0, "Send ETH");


       uint256 amount = msg.value * rate;
       require(
           token.balanceOf(address(this)) >= amount,
           "Not enough tokens"
       );


       token.transfer(msg.sender, amount);
   }


   function withdrawETH() external {
       require(msg.sender == owner, "Only owner");
       payable(owner).transfer(address(this).balance);
   }
}
