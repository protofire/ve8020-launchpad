# ve8020 Launchpad

Detailed instructions for each contract:  
[Launchpad](./docs/1_Launchpad.md)  
[VotingEscrow](./docs/2_VotingEscrow.md)  
[RewardDistributor](./docs/3_RewardDistributor.md)  
[RewardFaucet](./docs/4_RewardFaucet.md)  

Additional modules:  
[LensReward](./docs/misc_docs/LensReward.md)  
[SmartWalletWhitelist](./docs/misc_docs/SmartWalletWhitelist.md)  


In case of errors, visit this [troubleshooting section](./docs/misc_docs/Troubleshooting.md).


## Installation
Clone repo and run:  

```sh
npm i
```


## Deploy contracts
Create `config.js` file like provided `config.example.js` before deployment. Update necessary variables.  
To deploy VotingEscrow, RewardDistributor implementations and **Launchpad** contract run following command:  
```sh
npx hardhat run ./scripts/deploy.ts --network networkName
```
Check list of available networks in the [hardhat.config.ts](./hardhat.config.ts) file.


### Testing
To run tests:  
```sh
npx hardhat test  
```

