/**
 * @title: Compound wrapper
 * @summary: Used for interacting with Compound. Has
 *           a common interface with all other protocol wrappers.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: William Bergamo, idle.finance
 */
pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

import "../interfaces/DyDx.sol";
import "../interfaces/DyDxStructs.sol";

contract yxToken is DyDxStructs, ERC20, ERC20Detailed {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public marketId;
  uint256 public secondsInAYear;
  // underlying token (token eg DAI) address
  address public underlying;
  address public dydxAddressesProvider = address(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);
  /**
   * @param _underlying : underlying token (eg DAI) address
   * @param _marketId : dydx market id
   * @param _name : dydx market tokenized name
   * @param _symbol : dydx market tokenized symbol
   * @param _decimals : dydx market tokenized decimals
   */
  constructor(address _underlying, uint256 _marketId, string memory _name, string memory _symbol, uint8 _decimals)
    public ERC20Detailed(_name, _symbol, _decimals) {
    require(_underlying != address(0), 'Underlying is 0');

    underlying = _underlying;
    marketId = _marketId; // 0, ETH, (1 SAI not available), 2 USDC, 3 DAI
  }

  /**
   * @return current price of xyToken always 18 decimals
   */
  function price()
    public view
    returns (uint256) {
    return balanceInUnderlying(address(this)).mul(10**18).div(totalSupply());
  }

  /**
   * Gets all underlying tokens in this contract and mints yxTokens
   * tokens are then transferred to msg.sender
   * NOTE: underlying tokens needs to be sended here before calling this
   *
   * @return yxTokens minted
   */
  function mint(uint256 _amount)
    external nonReentrant
    returns (uint256 newTokens) {
      // mint IERC20 for dydx tokenized position
      uint256 price = price();
      newTokens = _amount.mul(10**18).div(price);
      _mint(msg.sender, newTokens);

      IERC20(underlying).safeTransferFrom(msg.sender, address(this), _amount);

      // Use underlying and supply it to dydx
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

      DyDx(dydxAddressesProvider).operate(infos, args);
  }

  /**
   * Gets all yxTokens in this contract and redeems underlying tokens.
   * underlying tokens are then transferred to `_account`
   * NOTE: yxTokens needs to be sended here before calling this
   *
   * @return underlying tokens redeemd
   */
  function redeem(uint256 _amount, address _account)
    external
    returns (uint256 tokens) {
      uint256 toRedeem = _amount.mul(price()).div(10**18);

      Info[] memory infos = new Info[](1);
      infos[0] = Info(address(this), 0);

      AssetAmount memory amt = AssetAmount(false, AssetDenomination.Wei, AssetReference.Delta, toRedeem);
      ActionArgs memory act;
      act.actionType = ActionType.Withdraw;
      act.accountId = 0;
      act.amount = amt;
      act.primaryMarketId = marketId;
      act.otherAddress = address(this);

      ActionArgs[] memory args = new ActionArgs[](1);
      args[0] = act;

      DyDx(dydxAddressesProvider).operate(infos, args);

      // transfer redeemed tokens to _account
      IERC20 _underlying = IERC20(underlying);
      tokens = _underlying.balanceOf(address(this));
      _underlying.safeTransfer(_account, tokens);

      _burn(msg.sender, _amount);
  }

  function availableLiquidity() external view returns (uint256) {
    return IERC20(underlying).balanceOf(dydxAddressesProvider);
  }

  function balanceInUnderlying(address who) public view returns (uint256) {
    Wei memory bal = DyDx(dydxAddressesProvider).getAccountWei(Info(who, 0), marketId);
    return bal.value;
  }
}
