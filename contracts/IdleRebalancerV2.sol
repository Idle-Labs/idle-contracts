/**
 * @title: Idle Rebalancer contract
 * @summary: Used for calculating amounts to lend on each implemented protocol.
 *           This implementation works with Compound and Fulcrum only,
 *           when a new protocol will be added this should be replaced
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/WhitePaperInterestRateModel.sol";
import "./interfaces/IIdleRebalancer.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancerV2 is IIdleRebalancer, Ownable {
  using SafeMath for uint256;
  // IdleToken address
  address public idleToken;
  // protocol token (cToken) address
  address public cToken;
  // protocol token (iToken) address
  address public iToken;
  // cToken protocol wrapper IdleCompound
  address public cWrapper;
  // iToken protocol wrapper IdleFulcrum
  address public iWrapper;
  // max % difference between next supply rate of Fulcrum and Compound
  uint256 public maxRateDifference; // 10**17 -> 0.1 %
  // max % difference between off-chain user supplied params for rebalance and actual amount to be rebalanced
  uint256 public maxSupplyedParamsDifference; // 100000 -> 0.001%
  // max number of recursive calls for bisection algorithm
  uint256 public maxIterations;
  uint256 public blocksPerYear;

  /**
   * @param _cToken : cToken address
   * @param _iToken : iToken address
   * @param _cWrapper : cWrapper address
   * @param _iWrapper : iWrapper address
   */
  constructor(address _cToken, address _iToken, address _cWrapper, address _iWrapper) public {
    require(_cToken != address(0) && _iToken != address(0) && _cWrapper != address(0) && _iWrapper != address(0), 'some addr is 0');

    cToken = _cToken;
    iToken = _iToken;
    cWrapper = _cWrapper;
    iWrapper = _iWrapper;
    maxRateDifference = 10**17; // 0.1%
    maxSupplyedParamsDifference = 100000; // 0.001%
    maxIterations = 30;
    blocksPerYear = 2371428; // ~13.3 sec blocktime
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken contract");
    _;
  }

  // onlyOwner
  /**
   * sets idleToken address
   * NOTE: can be called only once. It's not on the constructor because we are deploying this contract
   *       after the IdleToken contract
   * @param _idleToken : idleToken address
   */
  function setIdleToken(address _idleToken)
    external onlyOwner {
      require(idleToken == address(0), "idleToken addr already set");
      require(_idleToken != address(0), "_idleToken addr is 0");
      idleToken = _idleToken;
  }

  /**
   * sets blocksPerYear address
   *
   * @param _blocksPerYear : avg blocks per year
   */
  function setBlocksPerYear(uint256 _blocksPerYear)
    external onlyOwner {
      require(_blocksPerYear != 0, "_blocksPerYear is 0");
      blocksPerYear = _blocksPerYear;
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

  /**
   * sets maxSupplyedParamsDifference
   * @param _maxSupplyedParamsDifference : max rate difference in percentage scaled by 10**18
   */
  function setMaxSupplyedParamsDifference(uint256 _maxSupplyedParamsDifference)
    external onlyOwner {
      maxSupplyedParamsDifference = _maxSupplyedParamsDifference;
  }
  // end onlyOwner

  /**
   * Used by IdleToken contract to calculate the amount to be lended
   * on each protocol in order to get the best available rate for all funds.
   *
   * @param _rebalanceParams : first param is the total amount to be rebalanced,
   *                           all other elements are client side calculated amounts to put on each lending protocol
   * @return tokenAddresses : array with all token addresses used,
   *                          currently [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   */
  function calcRebalanceAmounts(uint256[] calldata _rebalanceParams)
    external view onlyIdle
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    // Get all params for calculating Compound nextSupplyRateWithParams
    CERC20 _cToken = CERC20(cToken);

    uint256[] memory paramsCompound = new uint256[](6);
    paramsCompound[0] = _cToken.totalBorrows(); // b
    paramsCompound[1] = _cToken.getCash(); // s
    paramsCompound[2] = _cToken.totalReserves();
    paramsCompound[3] = _cToken.reserveFactorMantissa();
    paramsCompound[4] = blocksPerYear;

    // Get all params for calculating Fulcrum nextSupplyRateWithParams
    iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);
    uint256[] memory paramsFulcrum = new uint256[](3);
    paramsFulcrum[0] = _iToken.totalAssetBorrow(); // b1
    paramsFulcrum[1] = _iToken.totalAssetSupply(); // s1

    tokenAddresses = new address[](2);
    tokenAddresses[0] = cToken;
    tokenAddresses[1] = iToken;

    // _rebalanceParams should be [totAmountToRebalance, amountCompound, amountFulcrum];
    if (_rebalanceParams.length == 3) {
      (bool amountsAreCorrect, uint256[] memory checkedAmounts) = checkRebalanceAmounts(_rebalanceParams, paramsCompound, paramsFulcrum);
      if (amountsAreCorrect) {
        return (tokenAddresses, checkedAmounts);
      }
    }

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

    uint256 amountFulcrum = _rebalanceParams[0].mul(paramsFulcrum[1].add(paramsFulcrum[0])).div(
      paramsFulcrum[1].add(paramsFulcrum[0]).add(paramsCompound[1].add(paramsCompound[0]).add(paramsCompound[0]))
    );

    // Recursive bisection algorithm
    amounts = bisectionRec(
      _rebalanceParams[0].sub(amountFulcrum), // amountCompound
      amountFulcrum,
      maxRateDifference, // 0.1% of rate difference,
      0, // currIter
      maxIterations, // maxIter
      _rebalanceParams[0],
      paramsCompound,
      paramsFulcrum
    ); // returns [amountCompound, amountFulcrum]

    return (tokenAddresses, amounts);
  }
  /**
   * Used by IdleToken contract to check if provided amounts
   * causes the rates of Fulcrum and Compound to be balanced
   * (counting a tolerance)
   *
   * @param rebalanceParams : first element is the total amount to be rebalanced,
   *                   the rest is an array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   * @param paramsCompound : array with all params (except for the newDAIAmount)
   *                          for calculating next supply rate of Compound
   * @param paramsFulcrum : array with all params (except for the newDAIAmount)
   *                          for calculating next supply rate of Fulcrum
   * @return bool : if provided amount correctly rebalances the pool
   */
  function checkRebalanceAmounts(
    uint256[] memory rebalanceParams,
    uint256[] memory paramsCompound,
    uint256[] memory paramsFulcrum
  )
    internal view
    returns (bool, uint256[] memory checkedAmounts)
  {
    // This is the amount that should be rebalanced no more no less
    uint256 actualAmountToBeRebalanced = rebalanceParams[0]; // n
    // interest is earned between when tx was submitted and when it is mined so params sent by users
    // should always be slightly less than what should be rebalanced
    uint256 totAmountSentByUser;
    for (uint8 i = 1; i < rebalanceParams.length; i++) {
      totAmountSentByUser = totAmountSentByUser.add(rebalanceParams[i]);
    }

    // check if amounts sent from user are less than actualAmountToBeRebalanced and
    // at most `actualAmountToBeRebalanced - 0.001% of (actualAmountToBeRebalanced)`
    if (totAmountSentByUser > actualAmountToBeRebalanced ||
        totAmountSentByUser.add(totAmountSentByUser.div(maxSupplyedParamsDifference)) < actualAmountToBeRebalanced) {
      return (false, new uint256[](2));
    }

    uint256 interestToBeSplitted = actualAmountToBeRebalanced.sub(totAmountSentByUser);

    // sets newDAIAmount for each protocol
    paramsCompound[5] = rebalanceParams[1].add(interestToBeSplitted.div(2));
    paramsFulcrum[2] = rebalanceParams[2].add(interestToBeSplitted.sub(interestToBeSplitted.div(2)));

    // calculate next rates with amountCompound and amountFulcrum
    uint256 currFulcRate = ILendingProtocol(iWrapper).nextSupplyRateWithParams(paramsFulcrum);
    uint256 currCompRate = ILendingProtocol(cWrapper).nextSupplyRateWithParams(paramsCompound);
    bool isCompoundBest = currCompRate > currFulcRate;
    // |fulcrumRate - compoundRate| <= tolerance
    bool areParamsOk = (currFulcRate.add(maxRateDifference) >= currCompRate && isCompoundBest) ||
      (currCompRate.add(maxRateDifference) >= currFulcRate && !isCompoundBest);

    uint256[] memory actualParams = new uint256[](2);
    actualParams[0] = paramsCompound[5];
    actualParams[1] = paramsFulcrum[2];

    return (areParamsOk, actualParams);
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
    paramsCompound[5] = amountCompound;
    paramsFulcrum[2] = amountFulcrum;

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
      paramsCompound, // paramsCompound[5] would be overwritten on next iteration
      paramsFulcrum // paramsFulcrum[2] would be overwritten on next iteration
    );
  }
}
