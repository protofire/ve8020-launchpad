import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/utils";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  console.log('Deploying SmartWalletWhitelist contract');

  // we need only implementations for the launchpad
  const smartChecker = await deployAndVerify('SmartWalletWhitelist', [owner.address]);
  console.log('The SmartWalletWhitelist deployed at:', smartChecker.address);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});