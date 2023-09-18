import { ethers } from "hardhat";
import { deployAndVerify } from "./utils/utils";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  const lens = await deployAndVerify('LensReward', []);

  console.log('The LensReward deployed at:', lens.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
