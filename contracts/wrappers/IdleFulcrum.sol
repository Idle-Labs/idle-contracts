/**
 * @title: Fulcrum wrapper
 * @summary: Used for interacting with Fulcrum. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";

contract IdleFulcrum is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (iToken) address
  address public token;
  // underlying token (eg DAI) address
  address public underlying;

  /**
   * @param _token : iToken address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    token = _token;
    underlying = _underlying;
  }

  // onlyOwner
  /**
   * sets token address
   * @param _token : iToken address
   */
  function setToken(address _token)
    external onlyOwner {
      token = _token;
  }

  /**
   * sets underlying address
   * @param _underlying : underlying address (eg DAI)
   */
  function setUnderlying(address _underlying)
    external onlyOwner {
      underlying = _underlying;
  }
  // end onlyOwner

  /**
   * Gets next supply rate from Fulcrum, given an `_amount` supplied
   * and remove mandatory fee (`spreadMultiplier`)
   *
   * @param _amount : new underlying amount supplied (eg DAI)
   * @return nextRate : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256 nextRate) {
      iERC20Fulcrum iToken = iERC20Fulcrum(token);
      nextRate = iToken.nextSupplyInterestRate(_amount);
      // remove 10% mandatory self insurance
      nextRate = nextRate.mul(iToken.spreadMultiplier()).div(10 ** 20);
  }

  /**
   * Calculate next supply rate from Fulcrum, given an `_amount` supplied (last array param)
   * and all other params supplied. See `info_fulcrum.md` for more info
   * on calculations.
   *
   * @param params : array with all params needed for calculation (see below)
   * @return nextRate : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata params)
    external pure
    returns (uint256 nextRate) {
      uint256 a1 = params[0]; // avgBorrowInterestRate;
      uint256 b1 = params[1]; // totalAssetBorrow;
      uint256 s1 = params[2]; // totalAssetSupply;
      uint256 o1 = params[3]; // spreadMultiplier;
      uint256 k1 = params[4]; // 10 ** 20;
      uint256 x1 = params[5]; // _amount;

      /* q = a * (s / (s + x)) * (b / (s + x)) * o / k */
      /* nextRate = a1.mul(s1.div(s1.add(x1)))
        .mul(b1.div(s1.add(x1)))
        .mul(o1).div(k1); // counting fee (spreadMultiplier) */
      /* nextRate = a1.mul(s1.div(s1.add(x1)))
        .mul(b1.div(s1.add(x1)))
        .mul(o1).div(k1); // counting fee (spreadMultiplier) */

      /* z = multiplier = 1e18 */

      // max_a = 1e20
      // max_b = 1e30
      // max_s = 1e30
      // max_o = 1e20
      // max_k = 1e20
      // max_x = 1e30

      /* q = a * (s / (s + x)) * (b / (s + x)) * o / k */

      /* nextRate = a1.mul(s1.mul(10**18).div(s1.add(x1)))
        .mul(b1.div(s1.mul(10**18).add(x1)))
        .mul(o1).div(k1); // counting fee (spreadMultiplier) */

      /* rewritten */
      /* q = (a b o s)/(k (s + x)^2) */
      nextRate = a1.mul(b1).mul(o1).mul(s1).div(k1.mul(s1.add(x1).mul(s1.add(x1)))); // counting fee (spreadMultiplier)
  }

  /**
   * @return current price of iToken in underlying
   */
  function getPriceInToken()
    external view
    returns (uint256) {
      return iERC20Fulcrum(token).tokenPrice();
  }

  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256 apr) {
      iERC20Fulcrum iToken = iERC20Fulcrum(token);
      apr = iToken.supplyInterestRate(); // APR in wei 18 decimals
      // remove Mandatory self-insurance of Fulcrum from iApr
      // apr * spreadMultiplier / (100 * 1e18)
      apr = apr.mul(iToken.spreadMultiplier()).div(10 ** 20);
  }

  /**
   * Gets all underlying tokens in this contract and mints iTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return iTokens minted
   */
  function mint()
    external
    returns (uint256 iTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return iTokens;
      }
      // approve the transfer to iToken contract
      IERC20(underlying).safeIncreaseAllowance(token, balance);
      // mint the iTokens and transfer to msg.sender
      iTokens = iERC20Fulcrum(token).mint(msg.sender, balance);
  }

  /**
   * Gets all iTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: iTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external
    returns (uint256 tokens) {
      tokens = iERC20Fulcrum(token).burn(_account, IERC20(token).balanceOf(address(this)));
  }
}
