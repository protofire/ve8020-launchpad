# ve8020 Launchpad

Detailed instructions for each contract:  
[Launchpad](./docs/1_Launchpad.md)  
[VotingEscrow](./docs/2_VotingEscrow.md)  
[RewardDistributor](./docs/3_RewardDistributor.md)  

In case of errors, visit this [troubleshooting section](./docs/Additional_docs/Troubleshooting.md).


## Install
Clone repo and run:  

```
npm i
```


## Deploy
Create `config.js` file like provided `config.example.js` before deployment. Update necessary variables.  
To deploy VotingEscrow, RewardDistributor implementations and **Launchpad** contract run following command:  
```
npx hardhat run ./scripts/deploy.ts --network networkName
```
Check list of available networks in the *hardhat.config.ts* file.


### Testing
To run tests:  
```
npx hardhat test  
```

