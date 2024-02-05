// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BalancerToken is ERC20 {
    constructor() ERC20("Balancer", "BAL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
