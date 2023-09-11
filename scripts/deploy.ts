import { ethers } from "hardhat";
import { deployAndVerify } from "./utils/utils";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  // we need only implementations for the launchpad
  const veImpl = await deployAndVerify('VotingEscrow', []);
  const rewardDistributorImpl = await deployAndVerify('RewardDistributor', []);
  
  // deploying launchpad
  const launchpad = await deployAndVerify(
    'Launchpad',
    [veImpl.address, rewardDistributorImpl.address]
  )

  console.log('The launchpad deployed at:', launchpad.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
