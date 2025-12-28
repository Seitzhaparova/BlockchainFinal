// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address from, address to, uint256 v) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract TokenSale {
    IERC20 public immutable token;

    // tokensPerEth = how many token "wei" you get for 1 ETH (1e18 wei)
    // Example: if token has 18 decimals, and you want 1000 DCT per 1 ETH:
    // tokensPerEth = 1000 * 1e18
    uint256 public tokensPerEth;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address tokenAddress, uint256 _tokensPerEth) {
        require(tokenAddress != address(0), "BAD_TOKEN");
        require(_tokensPerEth > 0, "BAD_RATE");
        token = IERC20(tokenAddress);
        tokensPerEth = _tokensPerEth;
        owner = msg.sender;
    }

    // Accept ETH deposits to fund sellTokens payouts
    receive() external payable {}

    function setRate(uint256 _tokensPerEth) external onlyOwner {
        require(_tokensPerEth > 0, "BAD_RATE");
        tokensPerEth = _tokensPerEth;
    }

    // --- Quotes (front-end friendly) ---

    function quoteTokensForEth(uint256 ethWei) public view returns (uint256) {
        // tokens = ethWei * tokensPerEth / 1e18
        return (ethWei * tokensPerEth) / 1e18;
    }

    function quoteEthForTokens(uint256 tokenAmount) public view returns (uint256) {
        // ethWei = tokenAmount * 1e18 / tokensPerEth
        return (tokenAmount * 1e18) / tokensPerEth;
    }

    // --- BUY: pay ETH, receive tokens ---

    function buyTokens() external payable {
        require(msg.value > 0, "NO_ETH");
        uint256 out = quoteTokensForEth(msg.value);

        require(token.balanceOf(address(this)) >= out, "SALE_EMPTY");
        require(token.transfer(msg.sender, out), "TOKEN_TRANSFER_FAIL");
    }

    // --- SELL: send tokens, receive ETH ---

    function sellTokens(uint256 tokenAmount) external {
        require(tokenAmount > 0, "NO_TOKENS");

        uint256 ethOut = quoteEthForTokens(tokenAmount);
        require(address(this).balance >= ethOut, "SALE_NO_ETH");

        // Take tokens from user (requires approve)
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "TRANSFER_FROM_FAIL");

        // Pay ETH to user
        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "ETH_SEND_FAIL");
    }

    // --- Admin funding/withdraw ---

    function withdrawEth(uint256 amountWei) external onlyOwner {
        require(address(this).balance >= amountWei, "NO_ETH");
        (bool ok, ) = owner.call{value: amountWei}("");
        require(ok, "WITHDRAW_FAIL");
    }

    function withdrawTokens(uint256 amount) external onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "NO_TOKENS");
        require(token.transfer(owner, amount), "WITHDRAW_TOKEN_FAIL");
    }
}
