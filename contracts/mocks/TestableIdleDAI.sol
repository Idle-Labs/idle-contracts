pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/CERC20.sol";
import "../interfaces/iERC20Fulcrum.sol";
import "../IdleHelp.sol";

// TODO
// in rebalanceCheck we should also check how much
// the interest rate changes due to the new liquidity we provide

// TODO we should inform the user of the eventual excess of token that can be redeemed directly in Fulcrum

/* contract IdleDAI is ERC777, ReentrancyGuard { */
contract TestableIdleDAI is ERC20, ERC20Detailed, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address public cToken; // cTokens have 8 decimals
  address public iToken; // iTokens have 18 decimals
  address public token;
  address public bestToken;

  uint256 public blocksInAYear;
  uint256 public minRateDifference;

  /**
   * @dev constructor
   */
  constructor(address _cToken, address _iToken, address _token)
    public
    ERC20Detailed("IdleDAI", "IDLEDAI", 18) {
    /* ERC777("IdleDAI", "IDLEDAI", new address[](0)) { */
      cToken = _cToken;
      iToken = _iToken;
      token = _token;
      blocksInAYear = 2102400; // ~15 sec per block
      minRateDifference = 500000000000000000; // 0.5% min
  }

  // internal now public
  function _mintCTokens(uint256 _amount)
    public
    returns (uint256 cTokens) {
      if (IERC20(token).balanceOf(address(this)) == 0) {
        return cTokens;
      }
      // approve the transfer to cToken contract
      IERC20(token).safeIncreaseAllowance(cToken, _amount);

      // get a handle for the corresponding cToken contract
      CERC20 _cToken = CERC20(cToken);
      // mint the cTokens and assert there is no error
      require(_cToken.mint(_amount) == 0, "Error minting");
      // cTokens are now in this contract

      // generic solidity formula is exchangeRateMantissa = (underlying / cTokens) * 1e18
      uint256 exchangeRateMantissa = _cToken.exchangeRateStored(); // (exchange_rate * 1e18)
      // so cTokens = (underlying * 1e18) / exchangeRateMantissa
      cTokens = _amount.mul(10**18).div(exchangeRateMantissa);
  }
  function _mintITokens(uint256 _amount)
    public
    returns (uint256 iTokens) {
      if (IERC20(token).balanceOf(address(this)) == 0) {
        return iTokens;
      }
      // approve the transfer to iToken contract
      IERC20(token).safeIncreaseAllowance(iToken, _amount);
      // get a handle for the corresponding iToken contract
      iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);
      // mint the iTokens
      iTokens = _iToken.mint(address(this), _amount);
  }

  function _redeemCTokens(uint256 _amount, address _account)
    public
    returns (uint256 tokens) {
      CERC20 _cToken = CERC20(cToken);
      // redeem all user's underlying
      require(_cToken.redeem(_amount) == 0, "Something went wrong when redeeming in cTokens");

      // generic solidity formula is exchangeRateMantissa = (underlying / cTokens) * 1e18
      uint256 exchangeRateMantissa = _cToken.exchangeRateStored(); // exchange_rate * 1e18
      // so underlying = (exchangeRateMantissa * cTokens) / 1e18
      tokens = _amount.mul(exchangeRateMantissa).div(10**18);

      if (_account != address(this)) {
        IERC20(token).safeTransfer(_account, tokens);
      }
  }
  function _redeemITokens(uint256 _amount, address _account)
    public
    returns (uint256 tokens) {
      tokens = iERC20Fulcrum(iToken).burn(_account, _amount);
  }
}
