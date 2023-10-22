import { ethers } from "hardhat";
import { deployAndVerify } from "./helpers/common";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log('Deployer address:', owner.address);

  // we need only implementations for the launchpad
  const votingEscrowImpl = await deployAndVerify('VotingEscrow', []);
  const rewardDistributorImpl = await deployAndVerify('RewardDistributor', []);
  
  // deploying launchpad
  const launchpad = await deployAndVerify(
    'Launchpad',
    [votingEscrowImpl.address, rewardDistributorImpl.address]
  )

  console.log('The VotingEscrow Implementation deployed at:', votingEscrowImpl.address);
  console.log('The RewardDistributor Implementation deployed at:', rewardDistributorImpl.address);
  console.log('The Launchpad deployed at:', launchpad.address);

  const abi = [
    'constructor(address,address)',
  ];
  const contract = new ethers.utils.Interface(abi);
  const encodedArguments = contract.encodeDeploy(
    [
      votingEscrowImpl.address,
      rewardDistributorImpl.address
    ]
  );

  console.log(
    'Use following constructor args for verification:',
    encodedArguments.slice(2)
  );

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
