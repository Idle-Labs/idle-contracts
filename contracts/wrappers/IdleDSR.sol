/**
 * @title: CHAI wrapper
 * @summary: Used for interacting with CHAI. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../interfaces/CHAI.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/PotLike.sol";
import "../libraries/DSMath.sol";

contract IdleDSR is ILendingProtocol, Ownable, DSMath {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (CHAI) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;
  address public idleToken;
  uint256 public constant secondsInAYear = 31536000;
  PotLike public pot = PotLike(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);

  /**
   * @param _token : CHAI address
   * @param _underlying : underlying token (eg DAI) address
   */
  constructor(address _token, address _underlying) public {
    require(_token != address(0) && _underlying != address(0), 'DSR: some addr is 0');

    token = _token;
    underlying = _underlying;
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
  // end onlyOwner

  /**
   * Calculate next supply rate for CHAI, given an `_amount` supplied (last array param)
   * and all other params supplied. See `info_compound.md` for more info
   * on calculations.
   *
   * @param : not used
   * @return : yearly net rate
   */
  function nextSupplyRateWithParams(uint256[] calldata)
    external view
    returns (uint256) {
    return nextSupplyRate(0);
  }

  /**
   * Calculate next supply rate for CHAI, given an `_amount` supplied
   *
   * @param : new underlying amount supplied (eg DAI)
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256)
    public view
    returns (uint256) {
    return pot.dsr().sub(RAY).mul(secondsInAYear).div(10**9).mul(100);
  }

  /**
   * @return current price of chaiToken in underlying
   */
  function getPriceInToken()
    external view
    returns (uint256) {
    return _chaiPrice();
  }

  function _chaiPrice() internal view returns (uint256){
    uint256 rho = pot.rho();
    uint256 chi = pot.chi();
    if (now > rho) {
      chi = rmul(rpow(pot.dsr(), now - rho, RAY), chi);
    }
    return chi.div(10**9);
  }


  /**
   * @return apr : current yearly net rate
   */
  function getAPR()
    external view
    returns (uint256 apr) {
    return nextSupplyRate(0);
  }

  /**
   * Gets all underlying tokens in this contract and mints chaiTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return chaiTokens minted
   */
  function mint()
    external onlyIdle
    returns (uint256 chaiTokens) {
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return chaiTokens;
      }
      CHAI(token).join(msg.sender, balance);
      chaiTokens = balance.mul(10**18).div(_chaiPrice());
  }

  /**
   * Gets all chaiTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: chaiTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(address _account)
    external onlyIdle
    returns (uint256 tokens) {
      uint256 balance = IERC20(token).balanceOf(address(this));
      CHAI(token).exit(address(this), balance);
      IERC20 _underlying = IERC20(underlying);
      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);
  }

  function availableLiquidity() external view returns (uint256) {
    return uint256(-1);
  }
}
