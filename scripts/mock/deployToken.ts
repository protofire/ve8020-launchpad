import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/common";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  // we need only implementations for the launchpad
  const token = await deployAndVerify('TestToken', []);
  console.log('The mock token deployed at:', token.address);

  const bptToken = await deployAndVerify('BPTToken', []);
  console.log('The mock bptToken deployed at:', bptToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
