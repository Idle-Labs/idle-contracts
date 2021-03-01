/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/CETH.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/WhitePaperInterestRateModel.sol";

contract IdleCompoundETH is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token cETH address
  address public token;
  // underlying token WETH address
  address public underlying;
  address public idleToken;
  uint256 public blocksPerYear;

  /**
   * @param _token : cToken address
   * @param _underlying : underlying token (eg DAI) address
   * @param _idleToken : idleToken token (eg DAI) address
   */
  constructor(address _token, address _underlying, address _idleToken) public {
    require(_token != address(0) && _underlying != address(0) && _idleToken != address(0), 'COMP: some addr is 0');

    token = _token;
    underlying = _underlying;
    idleToken = _idleToken;
    blocksPerYear = 2371428;
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken");
    _;
  }

  // onlyOwner
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
  // end onlyOwner

  /**
   * Calculate next supply rate for Compound, given an `_amount` supplied (last array param)
   * and all other params supplied. See `info_compound.md` for more info
   * on calculations.
   *
   * @param params : array with all params needed for calculation (see below)
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] memory params)
    public view
    returns (uint256) {
      /*
        This comment is a reference for params name
        This gives stack too deep so check implementation below

        uint256 j = params[0]; // 10 ** 18;
        uint256 a = params[1]; // white.baseRate(); // from WhitePaper
        uint256 b = params[2]; // cToken.totalBorrows();
        uint256 c = params[3]; // white.multiplier(); // from WhitePaper
        uint256 d = params[4]; // cToken.totalReserves();
        uint256 e = params[5]; // j.sub(cToken.reserveFactorMantissa());
        uint256 s = params[6]; // cToken.getCash();
        uint256 k = params[7]; // white.blocksPerYear();
        uint256 f = params[8]; // 100;
        uint256 x = params[9]; // newAmountSupplied;

        // q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> to get yearly rate
        nextRate = a.add(b.mul(c).div(b.add(s).add(x))).div(k).mul(e).mul(b).div(
          s.add(x).add(b).sub(d)
        ).div(j).mul(k).mul(f); // to get the yearly rate
      */

      // (b*c)/(b + s + x)
      uint256 inter1 = params[2].mul(params[3]).div(params[2].add(params[6]).add(params[9]));
      // (s + x + b - d)
      uint256 inter2 = params[6].add(params[9]).add(params[2]).sub(params[4]);
      // ((a + (b*c)/(b + s + x)) / k) * e
      uint256 inter3 = params[1].add(inter1).div(params[7]).mul(params[5]);
      // ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f
      return inter3.mul(params[2]).div(inter2).div(params[0]).mul(params[7]).mul(params[8]);
  }

  /**
   * Calculate next supply rate for Compound, given an `_amount` supplied
   *
   * @param _amount : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256) {
      CETH cToken = CETH(token);
      WhitePaperInterestRateModel white = WhitePaperInterestRateModel(cToken.interestRateModel());
      uint256[] memory params = new uint256[](10);

      params[0] = 10**18; // j
      params[1] = white.baseRate(); // a
      params[2] = cToken.totalBorrows(); // b
      params[3] = white.multiplier(); // c
      params[4] = cToken.totalReserves(); // d
      params[5] = params[0].sub(cToken.reserveFactorMantissa()); // e
      params[6] = cToken.getCash(); // s
      params[7] = blocksPerYear; // k
      params[8] = 100; // f
      params[9] = _amount; // x

      // q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> to get yearly rate
      return nextSupplyRateWithParams(params);
  }

  /**
   * @return current price of cToken in underlying
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return CETH(token).exchangeRateStored();
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256 apr) {
      CETH cToken = CETH(token);
      uint256 cRate = cToken.supplyRatePerBlock(); // interest % per block
      apr = cRate.mul(blocksPerYear).mul(100);
  }

  /**
   * Gets all underlying tokens in this contract and mints cTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return cTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 cTokens) {
      // convert weth to eth
      IWETH(underlying).withdraw(IERC20(underlying).balanceOf(address(this)));
      // mint the cTokens and assert there is no error
      CETH(token).mint.value(address(this).balance)();
      IERC20 _token = IERC20(token);
      // cTokens are now in this contract
      cTokens = _token.balanceOf(address(this));
      // transfer them to the caller
      _token.safeTransfer(msg.sender, cTokens);
  }

  /**
   * Gets all cTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: cTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      // Funds needs to be sended here before calling this
      IERC20 _underlying = IERC20(underlying);
      // redeem all underlying sent in this contract
      require(CETH(token).redeem(IERC20(token).balanceOf(address(this))) == 0, "Error redeeming cTokens");
      // convert ETH to WETH
      IWETH(underlying).deposit.value(address(this).balance)();

      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  /**
   * Get available liquidity
   *
   * @return available liquidity
   */
  function availableLiquidity() external view returns (uint256) {
    return CETH(token).getCash();
  }

  /**
  * Fallback to receive ether
  */
  function() external payable {}
}
