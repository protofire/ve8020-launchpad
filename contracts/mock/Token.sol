// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract TestToken is ERC20 {
    constructor() ERC20('Token1', 'Symbl1') {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
