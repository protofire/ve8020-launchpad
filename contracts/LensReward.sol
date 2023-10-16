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

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IRewardDistributor {
    function claimToken(address user, IERC20 token) external returns (uint256);
}

/**
 * @title Lens Reward 
 */
contract LensReward {

    struct ClaimableRewards {
        address token;
        uint256 claimableAmount;
    }

    function getUserClaimableReward(
        IRewardDistributor distributor,
        address user,
        IERC20 token
    ) public returns (ClaimableRewards memory) {
        uint256 balanceBefore = token.balanceOf(user);
        distributor.claimToken(user, token);
        uint256 balanceAfter = token.balanceOf(user);

        return ClaimableRewards({
            token: address(token),
            claimableAmount: balanceAfter - balanceBefore
        });
    }

    function getUserClaimableRewardsAll(
        IRewardDistributor distributor,
        address user,
        IERC20[] calldata tokens
    ) external returns (ClaimableRewards[] memory) {
        uint256 len = tokens.length;
        ClaimableRewards[] memory res = new ClaimableRewards[](len);

        for (uint256 i = 0; i < len; ++i) {
            res[i] = getUserClaimableReward(distributor, user, tokens[i]);
        }

        return res;
    }
}
