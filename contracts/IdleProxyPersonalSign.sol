pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./interfaces/IIdleTokenV3.sol";
import "./others/BasicMetaTransaction.sol";
import "./GST2Consumer.sol";

contract IdleProxyPersonalSign is Ownable, GST2Consumer, BasicMetaTransaction {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor() public {
    IIdleTokenV3 daiBest = IIdleTokenV3(address(0x78751B12Da02728F467A44eAc40F5cbc16Bd7934));
    IERC20 dai = IERC20(daiBest.token());
    IIdleTokenV3 daiRisk = IIdleTokenV3(address(0x1846bdfDB6A0f5c473dEc610144513bd071999fB));

    IIdleTokenV3 usdcBest = IIdleTokenV3(address(0x12B98C621E8754Ae70d0fDbBC73D6208bC3e3cA6));
    IERC20 usdc = IERC20(usdcBest.token());
    IIdleTokenV3 usdcRisk = IIdleTokenV3(address(0xcDdB1Bceb7a1979C6caa0229820707429dd3Ec6C));

    IIdleTokenV3 usdtBest = IIdleTokenV3(address(0x63D27B3DA94A9E871222CB0A32232674B02D2f2D));
    IERC20 usdt = IERC20(usdtBest.token());
    IIdleTokenV3 usdtRisk = IIdleTokenV3(address(0x42740698959761BAF1B06baa51EfBD88CB1D862B));

    dai.safeApprove(address(daiBest), uint256(-1));
    dai.safeApprove(address(daiRisk), uint256(-1));
    usdc.safeApprove(address(usdcBest), uint256(-1));
    usdc.safeApprove(address(usdcRisk), uint256(-1));
    usdt.safeApprove(address(usdtBest), uint256(-1));
    usdt.safeApprove(address(usdtRisk), uint256(-1));
  }

  function approveNewIdleToken(address _idleToken) external onlyOwner {
    IERC20 underlying = IERC20(IIdleTokenV3(_idleToken).token());
    underlying.safeApprove(_idleToken, uint256(-1));
  }

  // One should approve this contract first to spend `_underlying` tokens
  // _amount : in oldIdleTokens
  // _idleTokenAddr : idle address
  function mintIdleTokensProxy(uint256 _amount, address _idleTokenAddr)
    external gasDiscountFrom(address(this)) returns (uint256 idleTokens) {

    IIdleTokenV3 idleToken = IIdleTokenV3(_idleTokenAddr);
    IERC20 underlying = IERC20(idleToken.token());
    underlying.safeTransferFrom(msgSender(), address(this), _amount);

    idleToken.mintIdleToken(underlying.balanceOf(address(this)), new uint256[](0));

    idleTokens = IERC20(_idleTokenAddr).balanceOf(address(this));
    IERC20(_idleTokenAddr).safeTransfer(msgSender(), idleTokens);
  }

  // One should approve this contract first to spend idleTokens
  // _amount of idleTokens to redeem
  // _idleTokenAddr : idle address
  function redeemIdleTokensProxy(uint256 _amount, address _idleTokenAddr)
    external gasDiscountFrom(address(this)) returns (uint256 tokens) {
    IIdleTokenV3 idleToken = IIdleTokenV3(_idleTokenAddr);
    IERC20 underlying = IERC20(idleToken.token());

    IERC20(address(idleToken)).safeTransferFrom(msgSender(), address(this), _amount);
    idleToken.redeemIdleToken(_amount, true, new uint256[](0));

    tokens = underlying.balanceOf(address(this));
    underlying.safeTransfer(msgSender(), tokens);
  }

  // onlyOwner, at the end of the tx not token should be present in this contract,
  // if anything got stuck we can unlock it though this methd
  function emergencyWithdrawToken(address _token, address _to) external onlyOwner {
    IERC20(_token).safeTransfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}
