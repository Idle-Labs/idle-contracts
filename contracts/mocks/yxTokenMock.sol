/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "./yxTokenNoConst.sol";
import "./DyDxMock.sol";

contract yxTokenMock is yxTokenNoConst {
  uint256 public priceFake;

  constructor(address _underlying, uint256 _marketId, string memory _name, string memory _symbol, uint8 _decimals, address someone)
    public yxTokenNoConst(_underlying, _marketId, _name, _symbol, _decimals) {
    _mint(address(this), 10**24); // 1.000.000 aDAI
    _mint(someone, 10**24); // 1.000 yxDAI
  }
  function setDyDxProvider(address _dydxAddressesProvider) external {
    dydxAddressesProvider = _dydxAddressesProvider;
    dydx = DyDxMock(_dydxAddressesProvider);
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
  function mint(uint256 amount) external returns (uint256) {
    require(IERC20(underlying).transferFrom(msg.sender, address(this), amount), "Error during transferFrom");
    _mint(msg.sender, (amount * 10**18)/priceFake);
    return (amount * 10**18)/priceFake;
  }
  function redeem(uint256 amount, address _account) external returns (uint256 tokens) {
    _burn(msg.sender, amount);
    require(IERC20(underlying).transfer(_account, amount * priceFake / 10**18), "Error during transfer"); // 1 DAI
    return amount * priceFake / 10**18;
  }
  function setPriceForTest(uint256 _priceFake) external {
    priceFake = _priceFake;
  }
}
