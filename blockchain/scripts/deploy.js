const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const ForensicCommitment = await hre.ethers.getContractFactory("ForensicCommitment");
  const contract = await ForensicCommitment.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("ForensicCommitment deployed to:", address);
  console.log("\nUpdate your .env file with:");
  console.log(`COMMITMENT_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
