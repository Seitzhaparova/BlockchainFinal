// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenSale is Ownable {
    IERC20 public token;

    // token units per 1 ETH (token has 18 decimals)
    // Example: 1000 DCT / 1 ETH => tokensPerEth = 1000 * 1e18
    uint256 public tokensPerEth;

    event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensReceived);

    constructor(address tokenAddress, uint256 _tokensPerEth) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
        tokensPerEth = _tokensPerEth;
    }

    function buyTokens() external payable {
        require(msg.value > 0, "Send ETH");

        uint256 amount = (msg.value * tokensPerEth) / 1 ether;
        require(token.balanceOf(address(this)) >= amount, "Not enough tokens in sale");

        require(token.transfer(msg.sender, amount), "Token transfer failed");
        emit TokensPurchased(msg.sender, msg.value, amount);
    }

    function setTokensPerEth(uint256 _tokensPerEth) external onlyOwner {
        require(_tokensPerEth > 0, "Invalid rate");
        tokensPerEth = _tokensPerEth;
    }

    function withdrawETH(address payable to) external onlyOwner {
        require(to != address(0), "Bad address");
        to.transfer(address(this).balance);
    }

    function withdrawUnsoldTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Bad address");
        require(token.transfer(to, amount), "Token transfer failed");
    }
}
