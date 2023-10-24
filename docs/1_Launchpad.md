## Launchpad System Details

The Launchpad system is a set of smart contracts used to lock BPT tokens (representing liquidity providers positions) in order to gain voting power on a given project, and also being able to distribute rewards to those who are locking their liquidity, incentivising governance and long term participation.  
In addition to the BPT token lock, almost any token of any project can be used. This way, users can independently create their own systems, with their own reward tokens (incentives).

Main parts of the system:  
Launchpad - a contract factory for creating new VotingEscrow and RewardsDistribution contracts.  
VotingEscrow - a contract for locking liquidity tokens for a specific period.  
RewardsDistribution - a contract for distributing rewards to users.  
Some smart contracts are written in Vyper (including to utilize time-tested and user-proven solutions, as well as to avoid redundant audits), but for the sake of simplicity, we will stick to Solidity syntax in this documentation.  


## Launchpad
The Launchpad contract uses the minimal-proxy pattern for deploying new VotingEscrow and RewardsDistribution contracts. This significantly reduces the deployment cost, making this process accessible to all users. Deployment can be done through the UI, blockchain explorer interface, or through direct interaction with the Launchpad smart contract.


### Code  
[Launchpad.vy](../contracts/Launchpad.vy)

### Deploying new ve-system
```sh
function deploy(
    address tokenBptAddr,
    string memory name,
    string memory symbol,
    uint256 maxLockTime,
    uint256 rewardDistributorStartTime
) external returns (address, address);
```

The function creates a new pair of VotingEscrow and RewardsDistribution contracts and emits an event with such new addresses. **The caller will be the admin of these new contracts.**  
Parameters:  
`tokenBptAddr` - the address of the token to be used for locking in the VotingEscrow contract.  
`name` - the name for the new VotingEscrow contract. It can be any name chosen by the creator.  
`symbol` - the symbol for the new VotingEscrow contract. It can be any symbol chosen by the creator.  
`maxLockTime` - a constraint for the maximum lock time in the new VotingEscrow contract. It should be at least 1 week.  
`rewardDistributorStartTime` - the start time for reward distribution in the new RewardsDistribution contract. Unix time in seconds, should be no earlier than a week from contract creation.  

#### Contract Overview  
The `deploy()` function utilizes the built-in Vyper function `create_minimal_proxy_to(address)`, which deploys a copy of the contract using the [minimal-proxy pattern](https://eips.ethereum.org/EIPS/eip-1167). Upon completion, an event is emitted with the new votingEscrow and rewardDistributor contracts.  

```sh
def deploy(
    tokenBptAddr: address,
    name: String[64],
    symbol: String[32],
    maxLockTime: uint256,
    rewardDistributorStartTime: uint256,
) -> (address, address):
    """
    @notice Deploys new VotingEscrow and RewardDistributor contracts
    @param tokenBptAddr The address of the token to be used for locking
    @param name The name for the new VotingEscrow contract
    @param symbol The symbol for the new VotingEscrow contract
    @param maxLockTime A constraint for the maximum lock time in the new VotingEscrow contract
    @param rewardDistributorStartTime The start time for reward distribution
    """
    newVotingEscrow: address = create_minimal_proxy_to(self.votingEscrow)
    IVotingEscrow(newVotingEscrow).initialize(
        tokenBptAddr,
        name,
        symbol,
        msg.sender,
        maxLockTime
    )

    newRewardDistributor: address = create_minimal_proxy_to(self.rewardDistributor)
    IRewardDistributor(newRewardDistributor).initialize(
        newVotingEscrow,
        rewardDistributorStartTime,
        msg.sender
    )

    log VESystemCreated(
        tokenBptAddr,
        newVotingEscrow,
        newRewardDistributor,
        msg.sender
    )

    return (newVotingEscrow, newRewardDistributor)
```
