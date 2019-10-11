/**
 * @title: Idle Rebalancer contract
 * @summary: Used for calculating amounts to lend on each implemented protocol.
 *           This implementation works with Compound and Fulcrum only
 *           when a new protocol will be added this should be replaced
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/WhitePaperInterestRateModel.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancer is Ownable {
  using SafeMath for uint256;
  // protocol token (cToken) address
  address public cToken;
  // protocol token (iToken) address
  address public iToken;
  // cToken protocol wrapper IdleCompound
  address public cWrapper;
  // iToken protocol wrapper IdleFulcrum
  address public iWrapper;
  // max % difference between next supply rate of Fulcrum and Compound
  uint256 public maxRateDifference;
  // max number of recursive calls for bisection algorithm
  uint256 public maxIterations;

  /**
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _cWrapper : cWrapper address
   * @param _iWrapper : iWrapper address
   */
  constructor(address _cToken, address _iToken, address _cWrapper, address _iWrapper) public {
    cToken = _cToken;
    iToken = _iToken;
    cWrapper = _cWrapper;
    iWrapper = _iWrapper;
    maxRateDifference = 10**17; // 0.1%
    maxIterations = 30;
  }

  // onlyOwner
  /**
   * sets cToken address
   * @param _cToken : cToken address
   */
  function setCToken(address _cToken)
    external onlyOwner {
      cToken = _cToken;
  }

  /**
   * sets iToken address
   * @param _iToken : iToken address
   */
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }

  /**
   * sets cToken wrapper address
   * @param _cWrapper : cToken wrapper address
   */
  function setCTokenWrapper(address _cWrapper)
    external onlyOwner {
      cWrapper = _cWrapper;
  }

  /**
   * sets iToken wrapper address
   * @param _iWrapper : iToken wrapper address
   */
  function setITokenWrapper(address _iWrapper)
    external onlyOwner {
      iWrapper = _iWrapper;
  }

  /**
   * sets maxIterations for bisection recursive calls
   * @param _maxIterations : max rate difference in percentage scaled by 10**18
   */
  function setMaxIterations(uint256 _maxIterations)
    external onlyOwner {
      maxIterations = _maxIterations;
  }

  /**
   * sets maxRateDifference
   * @param _maxDifference : max rate difference in percentage scaled by 10**18
   */
  function setMaxRateDifference(uint256 _maxDifference)
    external onlyOwner {
      maxRateDifference = _maxDifference;
  }
  // end onlyOwner

  /**
   * Used by IdleToken contract to calculate the amount to be lended
   * on each protocol in order to get the best available rate for all funds.
   *
   * @param n : amount of underlying tokens (eg. DAI) to rebalance
   * @return tokenAddresses : array with all token addresses used,
   *                          currently [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   */
  function calcRebalanceAmounts(uint256 n)
    external view
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    // Get all params for calculating Compound nextSupplyRateWithParams
    CERC20 _cToken = CERC20(cToken);
    WhitePaperInterestRateModel white = WhitePaperInterestRateModel(_cToken.interestRateModel());
    uint256[] memory paramsCompound = new uint256[](10);
    paramsCompound[0] = 10**18; // j
    paramsCompound[1] = white.baseRate(); // a
    paramsCompound[2] = _cToken.totalBorrows(); // b
    paramsCompound[3] = white.multiplier(); // c
    paramsCompound[4] = _cToken.totalReserves(); // d
    paramsCompound[5] = paramsCompound[0].sub(_cToken.reserveFactorMantissa()); // e
    paramsCompound[6] = _cToken.getCash(); // s
    paramsCompound[7] = _cToken.blocksInAYear(); // k
    paramsCompound[8] = 100; // f

    // Get all params for calculating Fulcrum nextSupplyRateWithParams
    iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);
    uint256[] memory paramsFulcrum = new uint256[](6);
    paramsFulcrum[0] = _iToken.avgBorrowInterestRate(); // a1
    paramsFulcrum[1] = _iToken.totalAssetBorrow(); // b1
    paramsFulcrum[2] = _iToken.totalAssetSupply(); // s1
    paramsFulcrum[3] = _iToken.spreadMultiplier(); // o1
    paramsFulcrum[4] = 10**20; // k1

    // Initial guess for shrinking initial bisection interval
    /*
      Compound: (getCash returns the available supply only, not the borrowed one)
      getCash + totalBorrows = totalSuppliedCompound

      Fulcrum:
      totalSupply = totalSuppliedFulcrum

      we try to correlate borrow and supply on both markets
      totC = totalSuppliedCompound + totalBorrowsCompound
      totF = totalSuppliedFulcrum + totalBorrowsFulcrum

      n : (totC + totF) = x : totF
      x = n * totF / (totC + totF)
    */

    uint256 amountFulcrum = n.mul(paramsFulcrum[2].add(paramsFulcrum[1])).div(
      paramsFulcrum[2].add(paramsFulcrum[1]).add(paramsCompound[6].add(paramsCompound[2]).add(paramsCompound[2]))
    );

    // Recursive bisection algorithm
    amounts = bisectionRec(
      n.sub(amountFulcrum), // amountCompound
      amountFulcrum,
      maxRateDifference, // 0.1% of rate difference,
      0, // currIter
      maxIterations, // maxIter
      n,
      paramsCompound,
      paramsFulcrum
    ); // returns [amountCompound, amountFulcrum]

    tokenAddresses = new address[](2);
    tokenAddresses[0] = cToken;
    tokenAddresses[1] = iToken;
    return (tokenAddresses, amounts);
  }

  /**
   * Internal implementation of our bisection algorithm
   *
   * @param amountCompound : amount to be lended in compound in current iteration
   * @param amountFulcrum : amount to be lended in Fulcrum in current iteration
   * @param tolerance : max % difference between next supply rate of Fulcrum and Compound
   * @param currIter : current iteration
   * @param maxIter : max number of iterations
   * @param n : amount of underlying tokens (eg. DAI) to rebalance
   * @param paramsCompound : array with all params (except for the newDAIAmount)
   *                          for calculating next supply rate of Compound
   * @param paramsFulcrum : array with all params (except for the newDAIAmount)
   *                          for calculating next supply rate of Fulcrum
   * @return amounts : array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   */
  function bisectionRec(
    uint256 amountCompound, uint256 amountFulcrum,
    uint256 tolerance, uint256 currIter, uint256 maxIter, uint256 n,
    uint256[] memory paramsCompound,
    uint256[] memory paramsFulcrum
  )
    internal view
    returns (uint256[] memory amounts) {

    // sets newDAIAmount for each protocol
    paramsCompound[9] = amountCompound;
    paramsFulcrum[5] = amountFulcrum;

    // calculate next rates with amountCompound and amountFulcrum
    uint256 currFulcRate = ILendingProtocol(iWrapper).nextSupplyRateWithParams(paramsFulcrum);
    uint256 currCompRate = ILendingProtocol(cWrapper).nextSupplyRateWithParams(paramsCompound);
    bool isCompoundBest = currCompRate > currFulcRate;

    // bisection interval update, we choose to halve the smaller amount
    uint256 step = amountCompound < amountFulcrum ? amountCompound.div(2) : amountFulcrum.div(2);

    // base case
    // |fulcrumRate - compoundRate| <= tolerance
    if (
      ((currFulcRate.add(tolerance) >= currCompRate && isCompoundBest) ||
      (currCompRate.add(tolerance) >= currFulcRate && !isCompoundBest)) ||
      currIter >= maxIter
    ) {
      amounts = new uint256[](2);
      amounts[0] = amountCompound;
      amounts[1] = amountFulcrum;
      return amounts;
    }

    return bisectionRec(
      isCompoundBest ? amountCompound.add(step) : amountCompound.sub(step),
      isCompoundBest ? amountFulcrum.sub(step) : amountFulcrum.add(step),
      tolerance, currIter + 1, maxIter, n,
      paramsCompound, // paramsCompound[9] would be overwritten on next iteration
      paramsFulcrum // paramsFulcrum[5] would be overwritten on next iteration
    );
  }
}
