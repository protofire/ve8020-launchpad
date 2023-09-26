# ve8020 Launchpad

[Launchpad](./docs/1_Launchpad.md)  
[VotingEscrow](./docs/2_VotingEscrow.md)  
[RewardDistributor](./docs/3_RewardDistributor.md)  


## Install
Clone repo and run:  

```
npm i
```


## Deploy
To deploy VotingEscrow, RewardDistributor implementations and **Launchpad** contract run following command:  
```
npx hardhat run ./scripts/deploy.ts --network networkName
```
Check list of available networks in the *hardhat.config.ts* file.