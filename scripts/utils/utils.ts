import { ethers, network, run } from "hardhat";

export async function deployAndVerify(contractName: string, args: any[]) {
  const Contract = await ethers.getContractFactory(contractName);

  console.log('Deploying', contractName);
  const contract = await Contract.deploy(...args);
  console.log(`${contractName} deployed to: ${contract.address}`);

  await contract.deployed();
  console.log("Done");

  const networkName = network.name;
  console.log("Network:", networkName);
  if (networkName != "hardhat" && !['Launchpad', 'VotingEscrow'].includes(contractName)) {
      console.log("Verifying contract...");
      try {
        await new Promise(resolve => {
          console.log('Waiting for 50 seconds until chain is ready for verifying')
          setTimeout(resolve, 50000);
        });
        await run("verify:verify", {
              address: contract.address,
              constructorArguments: args,
          });
          console.log("Contract is Verified");
      } catch (error: any) {
          console.log("Failed in plugin", error.pluginName);
          console.log("Error name", error.name);
          console.log("Error message", error.message);
      }
  }
  return contract;
}
