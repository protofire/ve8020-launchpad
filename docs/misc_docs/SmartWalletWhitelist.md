# SmartWalletWhitelist contract

Using the `SmartWalletWhitelist` smart contract, you can independently establish a list of allowed smart contracts that can lock tokens in the `VotingEscrow` contract.
To deploy `SmartWalletWhitelist`, execute the following command:  
```sh
npx hardhat run ./scripts/utils/deploySmartAllowList.ts --network networkName
```  

Don't forget to specify desired networkName (full list of network names can be found [hardhat.config.ts](../../hardhat.config.ts))
  

After deploying the `SmartWalletWhitelist` smart contract, you need to add its address to the VotingEscrow contract. To do this, in the VotingEscrow contract, sequentially call the functions:  

```sh
commit_smart_wallet_checker(newSmartWalletWhitelistAddress);  
apply_smart_wallet_checker();  
```  
where `newSmartWalletWhitelistAddress` is the address of your `SmartWalletWhitelist` contract.


## Access for All Smart Contracts  

If you want to allow access to `VotingEscrow` for all smart contracts, you need to additionally deploy `SmartCheckerAllowAll`.

```sh
npx hardhat run ./scripts/utils/deploySmartAllower.ts --network networkName
```

Then, in the SmartWalletWhitelist contract, call the function:
```
setChecker(smartCheckerAllowAllAddress)
```
where `smartCheckerAllowAllAddress` is the address of your `SmartCheckerAllowAll` contract.

Now any contract can interact with your `VotingEscrow`.
