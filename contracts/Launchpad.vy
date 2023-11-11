# @version 0.3.7

"""
@title Launchpad
@license MIT
"""

votingEscrow: public(address)
rewardDistributor: public(address)
rewardFaucet: public(address)

admin: public(address)


interface IVotingEscrow:
    def initialize(
        token: address,
        name: String[64],
        symbol: String[32],
        admin: address,
        maxLockTime: uint256
    ): nonpayable

interface IRewardDistributor:
    def initialize(
        veAddress: address,
        rewardFaucet: address,
        startTime: uint256,
        admin: address
    ): nonpayable

interface IRewardFaucet:
    def initialize(
        rewardDistributor: address,
    ): nonpayable

event VESystemCreated:
    token: indexed(address)
    votingEscrow: address
    rewardDistributor: address
    rewardFaucet: address
    admin: address


@external
def __init__(
    _votingEscrow: address,
    _rewardDistributor: address,
    _rewardFaucet: address
):
    assert (
        _votingEscrow != empty(address) and
        _rewardDistributor != empty(address) and
        _rewardFaucet != empty(address)
    ), "zero address"

    self.admin = msg.sender
    self.votingEscrow = _votingEscrow
    self.rewardDistributor = _rewardDistributor
    self.rewardFaucet = _rewardFaucet


@external
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
    newRewardFaucet: address = create_minimal_proxy_to(self.rewardFaucet)
    
    IRewardDistributor(newRewardDistributor).initialize(
        newVotingEscrow,
        newRewardFaucet,
        rewardDistributorStartTime,
        msg.sender
    )

    IRewardFaucet(newRewardFaucet).initialize(
        newRewardDistributor
    )

    log VESystemCreated(
        tokenBptAddr,
        newVotingEscrow,
        newRewardDistributor,
        newRewardFaucet,
        msg.sender
    )

    return (newVotingEscrow, newRewardDistributor)
