# @version 0.3.7

"""
@title Launchpad
@license MIT
"""

votingEscrow: public(address)
rewardDistributor: public(address)
admin: public(address)


interface IVotingEscrow:
    def initialize(
        token: address,
        name: String[64],
        symbol: String[32],
        admin: address
    ): nonpayable

interface IRewardDistributor:
    def initialize(veAddress: address, startTime: uint256, admin: address): nonpayable


event NewVESystem:
    token: indexed(address)
    votingEscrow: address
    rewardDistributor: address
    admin: address


@external
def __init__(
    _votingEscrow: address, _rewardDistributor: address
):
    assert (
        _votingEscrow != empty(address) and
        _rewardDistributor != empty(address)
    ), "zero address"

    self.admin = msg.sender
    self.votingEscrow = _votingEscrow
    self.rewardDistributor = _rewardDistributor


@external
def deploy(
    tokenBptAddr: address,
    name: String[64],
    symbol: String[32],
    rewardDistributorStartTime: uint256,
) -> (address, address):

    newVotingEscrow: address = create_minimal_proxy_to(self.votingEscrow)
    IVotingEscrow(newVotingEscrow).initialize(
        tokenBptAddr,
        name,
        symbol,
        msg.sender
    )

    newRewardDistributor: address = create_minimal_proxy_to(self.rewardDistributor)
    IRewardDistributor(newRewardDistributor).initialize(
        newVotingEscrow,
        rewardDistributorStartTime,
        msg.sender
    )

    log NewVESystem(
        tokenBptAddr,
        newVotingEscrow,
        newRewardDistributor,
        msg.sender
    )

    return (newVotingEscrow, newRewardDistributor)
