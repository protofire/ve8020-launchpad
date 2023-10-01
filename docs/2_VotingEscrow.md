## VotingEscrow
The contract allows locking tokens for a selected period of time and receiving rewards from the RewardsDistribution contract in return. It utilizes the VotingEscrow contract from Curve as its implementation.

### Code  
[VotingEscrow.vy](../contracts/VotingEscrow.vy)


### Interactions with other smart contracts
By default, the VotingEscrow contract restricts access for other smart contracts. If you want to configure access for other smart contracts, you need to use the functionality of the third-party `SmartWalletWhitelist` smart contract. With `SmartWalletWhitelist`, you can grant access to all possible smart contracts or only a specific list. [Refer to the instructions](./Additional_docs/SmartWalletWhitelist.md) for deploying and configuring access for smart contracts to VotingEscrow.


### View functions
#### token
```
function token() external view returns (address)
```
Returns the address of the token that can be deposited into VotingEscrow.  

#### name
```
function name() external view returns (string memory)
```
Returns name of the current VotingEscrow contract.  


### Locking
#### create_lock
```
function create_lock(uint256 _value, uint256 _unlock_time) external;
```
Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`.  
Parameters:  
`_value` - amount to deposit. VotingEscrow should have already given an allowance of at least `_value` on the deposited token.  
`_unlock_time` - epoch time when tokens unlock, rounded down to whole weeks.  

#### increase_amount
```
function increase_amount(uint256 _value) external;
```
Deposit `_value` additional tokens for `msg.sender` without modifying the unlock time.  
Parameters:  
`_value` - amount to deposit. VotingEscrow should have already given an allowance of at least `_value` on the deposited token.  

#### increase_unlock_time
```
function increase_unlock_time(uint256 _unlock_time) external;
```
Extend the unlock time for `msg.sender` to `_unlock_time`  
Parameters:  
`_unlock_time` - new epoch time for unlocking

#### withdraw
```
function withdraw() external;
```
Withdraw all tokens for `msg.sender` when lock has expired.



### Admin functions

#### Ownership transfer
```
commit_transfer_ownership(addr) external;
```
Parameters:  
`addr` - Address to have ownership transferred to
Transfers ownership of VotingEscrow contract to `addr`  

```
apply_transfer_ownership() external();
```
Applies ownership transfer  
  


#### [Adding smart wallet checker](./misc_docs/SmartWalletWhitelist.md)  
```
commit_smart_wallet_checker(addr) external;
```
Sets an external contract to check for approved smart contract wallets  
Parameters:  
`addr` - Address of Smart contract checker


```
apply_smart_wallet_checker()
```
Applies setting external contract to check approved smart contract wallets

  
Additional info can also be found [here](https://docs.curve.fi/curve_dao/VotingEscrow/VotingEscrow/)  
