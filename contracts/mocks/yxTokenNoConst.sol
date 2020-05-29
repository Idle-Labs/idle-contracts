/**
 * @title: DyDx lending tokenization
 * @summary: Used for crete and ERC20 representing lending positions
 *           on DyDx protocol.
 * @author: Idle Labs Inc., idle.finance
 */

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/DyDx.sol";
import '../interfaces/DyDxStructs.sol';

contract yxTokenNoConst is DyDxStructs, ERC20, ERC20Detailed {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public marketId;
  uint256 public secondsInAYear;
  // underlying token (token eg DAI) address
  address public underlying;
  address public dydxAddressesProvider = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;
  DyDx dydx = DyDx(dydxAddressesProvider);
  /**
   * @param _underlying : underlying token (eg DAI) address
   * @param _marketId : dydx market id
   * @param _name : dydx tokenized name
   * @param _symbol : dydx tokenized symbol
   * @param _decimals : dydx tokenized decimals (same decimals as the underlying)
   */
  constructor(address _underlying, uint256 _marketId, string memory _name, string memory _symbol, uint8 _decimals)
    public ERC20Detailed(_name, _symbol, _decimals) {
    require(_underlying != address(0), 'Underlying is 0');

    underlying = _underlying;
    marketId = _marketId; // 0 ETH, (1 SAI not available), 2 USDC, 3 DAI
    IERC20(_underlying).approve(dydxAddressesProvider, uint256(-1));
  }

  /**
   * @return current price of yxToken always 18 decimals
   */
  function price() public view returns (uint256) {
    (, uint256 supplyIndex) = dydx.getMarketCurrentIndex(marketId);
    return supplyIndex;
  }

  function availableLiquidity() external view returns (uint256) {
    return IERC20(underlying).balanceOf(dydxAddressesProvider);
  }

  function balanceInUnderlying(address who) external view returns (uint256) {
    return balanceOf(who).mul(price()).div(10**18);
  }

  /**
   * Lend _amount in DyDx and mints yxTokens
   * tokens are then transferred to msg.sender
   * NOTE: one must approve this contract before calling this method
   *
   * @return yxTokens minted
   */
  function mint(uint256 _amount)
    external
    returns (uint256 newTokens) {
      // Get current account par in dydx
      uint256 accountParInitial = getPar();
      // Transfer underlying in this contract
      IERC20(underlying).safeTransferFrom(msg.sender, address(this), _amount);
      // Use underlying and supply it to dydx
      _mintDyDx(_amount);
      newTokens = getPar().sub(accountParInitial);
      // mint IERC20 for dydx tokenized position
      _mint(msg.sender, newTokens);
  }

  function _mintDyDx(uint256 _amount)
    internal {
      Info[] memory infos = new Info[](1);
      infos[0] = Info(address(this), 0);
      AssetAmount memory amt = AssetAmount(true, AssetDenomination.Wei, AssetReference.Delta, _amount);
      ActionArgs memory act;
      act.actionType = ActionType.Deposit;
      act.accountId = 0;
      act.amount = amt;
      act.primaryMarketId = marketId;
      act.otherAddress = address(this);

      ActionArgs[] memory args = new ActionArgs[](1);
      args[0] = act;

      dydx.operate(infos, args);
  }

  /**
   * Redeems _amount of yxTokens
   * underlying tokens are then transferred to `_account`
   *
   * @return underlying tokens redeemd
   */
  function redeem(uint256 _amount, address _account)
    external
    returns (uint256 tokens) {
      _redeemDyDx(_amount);

      // transfer redeemd tokens to _account
      IERC20 _underlying = IERC20(underlying);
      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);

      _burn(msg.sender, _amount);
  }

  function _redeemDyDx(uint256 _amount)
    internal {
      Info[] memory infos = new Info[](1);
      infos[0] = Info(address(this), 0);

      AssetAmount memory amt = AssetAmount(false, AssetDenomination.Par, AssetReference.Delta, _amount);
      ActionArgs memory act;
      act.actionType = ActionType.Withdraw;
      act.accountId = 0;
      act.amount = amt;
      act.primaryMarketId = marketId;
      act.otherAddress = address(this);

      ActionArgs[] memory args = new ActionArgs[](1);
      args[0] = act;

      dydx.operate(infos, args);
  }

  function getPar() internal view returns (uint256) {
    (, uint128 value) = dydx.getAccountPar(Info(address(this), 0), marketId);
    return uint256(value);
  }
}
