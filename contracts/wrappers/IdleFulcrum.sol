pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";

contract IdleFulcrum is ILendingProtocol {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // protocol token (iToken) address
  address public token;
  // underlying token (token eg DAI) address
  address public underlying;

  // TODO add methods for only owner to update token and underlying addresses?
  constructor(address _token, address _underlying) public {
    token = _token;
    underlying = _underlying;
  }

  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256 nextRate) {
      iERC20Fulcrum iToken = iERC20Fulcrum(token);
      nextRate = iToken.nextSupplyInterestRate(_amount);
      // remove 10% mandatory self insurance
      nextRate = nextRate.mul(iToken.spreadMultiplier()).div(10 ** 20);
  }

  function nextSupplyRateWithParams(uint256 _amount, uint256[] calldata params)
    external pure
    returns (uint256 nextRate) {
      uint256 a1 = params[0]; // _iToken.avgBorrowInterestRate();
      uint256 b1 = params[1]; // _iToken.totalAssetBorrow();
      uint256 s1 = params[2]; // _iToken.totalAssetSupply();
      uint256 o1 = params[3]; // _iToken.spreadMultiplier();
      uint256 k1 = params[4]; // 10 ** 20;
      uint256 x1 = _amount;

      nextRate = a1.mul(s1.div(s1.add(x1)))
        .mul(b1.div(s1.add(x1)))
        .mul(o1).div(k1); // counting fee (spreadMultiplier)
  }

  function getPriceInToken()
    external view
    returns (uint256) {
      return iERC20Fulcrum(token).tokenPrice();
  }

  function getAPR()
    external view
    returns (uint256 apr) {
      iERC20Fulcrum iToken = iERC20Fulcrum(token);
      apr = iToken.supplyInterestRate(); // APR in wei 18 decimals
      // remove Mandatory self-insurance of Fulcrum from iApr
      // apr * spreadMultiplier / (100 * 1e18)
      apr = apr.mul(iToken.spreadMultiplier()).div(10 ** 20);
  }

  function mint()
    external
    returns (uint256 iTokens) {
      // Funds needs to be sended here before calling this
      uint256 balance = IERC20(underlying).balanceOf(address(this));
      if (balance == 0) {
        return iTokens;
      }
      // approve the transfer to iToken contract
      IERC20(underlying).safeIncreaseAllowance(token, balance);
      // mint the iTokens and transfer to msg.sender
      iTokens = iERC20Fulcrum(token).mint(msg.sender, balance);
  }

  function redeem(address _account)
    external
    returns (uint256 tokens) {
      // Funds needs to be sended here before calling this
      tokens = iERC20Fulcrum(token).burn(_account, IERC20(token).balanceOf(address(this)));
  }

  // TODO (not needed atm)
  function maxAmountBelowRate()
    external view
    returns (uint256) {
      // x = (sqrt(a) sqrt(b) sqrt(o) sqrt(s) - sqrt(k) sqrt(q) s)/(sqrt(k) sqrt(q))
      /* const maxDAIFulcrumFoo = q1 =>
        a1.sqrt().times(b1.sqrt()).times(o1.sqrt()).times(s1.sqrt()).minus(k1.sqrt().times(q1.sqrt()).times(s1)).div(k1.sqrt().times(q1.sqrt())); */
  }
}
