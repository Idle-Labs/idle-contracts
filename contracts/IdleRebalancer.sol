pragma solidity 0.5.11;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/WhitePaperInterestRateModel.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// This implementation works with Compound and Fulcrum only
// when a new protocol will be added this should be replaced
// in IdleToken with the new IdleRebalancer
contract IdleRebalancer is Ownable {
  using SafeMath for uint256;
  address public cToken;
  address public iToken;
  address public cWrapper;
  address public iWrapper;

  constructor(address _cToken, address _iToken, address _cWrapper, address _iWrapper) public {
    cToken = _cToken;
    iToken = _iToken;
    cWrapper = _cWrapper;
    iWrapper = _iWrapper;
  }
  // onlyOwner
  function setCToken(address _cToken)
    external onlyOwner {
      cToken = _cToken;
  }
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }
  function setCTokenWrapper(address _cWrapper)
    external onlyOwner {
      cWrapper = _cWrapper;
  }
  function setITokenWrapper(address _iWrapper)
    external onlyOwner {
      iWrapper = _iWrapper;
  }


  /**
   * @dev check `info_rebalance.md` for more info
   * TODO a summary of rebalnce.md should be reported here
   */
  function calcRebalanceAmounts(uint256 n)
    public view
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    CERC20 _cToken = CERC20(cToken);
    WhitePaperInterestRateModel white = WhitePaperInterestRateModel(_cToken.interestRateModel());

    uint256[] memory paramsCompound;
    paramsCompound[0] = 10 ** 18; // j
    paramsCompound[1] = white.baseRate(); // a
    paramsCompound[2] = _cToken.totalBorrows(); // b
    paramsCompound[3] = white.multiplier(); // c
    paramsCompound[4] = _cToken.totalReserves(); // d
    paramsCompound[5] = paramsCompound[0].sub(_cToken.reserveFactorMantissa()); // e
    paramsCompound[6] = _cToken.getCash(); // s
    paramsCompound[7] = _cToken.blocksInAYear(); // k
    paramsCompound[8] = 100; // f

    iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);

    uint256[] memory paramsFulcrum;
    paramsFulcrum[0] = _iToken.avgBorrowInterestRate(); // a1
    paramsFulcrum[1] = _iToken.totalAssetBorrow(); // b1
    paramsFulcrum[2] = _iToken.totalAssetSupply(); // s1
    paramsFulcrum[3] = _iToken.spreadMultiplier(); // o1
    paramsFulcrum[4] = 10 ** 20; // k1

    uint256 amountFulcrum = n.mul(paramsFulcrum[2].div(paramsFulcrum[2].add(paramsCompound[6])));

    amounts = bisection(
      n.sub(amountFulcrum), // amountCompound
      amountFulcrum,
      10 ** 17, // 0.1% of rate difference,
      30, // maxIter
      n,
      paramsCompound,
      paramsFulcrum
    ); // returns [compound, fulcrum]

    tokenAddresses[0] = cToken;
    tokenAddresses[1] = iToken;
    return (tokenAddresses, amounts);
  }

  function bisection(
    uint256 amountCompound, uint256 amountFulcrum,
    uint256 tolerance, uint256 maxIter, uint256 n,
    uint256[] memory paramsCompound,
    uint256[] memory paramsFulcrum
  )
    internal view
    returns (uint256[] memory amounts) {
    // TODO, recursive?

    /* uint256 currFulcRate = ILendingProtocol(iWrapper).nextSupplyRateWithParams(0, paramsFulcrum);
    uint256 currCompRate = ILendingProtocol(cWrapper).nextSupplyRateWithParams(0, paramsCompound);
    bool isOldCompoundBest = currCompRate > currFulcRate;

    uint256 smallerAmount = amountCompound < amountFulcrum ? amountCompound : amountFulcrum;
    uint256 fulcNewRate;
    uint256 compNewRate;
    bool isCompoundBest; // sign
    uint8 i = 0;
    while (
      (fulcNewRate.add(tolerance) >= compNewRate && isCompoundBest ||
      (compNewRate.add(tolerance) >= fulcNewRate && !isCompoundBest)) &&
      i <= maxIter
    ) {
      fulcNewRate = ILendingProtocol(iWrapper).nextSupplyRateWithParams(amountFulcrum, paramsFulcrum);
      compNewRate = ILendingProtocol(cWrapper).nextSupplyRateWithParams(amountCompound, paramsCompound);
      isCompoundBest = compNewRate > fulcNewRate;
      i++;
    }

    amounts[0] = amountCompound;
    amounts[1] = amountFulcrum;
    return amounts; */
  }
}
