pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

// interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/AaveLendingPoolV2.sol";
import "../interfaces/DataTypes.sol";
import "../interfaces/AToken.sol";

contract aaveLendingPoolMockV2 is AaveLendingPoolV2 {
  address public dai;
  address public aDai;
  address public stableDebtTokenAddress;
  address public variableDebtTokenAddress;
  address public interestRateStrategyAddress;
  uint128 public currentLiquidityRate;

  constructor (address _dai, address _aDai) public {
    dai = _dai;
    aDai = _aDai;
  }

  function deposit(address, uint256 _amount, address _recipient, uint16) external {
    IERC20(aDai).transfer(_recipient, _amount);
  }

  function setStableDebtTokenAddress(address a) public {
    stableDebtTokenAddress = a;
  }

  function setVariableDebtTokenAddress(address a) public {
    variableDebtTokenAddress = a;
  }

  function setInterestRateStrategyAddress(address a) public {
    interestRateStrategyAddress = a;
  }

  function setCurrentLiquidityRate(uint128 v) public {
    currentLiquidityRate = v;
  }

  function getReserveData(address _reserve) external view returns(DataTypes.ReserveData memory) {
    DataTypes.ReserveData memory d;
    d.stableDebtTokenAddress = stableDebtTokenAddress;
    d.variableDebtTokenAddress = variableDebtTokenAddress;
    d.interestRateStrategyAddress = interestRateStrategyAddress;
    d.currentLiquidityRate = currentLiquidityRate;
    return d;
  }

  function withdraw(address _asset, uint256 _amount, address _to) external {
    AToken(aDai).burn(msg.sender, _to, _amount, 0);
  }
}
