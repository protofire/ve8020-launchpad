import { ethers } from "hardhat";
import { deployAndVerify } from "../helpers/common";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  console.log('Deploying LensReward contract');

  const lens = await deployAndVerify('LensReward', []);
  console.log('The LensReward deployed at:', lens.address);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
