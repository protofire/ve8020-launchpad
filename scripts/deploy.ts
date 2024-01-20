import { ethers } from "hardhat";
import { deployAndVerify } from "./helpers/common";
import chalk from "chalk";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log('Deployer address:', owner.address);

  // we need only implementations for the launchpad
  const votingEscrowImpl = await deployAndVerify('VotingEscrow', []);
  const rewardDistributorImpl = await deployAndVerify('RewardDistributor', []);
  const rewardFaucetImpl = await deployAndVerify('RewardFaucet', []);

  // @todo
  const balToken = "0xba665c75fb0AdedEa6e24Fa25A28F77d38C009a8";
  const balMinter = "0x28af2Ef4f71Cd5EA47a61Ea81932E4Df4dC790A6";
  
  // deploying launchpad
  const launchpad = await deployAndVerify(
    'Launchpad',
    [
      votingEscrowImpl.address,
      rewardDistributorImpl.address,
      rewardFaucetImpl.address,
      balToken,
      balMinter
    ]
  )

  console.log('The VotingEscrow Implementation deployed at:', votingEscrowImpl.address);
  console.log('The RewardDistributor Implementation deployed at:', rewardDistributorImpl.address);
  console.log('The RewardFaucet Implementation deployed at:', rewardFaucetImpl.address);

  console.log('The Launchpad deployed at:', launchpad.address);

  const abi = [
    'constructor(address,address,address,address,address)',
  ];
  const contract = new ethers.utils.Interface(abi);
  const encodedArguments = contract.encodeDeploy(
    [
      votingEscrowImpl.address,
      rewardDistributorImpl.address,
      rewardFaucetImpl.address,
      balToken,
      balMinter
    ]
  );

  console.log(
    chalk.green.bold('\n❗️ Use following Constructor Arguments (ABI-encoded) for Launchpad verification:'),
  );
  console.log(encodedArguments.slice(2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
