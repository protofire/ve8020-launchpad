import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/utils";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  console.log('Deploying SmartCheckerAllowAll contract');

  // we need only implementations for the launchpad
  const smartAllower = await deployAndVerify('SmartCheckerAllowAll', []);
  console.log('The SmartCheckerAllowAll deployed at:', smartAllower.address);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});