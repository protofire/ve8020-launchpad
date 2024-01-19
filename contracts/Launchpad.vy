# @version 0.3.7

"""
@title Launchpad
@license MIT
"""

votingEscrow: public(immutable(address))
rewardDistributor: public(immutable(address))
rewardFaucet: public(immutable(address))
balToken: public(immutable(address))
balMinter: public(immutable(address))


interface IVotingEscrow:
    def initialize(
        _token: address,
        _name: String[64],
        _symbol: String[32],
        _admin: address,
        _admin_unlock_all: address,
        _admin_early_unlock: address,
        _maxLockTime: uint256,
        _balToken: address,
        _balMinter: address,
        _rewardReceiver: address,
        _rewardReceiverChangeable: bool
    ): nonpayable

interface IRewardDistributor:
    def initialize(
        _veAddress: address,
        _rewardFaucet: address,
        _startTime: uint256,
        _admin: address
    ): nonpayable

interface IRewardFaucet:
    def initialize(
        _rewardDistributor: address,
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
    _rewardFaucet: address,
    _balToken: address,
    _balMinter: address
):
    assert (
        _votingEscrow != empty(address) and
        _rewardDistributor != empty(address) and
        _rewardFaucet != empty(address) and
        _balToken != empty(address) and
        _balMinter != empty(address)
    ), "zero address"

    votingEscrow = _votingEscrow
    rewardDistributor = _rewardDistributor
    rewardFaucet = _rewardFaucet
    balToken = _balToken
    balMinter = _balMinter


@external
def deploy(
    tokenBptAddr: address,
    name: String[64],
    symbol: String[32],
    maxLockTime: uint256,
    rewardDistributorStartTime: uint256,
    admin_unlock_all: address,
    admin_early_unlock: address,
    rewardReceiver: address
) -> (address, address, address):
    """
    @notice Deploys new VotingEscrow, RewardDistributor and RewardFaucet contracts
    @param tokenBptAddr The address of the token to be used for locking
    @param name The name for the new VotingEscrow contract
    @param symbol The symbol for the new VotingEscrow contract
    @param maxLockTime A constraint for the maximum lock time in the new VotingEscrow contract
    @param rewardDistributorStartTime The start time for reward distribution
    @param admin_unlock_all Admin address to enable unlock-all feature in VotingEscrow (zero-address to disable forever)
    @param admin_early_unlock Admin address to enable eraly-unlock feature in VotingEscrow (zero-address to disable forever)
    @param rewardReceiver The receiver address of claimed BAL-token rewards
    """
    assert(balToken != tokenBptAddr), '!bal'
    newVotingEscrow: address = create_minimal_proxy_to(votingEscrow)
    newRewardDistributor: address = create_minimal_proxy_to(rewardDistributor)
    

    rewardReceiverChangeable: bool = True
    rewardReceiver_: address = rewardReceiver
    if rewardReceiver == empty(address):
        rewardReceiver_ = newRewardDistributor
        rewardReceiverChangeable = False

    IVotingEscrow(newVotingEscrow).initialize(
        tokenBptAddr,
        name,
        symbol,
        msg.sender,
        admin_unlock_all,
        admin_early_unlock,
        maxLockTime,
        balToken,
        balMinter,
        rewardReceiver_,
        rewardReceiverChangeable
    )

    newRewardFaucet: address = create_minimal_proxy_to(rewardFaucet)
    
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

    return (newVotingEscrow, newRewardDistributor, newRewardFaucet)
