/**
 * @title: Cream DAI wrapper
 * @summary: Used for interacting with Cream Finance. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/CERC20.sol";
import "../interfaces/WhitePaperInterestRateModel.sol";

// This strategy is a modified version of the strategy made by Sunny with few improvements.
// This contract should be deployed with a minimal proxy factory
contract IdleCompoundLike is ILendingProtocol {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (cTokenLike) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  uint256 public blocksPerYear;
  address public owner;

  /**
   * @param _token : cTokenLike address
   * @param _idleToken : idleToken address
   * @param _owner : contract owner (for eventually setting blocksPerYear)
   */
  function initialize(address _token, address _idleToken, address _owner) public {
    require(token == address(0), 'cTokenLike: already initialized');
    require(_token != address(0), 'cTokenLike: addr is 0');

    token = _token;
    owner = _owner;
    underlying = CERC20(_token).underlying();
    idleToken = _idleToken;
    blocksPerYear = 2371428;
    IERC20(underlying).safeApprove(_token, uint256(-1));
  }

  /**
   * Throws if called by any account other than IdleToken contract.
   */
  modifier onlyIdle() {
    require(msg.sender == idleToken, "Ownable: caller is not IdleToken");
    _;
  }

  /**
  * Throws if called by any account other than the owner.
  */
  modifier onlyOwner() {
    require(msg.sender == owner, "Ownable: caller is not IdleToken");
    _;
  }

  /**
   * sets blocksPerYear address
   *
   * @param _blocksPerYear : avg blocks per year
   */
  function setBlocksPerYear(uint256 _blocksPerYear)
    external onlyOwner {
      require((blocksPerYear = _blocksPerYear) != 0, "_blocksPerYear is 0");
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
      WhitePaperInterestRateModel white = WhitePaperInterestRateModel(CERC20(token).interestRateModel());
      uint256 ratePerBlock = white.getSupplyRate(
        cToken.getCash().add(_amount),
        cToken.totalBorrows(),
        cToken.totalReserves(),
        cToken.reserveFactorMantissa()
      );
      return ratePerBlock.mul(blocksPerYear).mul(100);
  }

  /**
   * @return current price of cTokenLike token
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return CERC20(token).exchangeRateStored();
  }

  /**
   * @return current apr
   */
  function getAPR()
    external view
    returns (uint256) {
      // return nextSupplyRate(0);
      // more efficient
      return CERC20(token).supplyRatePerBlock().mul(blocksPerYear).mul(100);
  }

  /**
   * Gets all underlying tokens in this contract and mints cTokenLike Tokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sent here before calling this
   *
   * @return cTokenLike Tokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 crTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance != 0) {
        IERC20 _token = IERC20(token);
        require(CERC20(token).mint(balance) == 0, "Error minting crTokens");
        crTokens = _token.balanceOf(address(this));
        _token.safeTransfer(msg.sender, crTokens);
      }
  }

  /**
   * Gets all cTokenLike in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: cTokenLike needs to be sent here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      require(CERC20(token).redeem(IERC20(token).balanceOf(address(this))) == 0, "Error redeeming crTokens");
      IERC20 _underlying = IERC20(underlying);
      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  /**
   * Get the underlying balance on the lending protocol
   *
   * @return underlying tokens available
   */
  function availableLiquidity() external view returns (uint256) {
    return CERC20(token).getCash();
  }
}
