## RewardDistributor
Distributes any tokens transferred to the contract among VotingEscrow holders proportionally based on a snapshot of the week at which the tokens are sent to the RewardDistributor contract.

### Code  
RewardDistributor.sol (https://github.com/protofire/ve8020-launchpad)


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


### Creating Distribution
#### depositToken
```
function depositToken(address token, uint256 amount) external;
```
Deposits tokens to be distributed in the current week.  
Parameters:  
`token` - The ERC20 token address to distribute.  
`amount` - The amount of tokens to deposit.  

#### depositTokens
```
function depositToken(
  address[] calldata tokens,
  uint256[] calldata amounts
) external;
```
Deposits multiple tokens to be distributed in the current week.  
Parameters:  
`tokens` - An array of ERC20 token addresses to distribute.  
`amounts` - An array of token amounts to deposit.  


#### claimToken
```
function claimToken(address user, address token) external returns (uint256);
```
Claims all pending distributions of the provided token for a user.  
Parameters:  
`user` - The user on behalf of which to claim  
`token` - The ERC20 token address to be claimed.
Returns:
The amount of `token` sent to `user` as a result of claiming.  

#### claimTokens
```
function claimTokens(
  address user,
  address[] calldata token
) external returns(uint256[] memory);
```
Claims a number of tokens on behalf of a user.   
Parameters:  
`user` - The user on behalf of which to claim  
`tokens` - An array of ERC20 token addresses to be claimed..  
Returns:
An array of the amounts of each token in `tokens` sent to `user` as a result of claiming.  


### Admins functions

#### addAllowedRewardTokens
```
function addAllowedRewardTokens(address[] calldata tokens) external;
```  
Adds allowed tokens for the distribution.  
Parameters:
`tokens` - An array of ERC20 token addresses to be added for the further reward distribution.

#### transferAdmin
```
function transferAdmin(address newAdmin) external;
```  
Transfers admin rights to new address.  
Parameters:  
`newAdmin` - The new admin address to set.  


