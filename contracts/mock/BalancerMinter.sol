// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function mint(address to, uint256 amount) external;

}

contract BalancerMinter {

    IERC20 public immutable balToken;

    mapping(address => uint256) public gaugeMultiplier;

    constructor(IERC20 _balToken) {
        balToken = _balToken;
    }

    function mint(address gauge) external returns (uint256) {
        return _mintFor(gauge, msg.sender);
    }

    function _mintFor(address gauge, address account) internal returns (uint256 tokensToMint) {
        uint256 accountFunds = IERC20(gauge).balanceOf(account); 
        uint256 mintMultiplier = 10;
        tokensToMint = accountFunds * mintMultiplier;
        balToken.mint(account, tokensToMint);

    }
}
