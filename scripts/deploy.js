const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1) Token
  const MyToken = await hre.ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("MyToken:", tokenAddr);

  // 2) Bank (factory set later)
  const GameBank = await hre.ethers.getContractFactory("GameBank");
  const bank = await GameBank.deploy(tokenAddr);
  await bank.waitForDeployment();
  const bankAddr = await bank.getAddress();
  console.log("GameBank:", bankAddr);

  // 3) Factory
  const GameFactory = await hre.ethers.getContractFactory("GameFactory");

  // 10 minutes styling + 10 minutes voting (you can change)
  const stylingDuration = 10 * 60;
  const votingDuration = 10 * 60;

  const factory = await GameFactory.deploy(tokenAddr, bankAddr, stylingDuration, votingDuration);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("GameFactory:", factoryAddr);

  // set factory in bank
  const txSetFactory = await bank.setFactory(factoryAddr);
  await txSetFactory.wait();
  console.log("Bank factory set.");

  // 4) TokenSale
  const TokenSale = await hre.ethers.getContractFactory("TokenSale");

  // 1000 tokens per 1 ETH (token has 18 decimals)
  const tokensPerEth = hre.ethers.parseUnits("1000", 18);

  const sale = await TokenSale.deploy(tokenAddr, tokensPerEth);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();
  console.log("TokenSale:", saleAddr);

  // Fund sale with tokens (e.g., 500,000 tokens)
  const amountForSale = hre.ethers.parseUnits("500000", 18);
  const txFund = await token.transfer(saleAddr, amountForSale);
  await txFund.wait();
  console.log("TokenSale funded with tokens.");

  console.log("\n=== COPY THESE INTO YOUR FRONTEND .env ===");
  console.log(`VITE_TOKEN_ADDRESS=${tokenAddr}`);
  console.log(`VITE_TOKEN_SALE_ADDRESS=${saleAddr}`);
  console.log(`VITE_GAME_FACTORY_ADDRESS=${factoryAddr}`);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
