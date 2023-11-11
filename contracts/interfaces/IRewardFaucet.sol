// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IRewardFaucet {

    function distributePastRewards(address rewardToken) external;

}
