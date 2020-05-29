pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

// interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/DyDx.sol";

contract DyDxMock is DyDx {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  Wei balance;
  uint256 private accountPar;
  uint256 private earningsRate;
  uint256 private interestRate;
  uint256 private borrowIndex;
  uint256 private supplyIndex;
  uint256 private borrowPar;
  uint256 private supplyPar;
  address private interestSetter;
  address public token;

  constructor(address _token) public {
    token = _token;
  }

  struct Transfer {
    address account;
    uint256 value;
    bool isDeposit;
    uint256 marketId;
  }

  mapping (address => Transfer) public transfers;

  function getEarningsRate() external view returns (uint256) {
    return earningsRate;
  }
  function getMarketInterestSetter(uint256) external view returns (address) {
    return interestSetter;
  }
  function getMarketInterestRate(uint256) external view returns (uint256) {
    return interestRate;
  }
  function getMarketCurrentIndex(uint256) external view returns (uint256, uint256) {
    return (borrowIndex, supplyIndex);
  }
  function getMarketTotalPar(uint256) external view returns (uint256, uint256) {
    return (borrowPar, supplyPar);
  }
  function getAccountWei(Info calldata, uint256) external view returns (Wei memory) {
    return balance;
  }
  function getAccountPar(Info calldata, uint256) external view returns (bool, uint128) {
    return (true, uint128(accountPar));
  }
  function setEarningsRate(uint256 value) external {
    earningsRate = value;
  }
  function setMarketInterestSetter(address _interestSetter) external {
    interestSetter = _interestSetter;
  }
  function setMarketInterestRate(uint256 value) external {
    interestRate = value;
  }
  function setMarketCurrentIndex(uint256 _borrow, uint256 _supply) external {
    borrowIndex = _borrow;
    supplyIndex = _supply;
  }
  function setMarketTotalPar(uint256 _borrow, uint256 _supply) external {
    borrowPar = _borrow;
    supplyPar = _supply;
  }
  function setAccountWei(uint256 _balance) external {
    balance = Wei(true, _balance);
  }
  function setAccountPar(uint256 _balance) external {
    accountPar = _balance;
  }

  function operate(Info[] calldata infos, ActionArgs[] calldata args) external {
    uint256 _amount = args[0].amount.value;
    uint256 marketId = args[0].primaryMarketId;
    if (args[0].actionType == ActionType.Deposit) {
      IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
      accountPar = accountPar + _amount;
      transfers[msg.sender] = Transfer(infos[0].owner, _amount, true, marketId);
    } else {
      IERC20(token).safeTransfer(msg.sender, _amount);
      accountPar = accountPar - _amount;
      transfers[msg.sender] = Transfer(infos[0].owner, _amount, false, marketId);
    }
  }
}
