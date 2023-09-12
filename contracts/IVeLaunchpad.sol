// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface ILaunchpad {

    function votingEscrow() external view returns (address);

    function rewardDistributor() external view returns (address);

    function deploy(
        address tokenBptAddr,
        string memory name,
        string memory symbol,
        uint256 rewardDistributorStartTime
    ) external returns (address, address);
}
