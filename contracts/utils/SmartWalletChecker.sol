// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface SmartWalletChecker {
    function check(address) external view returns (bool);
}

contract SmartWalletWhitelist {
    
    mapping(address => bool) public wallets;
    address public admin;
    address public checker;
    
    event ApproveWallet(address);
    event RevokeWallet(address);
    event NewChecker(address);
    
    constructor(address _admin) {
        admin = _admin;
    }
    
    function setChecker(address _checker) external {
        require(msg.sender == admin, "!admin");
        checker = _checker;

        emit NewChecker(_checker);
    }
    
    function approveWallet(address _wallet) public {
        require(msg.sender == admin, "!admin");
        wallets[_wallet] = true;
        
        emit ApproveWallet(_wallet);
    }

    function approveWalletList(address[] calldata _wallets) external {
        uint256 len = _wallets.length;
        for (uint256 i; i < len; ) {
            approveWallet(_wallets[i]);
            unchecked { ++i; }
        }
    }

    function revokeWallet(address _wallet) public {
        require(msg.sender == admin, "!admin");
        wallets[_wallet] = false;
        
        emit RevokeWallet(_wallet);
    }
    
    function revokeWalletList(address[] calldata _wallets) external {
        uint256 len = _wallets.length;
        for (uint256 i; i < len; ) {
            revokeWallet(_wallets[i]);
            unchecked { ++i; }
        }
    }

    function check(address _wallet) external view returns (bool) {
        bool _check = wallets[_wallet];
        if (_check) {
            return _check;
        } else {
            if (checker != address(0)) {
                return SmartWalletChecker(checker).check(_wallet);
            }
        }
        return false;
    }
}
