pragma solidity 0.5.16;

interface GovernorAlpha {
  function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) external returns (uint);
  function queue(uint proposalId) external;
  function execute(uint proposalId) external payable;
  function cancel(uint proposalId) external;
  function castVote(uint proposalId, bool support) external;
}
