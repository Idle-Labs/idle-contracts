pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface IGovernorAlpha {
  function propose(address[] calldata targets, uint[] calldata values, string[] calldata signatures, bytes[] calldata calldatas, string calldata description) external returns (uint);
  function castVote(uint proposalId, bool support) external;
  function queue(uint proposalId) external;
  function execute(uint proposalId) external payable;

  function proposalCount() external returns (uint);
}
