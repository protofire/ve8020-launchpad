// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface ISmartWalletChecker {
    function check(address) external view returns (bool);
}

contract SmartWalletWhitelist {

    address public immutable admin;

    mapping(address => bool) public wallets;

    address public checker;
    bool public isAllowAll = false;

    event ApproveWallet(address);
    event RevokeWallet(address);
    event NewChecker(address);
    event SetAllowAll(bool);

    modifier onlyAdmin() {
        require(admin == msg.sender, "!admin");
        _;
    }

    constructor(address _admin) {
        admin = _admin;
    }

    // @notice Sets allowance (permission) for all contracts
    // @param _isAllowAll - The boolean parameter to set if it allowed for all contract
    function setAllowAll(bool _isAllowAll) external onlyAdmin {
        isAllowAll = _isAllowAll;
        emit SetAllowAll(_isAllowAll);
    }

    // @notice Sets checker contract for further allowance check
    // @dev can be zero-address in case when no need to use `checker`
    // @param _checker - The address of a checker contract
    function setChecker(address _checker) external onlyAdmin {
        checker = _checker;

        emit NewChecker(_checker);
    }

    // @notice Approves one particular address
    // @param _wallet - The address of a contract to be approved
    function approveWallet(address _wallet) public onlyAdmin {
        wallets[_wallet] = true;
        
        emit ApproveWallet(_wallet);
    }

    // @notice Approves list of addresses
    // @param _wallets - The array of contract addresses to be approved
    function approveWalletList(address[] calldata _wallets) external {
        uint256 len = _wallets.length;
        for (uint256 i; i < len; ) {
            approveWallet(_wallets[i]);
            unchecked { ++i; }
        }
    }

    // @notice Revokes allowance for one particular address
    // @param _wallets - The address of a contract to revoke allowance
    function revokeWallet(address _wallet) public onlyAdmin {
        require(msg.sender == admin, "!admin");
        wallets[_wallet] = false;
        
        emit RevokeWallet(_wallet);
    }

    // @notice Revokes allowance for the list of addresses
    // @param _wallets - The array of contract addresses to revoke allowance
    function revokeWalletList(address[] calldata _wallets) external {
        uint256 len = _wallets.length;
        for (uint256 i; i < len; ) {
            revokeWallet(_wallets[i]);
            unchecked { ++i; }
        }
    }

    // @notice Checks provided address for allowance or delegates such check to 'checker' contract (if exist)
    // @param _wallet - The address to check for allowance
    function check(address _wallet) external view returns (bool) {
        if (isAllowAll) return true;

        bool _check = wallets[_wallet];
        if (_check) {
            return _check;
        } else {
            if (checker != address(0)) {
                return ISmartWalletChecker(checker).check(_wallet);
            }
        }
        return false;
    }
}
