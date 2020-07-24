pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./interfaces/IIdleToken.sol";
import "./others/BasicMetaTransaction.sol";
/* import "./others/EIP712MetaTransaction.sol"; */
import "./GST2Consumer.sol";

interface CERC20 {
  function redeem(uint256 redeemTokens) external returns (uint256);
}
interface AToken {
  function redeem(uint256 amount) external;
}

interface iERC20Fulcrum {
  function burn(
    address receiver,
    uint256 burnAmount)
    external
    returns (uint256 loanAmountPaid);
}

interface yToken {
  function withdraw(uint256 _shares) external;
}

// This contract should never have tokens at the end of a transaction.
// if for some reason tokens are stuck inside there is an emergency withdraw method
// This contract is not audited
contract IdleConverterPersonalSign is Ownable, GST2Consumer, BasicMetaTransaction {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor() public {}

  // One should approve this contract first to spend IdleTokens
  // _amount : in oldIdleTokens
  // _from : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromToIdle(uint256 _amount, address _from, address _to, address _underlying) external gasDiscountFrom(address(this)) returns (uint256) {
    IERC20(_from).safeTransferFrom(msgSender(), address(this), _amount);
    IIdleToken(_from).redeemIdleToken(_amount, true, new uint256[](0));

    return _migrateToIdle(_to, _underlying);
  }

  // One should approve this contract first to spend cTokens
  // _amount : in cTokens
  // _from : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromCompoundToIdle(uint256 _amount, address _from, address _to, address _underlying) external gasDiscountFrom(address(this)) returns (uint256) {
    IERC20(_from).safeTransferFrom(msgSender(), address(this), _amount);
    CERC20(_from).redeem(_amount);

    return _migrateToIdle(_to, _underlying);
  }

  // One should approve this contract first to spend iTokens
  // _amount : in iTokens
  // _from : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromFulcrumToIdle(uint256 _amount, address _from, address _to, address _underlying) external gasDiscountFrom(address(this)) returns (uint256) {
    IERC20(_from).safeTransferFrom(msgSender(), address(this), _amount);
    iERC20Fulcrum(_from).burn(address(this), _amount);

    return _migrateToIdle(_to, _underlying);
  }

  // One should approve this contract first to spend aTokens
  // _amount : in aTokens
  // _from : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromAaveToIdle(uint256 _amount, address _from, address _to, address _underlying) external gasDiscountFrom(address(this)) returns (uint256) {
    IERC20(_from).safeTransferFrom(msgSender(), address(this), _amount);
    AToken(_from).redeem(_amount);

    return _migrateToIdle(_to, _underlying);
  }

  // One should approve this contract first to spend yTokens
  // _amount : in yTokens
  // _from : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromIearnToIdle(uint256 _amount, address _from, address _to, address _underlying) external gasDiscountFrom(address(this)) returns (uint256) {
    IERC20(_from).safeTransferFrom(msgSender(), address(this), _amount);
    yToken(_from).withdraw(_amount);

    return _migrateToIdle(_to, _underlying);
  }

  // internal
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function _migrateToIdle(address _to, address _underlying) internal returns (uint256 newIdleTokens) {
    uint256 underlyingBalance = IERC20(_underlying).balanceOf(address(this));
    IERC20(_underlying).safeApprove(_to, underlyingBalance);
    IIdleToken(_to).mintIdleToken(underlyingBalance, new uint256[](0));

    newIdleTokens = IERC20(_to).balanceOf(address(this));
    IERC20(_to).safeTransfer(msgSender(), newIdleTokens);
  }

  // onlyOwner
  function emergencyWithdrawToken(address _token, address _to) external onlyOwner {
    IERC20(_token).safeTransfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}
