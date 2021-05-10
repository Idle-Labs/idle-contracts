pragma solidity 0.5.16;

import "../interfaces/IProxyAdmin.sol";

contract FakeTimelock {
  function executeTransaction(address target, uint value, string memory signature, bytes memory data) public payable returns (bytes memory) {
    bytes memory callData;

    if (bytes(signature).length == 0) {
      callData = data;
    } else {
      callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
    }

    // solium-disable-next-line security/no-call-value
    (bool success, bytes memory returnData) = target.call(callData);
    require(success, "FakeTimelock::executeTransaction: Transaction execution reverted.");

    return returnData;
  }

  function transferOwnership(address target, address newOwner) public {
    IProxyAdmin(target).transferOwnership(newOwner);
  }
}
