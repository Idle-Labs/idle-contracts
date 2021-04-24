pragma solidity 0.5.16;

import "../interfaces/IERC3156FlashBorrower.sol";
import "../IdleTokenGovernance.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract FlashLoanerMock is IERC3156FlashBorrower {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  address public dai;
  address public idleToken;
  uint256 public amountReceived;
  uint256 public daiBalanceOnExecuteStart;
  uint256 public feeReceived;
  uint256 public daiToSendBack;
  address public initiatorReceived;
  uint256 public removeFromFee;
  bytes public paramsReceived;

  constructor(address _dai, address _idleToken) public {
    dai = _dai;
    idleToken = _idleToken;
  }

  function setRemoveFromFee(uint256 v) external {
    removeFromFee = v;
  }

  function onFlashLoan(
    address _initiator,
    address,
    uint256 _amount,
    uint256 _fee,
    bytes calldata _params
  ) external returns (bytes32) {
    amountReceived = _amount;
    feeReceived = _fee;
    initiatorReceived = _initiator;
    paramsReceived = _params;
    daiBalanceOnExecuteStart = IERC20(dai).balanceOf(address(this));

    daiToSendBack = _amount.add(_fee).sub(removeFromFee);
    IERC20(dai).safeApprove(idleToken, daiToSendBack);

    return keccak256("ERC3156FlashBorrower.onFlashLoan");
  }
}
