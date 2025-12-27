// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MyToken is ERC20 {
   constructor() ERC20("MyToken", "MTN") {
       uint256 supply = 100 * 1e18;  // 100 токенов
       _mint(msg.sender, supply);
   }
}
