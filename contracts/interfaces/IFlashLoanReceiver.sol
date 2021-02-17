pragma solidity 0.5.16;

interface IFlashLoanReceiver {
  function executeOperation(
    uint256 _amount,
    uint256 _fee,
    address initiator,
    bytes calldata params
  ) external returns (bool);
}
