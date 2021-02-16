pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface GovernorAlpha {
  function propose(address[] calldata targets, uint[] calldata values, string[] calldata signatures, bytes[] calldata calldatas, string calldata description) external returns (uint);
  function queue(uint proposalId) external;
  function execute(uint proposalId) external payable;
  function cancel(uint proposalId) external;
  function castVote(uint proposalId, bool support) external;
}
