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

pragma solidity ^0.7.0;


import {IRewardDistributor} from "./IRewardDistributor.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";

/**
 * @title Lens Reward 
 */

contract LensReward {
   
    function getUserClaimableReward(
        IRewardDistributor distributor,
        address user,
        IERC20 token
    ) external returns (uint256) {
        uint256 balanceBefore = token.balanceOf(user);
        distributor.claimToken(user, token);
        uint256 balanceAfter = token.balanceOf(user);

        return balanceAfter - balanceBefore;
    }
}
