import { ethers } from "hardhat";
import { deployAndVerify } from "./helpers/common";

async function main() {

  const [owner] = await ethers.getSigners();
  console.log('deployer address:', owner.address);

  const votingEscrowImpl = await deployAndVerify('VotingEscrow', []);


  console.log('The VotingEscrow Implementation deployed at:', votingEscrowImpl.address);
  // console.log('The RewardDistributor Implementation deployed at:', rewardDistributorImpl.address);

  // console.log('The Launchpad deployed at:', launchpad.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
