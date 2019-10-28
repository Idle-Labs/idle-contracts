pragma solidity 0.5.11;

import "../interfaces/CERC20.sol";
import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/WhitePaperInterestRateModel.sol";

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancerMock is Ownable {
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

  address[] public tokenAddresses;
  uint256[] public amounts;

  event LOOOOOGG(uint256 x);

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
   * @return tokenAddresses : array with all token addresses used,
   *                          currently [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   currently [amountCompound, amountFulcrum]
   */
  function calcRebalanceAmounts(uint256)
    external view
    returns (address[] memory, uint256[] memory)
  {
    return (tokenAddresses, amounts);
  }

  function _setCalcAmounts(address[] memory _tokenAddresses, uint256[] memory _amounts) public {
    tokenAddresses = _tokenAddresses;
    amounts = _amounts;
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
    returns (uint256[] memory) {

  }
}
