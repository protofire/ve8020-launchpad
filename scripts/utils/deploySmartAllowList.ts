import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/common";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  console.log('Deploying SmartWalletWhitelist contract');

  const smartCheckerList = await deployAndVerify('SmartWalletWhitelist', [owner.address]);
  console.log('The SmartWalletWhitelist deployed at:', smartCheckerList.address);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
