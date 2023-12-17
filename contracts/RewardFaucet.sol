// SPDX-License-Identifier: MIT
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IRewardDistributor {
    function claimToken(address user, address token) external returns (uint256);
    function faucetDepositToken(address token, uint256 amount) external;
}

/**
 * @title RewardFaucet
 * @notice The contract offers users the flexibility to manage and distribute rewards while
 *         ensuring equitable and even distribution of tokens over specified time periods.
 */
contract RewardFaucet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bool public isInitialized;

    IRewardDistributor public rewardDistributor;

    mapping(address token => uint256 rewardAmount) public totalTokenRewards;

    mapping(address token => mapping(uint256 weekStart => uint256 amount)) public tokenWeekAmounts;

    event WeeksDistributions(address token, uint256 totalAmount, uint256 weeksCount);
    event ExactWeekDistribution(address token, uint256 totalAmount, uint256 weeksCount);
    event DistributePast(address token, uint256 amount, uint256 weekStart);
    event MovePastRewards(address token, uint256 moveAmount, uint256 pastWeekStart, uint256 nextWeekStart);


    function initialize(address _rewardDistributor) external {
        require(!isInitialized, "!twice");
        require(_rewardDistributor != address(0), '!zero');
        isInitialized = true;
        rewardDistributor = IRewardDistributor(_rewardDistributor);
    }

    /**
     * @notice Deposit rewards evenly across a specified period starting from the current week
     * @dev weekAmount = amount / weeksCount
     * @param token The address of the token to be deposited as a reward
     * @param amount The total amount of `token` to be deposited as a reward over the entire period
     * @param weeksCount The number of weeks, including the current one, over which the rewards will be distributed
     */
    function depositEqualWeeksPeriod(
        address token,
        uint256 amount,
        uint256 weeksCount
    ) nonReentrant external {
        require(weeksCount > 0 && weeksCount <= 104, '!week');

        // if some tokens were transferred directly
        uint256 currentDiff = IERC20(token).balanceOf(address(this)) - totalTokenRewards[token];
        uint256 totalAmount = currentDiff > 0 ? amount + currentDiff : amount;

        uint256 weekAmount = totalAmount / weeksCount;

        if (weeksCount != 1) {
            // current week will be distributed now, thus filling map from the next week
            uint256 weekStart = _roundUpTimestamp(block.timestamp);

            for (uint256 i = 2; i <= weeksCount; ) {
                // last iteration with leftovers
                if (i == weeksCount) {
                    tokenWeekAmounts[token][weekStart] += (totalAmount - weekAmount * (weeksCount - 1));
                    break;
                }

                tokenWeekAmounts[token][weekStart] += weekAmount;

                unchecked { i++; }
                weekStart += 1 weeks;
            }

            // first week will be distributed now, thus subtract 1 weekAmount
            totalTokenRewards[token] += totalAmount - weekAmount;
        }

        // don't confuse with 'totalAmount'
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // current week distribution
        IRewardDistributor rewardDistributor_ = rewardDistributor;
        IERC20(token).forceApprove(address(rewardDistributor_), weekAmount);
        rewardDistributor_.faucetDepositToken(token, weekAmount);

        emit WeeksDistributions(token, totalAmount, weeksCount);
    }

    /**
     * @notice Deposit rewards into a specific week (starting from current)
     * @dev If a week is separated from previous reward weeks, 
     *      or rewards were not claimed in previous weeks in the RewardDistributor contract,
     *      users may need to manually call the `distributePastRewards()` function 
     *      to ensure that the rewards are added to the RewardDistributor contract.
     * @param token The address of the token to be deposited as a reward
     * @param amount The amount of `token` to be deposited as a reward
     * @param weekTimeStamp The timestamp of the week for which rewards are being distributed
     */
    function depositExactWeek(
        address token,
        uint256 amount,
        uint256 weekTimeStamp
    ) nonReentrant external {
        require(
            weekTimeStamp >= _roundDownTimestamp(block.timestamp) && weekTimeStamp <= block.timestamp + 104 weeks,
            'bad week'
        );

        // if some tokens were transferred directly
        uint256 currentDiff = IERC20(token).balanceOf(address(this)) - totalTokenRewards[token];
        uint256 totalAmount = currentDiff > 0 ? amount + currentDiff : amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 weekStart = _roundDownTimestamp(weekTimeStamp);
        if (weekStart == _roundDownTimestamp(block.timestamp)) {
            // current week will be distributed now
            IRewardDistributor rewardDistributor_ = rewardDistributor;
            IERC20(token).forceApprove(address(rewardDistributor_), totalAmount);
            rewardDistributor_.faucetDepositToken(token, totalAmount);
        } else {
            tokenWeekAmounts[token][weekStart] += totalAmount;
            totalTokenRewards[token] += totalAmount;
        }

        emit ExactWeekDistribution(token, totalAmount, weekStart);
    }


    /**
     * @notice Collects all rewards for 10 past weeks and sends them to RewardDistributor
     * @param token - the token address to collect rewards
     */
    function distributePastRewards(address token) external {
        if (totalTokenRewards[token] == 0) return;
        
        uint256 weekStart = _roundDownTimestamp(block.timestamp);

        uint256 totalAmount;
        for (uint256 i = 0; i < 10; ++i) {
            uint256 amount = tokenWeekAmounts[token][weekStart];
            if (amount == 0) {
                weekStart -= 1 weeks;
                continue;
            }

            tokenWeekAmounts[token][weekStart] = 0;
            totalAmount += amount;
            weekStart -= 1 weeks;
        }

        if (totalAmount > 0) {
            totalTokenRewards[token] -= totalAmount;

            IRewardDistributor rewardDistributor_ = rewardDistributor;
            IERC20(token).forceApprove(address(rewardDistributor_), totalAmount);
            rewardDistributor_.faucetDepositToken(token, totalAmount);

            emit DistributePast(token, totalAmount, weekStart);
        }
        
    }

    /**
    * @notice Manually moves unclaimed past rewards to the next week to enable distribution
    * @dev This function can be called by anyone
    * @param token The reward token address to be moved
    * @param pastWeekTimestamp The timestamp representing a point in the past week (must be at least 10 weeks ago)
    */
    function movePastRewards(address token, uint256 pastWeekTimestamp) external {
        uint256 pastWeekStart = _roundDownTimestamp(pastWeekTimestamp);
        require(pastWeekStart < _roundDownTimestamp(block.timestamp) - 9 weeks, '!outdate');
        
        uint256 nextWeekStart = _roundUpTimestamp(block.timestamp);
        
        uint256 moveAmount = tokenWeekAmounts[token][pastWeekStart];
        tokenWeekAmounts[token][pastWeekStart] = 0;
        tokenWeekAmounts[token][nextWeekStart] += moveAmount;

        emit MovePastRewards(token, moveAmount, pastWeekStart, nextWeekStart);
    }

    /**
    * @notice Returns the reward amount for a specified week (represented by a point within the week)
    * @dev The `pointOfWeek` parameter is any timestamp within the week: wStart[---p-----]wEnd
    * @param token The address of the reward token to be distributed
    * @param pointOfWeek The timestamp representing a specific week
    * @return The reward amount for the specified week
    */
    function getTokenWeekAmounts(address token, uint256 pointOfWeek) external view returns (uint256) {
        uint256 weekStart = _roundDownTimestamp(pointOfWeek);
        return tokenWeekAmounts[token][weekStart];
    }

    /**
    * @notice Returns rewards for a specified number of weeks starting from the current week
    * @param token The address of the reward token to be distributed
    * @param weeksCount The number of weeks to check rewards for
    * @return An array containing reward amounts for each week
    */
    function getUpcomingRewardsForNWeeks(
        address token,
        uint256 weeksCount
    ) external view returns (uint256[] memory) {
        uint256 weekStart = _roundDownTimestamp(block.timestamp);

        uint256[] memory rewards = new uint256[](weeksCount);
        for (uint256 i = 0; i < weeksCount; i++) {
            rewards[i] = tokenWeekAmounts[token][weekStart + i * 1 weeks];
        }
        return rewards;
    }


    /**
     * @dev Rounds the provided timestamp down to the beginning of the previous week (Thurs 00:00 UTC)
     */
    function _roundDownTimestamp(
        uint256 timestamp
    ) private pure returns (uint256) {
        return (timestamp / 1 weeks) * 1 weeks;
    }

    /**
     * @dev Rounds the provided timestamp up to the beginning of the next week (Thurs 00:00 UTC)
     */
    function _roundUpTimestamp(
        uint256 timestamp
    ) private pure returns (uint256) {
        // Overflows are impossible here for all realistic inputs.
        return _roundDownTimestamp(timestamp + 1 weeks);
    }
}
