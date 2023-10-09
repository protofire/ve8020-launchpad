## Frontend integration

### System creation and management
1) Create system using Launchpad contract.
```
function deploy(
  address tokenBptAddr,
  string memory name,
  string memory symbol,
  uint256 maxLockTime,
  uint256 rewardDistributorStartTime
)
```
**Parameters details and constraints:**  
`tokenBptAddr` - token or liquidity-token provided by creator  
`name` - any name provided by creator  
`symbol` - any symbol provided by creator  
`maxLockTime` - time in seconds. **Must be >= `604800` (7 days)**  
`rewardDistributorStartTime` - unix timestamp. **Must be >= unix-timestamp of next Thursday 00:00**  

After calling the `deploy()` function, contracts VotingEscrow and RewardDistributor will be created for the caller (admin). The addresses of these contracts can be obtained from the `VESystemCreated(address bptToken, address votingEscrow, address rewardDistributor, address admin)` event of the deploy() function. 

2) After creation admin (creator) must add allowed token for the reward distribution.
To do that use following function of the RewardDistributor constract:  
```
function addAllowedRewardTokens(address[] calldata tokens);
```

3) To provide rewards into RewardDistributor constract any user can use one of the following functions:  
```
depositToken(address token, uint256 amount);  
depositTokens(address[] calldata tokens, uint256[] calldata amounts);  
```  
**Parameters details and constraints:**  
`token` - token address, that already added to allowed list (see point 2),
`amount` - amount for token  
Note: 
  - tokens can be added to the weekly distribution no earlier than `rewardDistributorStartTime`.
  - Every Thursday at 00:00 a new week of reward distributions begins.

4) The Subgraph can be used to track the history of awards added each week. 
