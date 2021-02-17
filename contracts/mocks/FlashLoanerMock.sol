pragma solidity 0.5.16;

import "../interfaces/IFlashLoanReceiver.sol";
import "../IdleTokenGovernance.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract FlashLoanerMock is IFlashLoanReceiver {
  using SafeMath for uint256;

  address public dai;
  address public idleToken;
  uint256 public amountReceived;
  uint256 public daiBalanceOnExecuteStart;
  uint256 public daiBalanceOnExecuteEnd;
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

  function executeOperation(
    uint256 _amount,
    uint256 _fee,
    address _initiator,
    bytes calldata _params
  ) external returns (bool) {
    amountReceived = _amount;
    feeReceived = _fee;
    initiatorReceived = _initiator;
    paramsReceived = _params;
    daiBalanceOnExecuteStart = ERC20Detailed(dai).balanceOf(address(this));

    daiToSendBack = _amount.add(_fee).sub(removeFromFee);
    ERC20Detailed(dai).transfer(idleToken, daiToSendBack);

    daiBalanceOnExecuteEnd = ERC20Detailed(dai).balanceOf(address(this));

    return true;
  }
}
