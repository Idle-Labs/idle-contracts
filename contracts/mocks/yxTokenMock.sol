/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "../wrappers/yxToken.sol";

contract yxTokenMock is yxToken {
  constructor(address _underlying, uint256 _marketId, string memory _name, string memory _symbol, uint8 _decimals)
    public yxToken(_underlying, _marketId, _name, _symbol, _decimals) {
    _mint(msg.sender, 10**21); // 1.000 yxDAI
  }
  function setDyDxProvider(address _dydxAddressesProvider) external {
    dydxAddressesProvider = _dydxAddressesProvider;
  }
  function approveDyDx() external {
    IERC20(underlying).approve(dydxAddressesProvider, uint256(-1));
  }
  function mintDyDx(uint256 _amount)
    external {
    return _mintDyDx(_amount);
  }
  function redeemDyDx(uint256 _amount)
    external {
    return _redeemDyDx(_amount);
  }
}
