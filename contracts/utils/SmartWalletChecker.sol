// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

/**
 * @title A simple implementation of checker that allows all addresses
 */
contract SmartWalletChecker {

    /**
     * @notice Returns true for all addresses
     * @param _wallet Unused address parameter
     * @return Always `true`
     */
    function check(address _wallet) external pure returns(bool) {
        return true;
    }
} 