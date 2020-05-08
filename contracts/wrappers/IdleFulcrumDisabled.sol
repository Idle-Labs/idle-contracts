/**
 * @title: Fulcrum wrapper
 * @summary: Used for interacting with Fulcrum. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";

contract IdleFulcrumDisabled is ILendingProtocol, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (iToken) address
  address public token;
  // underlying token (eg DAI) address
  address public underlying;
  address public idleToken;
  /**
   * @param _token : iToken address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    require(_token != address(0) && _underlying != address(0), 'COMP: some addr is 0');

    token = _token;
    underlying = _underlying;
    IERC20(_underlying).safeApprove(_token, uint256(-1));
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
  // end onlyOwner

  /**
   * Gets next supply rate from Fulcrum, given an `_amount` supplied
   *
   * @param : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256)
    external view
    returns (uint256) {
      return 0;
  }

  /**
   * Calculate next supply rate from Fulcrum, given an `_amount` supplied (last array param)
   * and all other params supplied. See `info_fulcrum.md` for more info
   * on calculations.
   *
   * @param : array with all params needed for calculation (see below)
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata)
    external view
    returns (uint256) {
      return 0;
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
    returns (uint256) {
      return 0;
  }

  /**
   * Gets all underlying tokens in this contract and mints iTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return iTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 iTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return iTokens;
      }
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
    external onlyIdle
    returns (uint256 tokens) {
      uint256 balance = IERC20(token).balanceOf(address(this));
      uint256 expectedAmount = balance.mul(iERC20Fulcrum(token).tokenPrice()).div(10**18);

      tokens = iERC20Fulcrum(token).burn(_account, balance);
      require(tokens >= expectedAmount, "Not enough liquidity on Fulcrum");
  }

  function availableLiquidity() external view returns (uint256) {
    return iERC20Fulcrum(token).totalAssetSupply().sub(
      iERC20Fulcrum(token).totalAssetBorrow()
    );
  }
}
