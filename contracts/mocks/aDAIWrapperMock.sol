pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../mocks/IdleAaveNoConst.sol";

contract aDAIWrapperMock is IdleAaveNoConst {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public price;
  uint256 public apr;
  uint256 public liquidity;
  uint256 public nextSupplyRateLocal;
  uint256 public nextSupplyRateWithParamsLocal;

  constructor(address _token, address _underlying)
    public IdleAaveNoConst(_token, _underlying) {
  }

  function nextSupplyRate(uint256) external view returns (uint256) {
    return nextSupplyRateLocal;
  }
  function _setNextSupplyRate(uint256 _nextSupplyRate) external returns (uint256) {
    nextSupplyRateLocal = _nextSupplyRate;
  }
  function _setNextSupplyRateWithParams(uint256 _nextSupplyRate) external returns (uint256) {
    nextSupplyRateWithParamsLocal = _nextSupplyRate;
  }
  function nextSupplyRateWithParams(uint256[] memory) public view returns (uint256) {
    return nextSupplyRateWithParamsLocal;
  }
  function getAPR() external view returns (uint256) {
    return apr;
  }
  function _setAPR(uint256 _apr) external returns (uint256) {
    apr = _apr;
  }
  function getPriceInToken() external view returns (uint256) {
    return price;
  }
  function _setPriceInToken(uint256 _price) external returns (uint256) {
    price = _price;
  }
  function _setAvailableLiquidity(uint256 _availableLiquidity) external returns (uint256) {
    liquidity = _availableLiquidity;
  }
  function availableLiquidity() external view returns (uint256) {
    return liquidity;
  }
}
