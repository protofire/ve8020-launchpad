import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/common";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  console.log('Deploying SmartWalletChecker contract');

  const smartChecker = await deployAndVerify('SmartWalletChecker', []);
  console.log('The SmartWalletChecker deployed at:', smartChecker.address);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
