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

import "../interfaces/CERC20.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/WhitePaperInterestRateModel.sol";

contract IdleCompoundV2 is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (cToken) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  uint256 public blocksPerYear;

  /**
   * @param _token : cToken address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    require(_token != address(0) && _underlying != address(0), 'COMP: some addr is 0');

    token = _token;
    underlying = _underlying;
    blocksPerYear = 2371428;
    IERC20(_underlying).safeApprove(_token, uint256(-1));
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
  // end onlyOwner

  /**
   * Calculate next supply rate for Compound, given an `_amount` supplied (last array param)
   * and all other params supplied.
   *
   * @param params : array with all params needed for calculation
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata params)
    external view
    returns (uint256) {
      CERC20 cToken = CERC20(token);
      WhitePaperInterestRateModel white = WhitePaperInterestRateModel(cToken.interestRateModel());
      uint256 ratePerBlock = white.getSupplyRate(
        params[1].add(params[5]),
        params[0],
        params[2],
        params[3]
      );
      return ratePerBlock.mul(params[4]).mul(100);
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
      CERC20 cToken = CERC20(token);
      WhitePaperInterestRateModel white = WhitePaperInterestRateModel(cToken.interestRateModel());
      uint256 ratePerBlock = white.getSupplyRate(
        cToken.getCash().add(_amount),
        cToken.totalBorrows(),
        cToken.totalReserves(),
        cToken.reserveFactorMantissa()
      );
      return ratePerBlock.mul(blocksPerYear).mul(100);
  }

  /**
   * @return current price of cToken in underlying
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return CERC20(token).exchangeRateStored();
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256 apr) {
      CERC20 cToken = CERC20(token);
      uint256 cRate = cToken.supplyRatePerBlock(); // interest % per block
      apr = cRate.mul(blocksPerYear).mul(100);
  }

  /**
   * Gets all underlying tokens in this contract and mints cTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return iTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 cTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return cTokens;
      }
      // get a handle for the corresponding cToken contract
      CERC20 _cToken = CERC20(token);
      // mint the cTokens and assert there is no error
      require(_cToken.mint(balance) == 0, "Error minting cTokens");
      // cTokens are now in this contract
      cTokens = IERC20(token).balanceOf(address(this));
      // transfer them to the caller
      IERC20(token).safeTransfer(msg.sender, cTokens);
  }

  /**
   * Gets all cTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: iTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      // Funds needs to be sended here before calling this
      CERC20 _cToken = CERC20(token);
      IERC20 _underlying = IERC20(underlying);
      // redeem all underlying sent in this contract
      require(_cToken.redeem(IERC20(token).balanceOf(address(this))) == 0, "Error redeeming cTokens");

      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  function availableLiquidity() external view returns (uint256) {
    return CERC20(token).getCash();
  }
}
