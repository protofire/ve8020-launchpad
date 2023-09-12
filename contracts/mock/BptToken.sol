// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BPTToken is ERC20 {
    constructor() ERC20('BPTToken1', 'BPT1') {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}