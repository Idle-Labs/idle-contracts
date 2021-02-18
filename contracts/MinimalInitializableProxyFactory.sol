pragma solidity 0.5.16;

contract MinimalInitializableProxyFactory {
  event ProxyCreated(address);

  function create(address target, string memory initSignature, bytes memory initData) public {
    address clone = createClone(target);
    bytes memory callData;

    if (bytes(initSignature).length == 0) {
      callData = initData;
    } else {
      callData = abi.encodePacked(bytes4(keccak256(bytes(initSignature))), initData);
    }

    // solium-disable-next-line security/no-call-value
    (bool success, bytes memory returnData) = clone.call(callData);
    require(success, "Initialization reverted");
    emit ProxyCreated(clone);
  }

  function createClone(address target) internal returns (address result) {
    bytes20 targetBytes = bytes20(target);
    assembly {
      let clone := mload(0x40)
      mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(clone, 0x14), targetBytes)
      mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
      result := create(0, clone, 0x37)
    }
  }

  function isClone(address target, address query) internal view returns (bool result) {
    bytes20 targetBytes = bytes20(target);
    assembly {
      let clone := mload(0x40)
      mstore(clone, 0x363d3d373d3d3d363d7300000000000000000000000000000000000000000000)
      mstore(add(clone, 0xa), targetBytes)
      mstore(add(clone, 0x1e), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)

      let other := add(clone, 0x40)
      extcodecopy(query, other, 0, 0x2d)
      result := and(
        eq(mload(clone), mload(other)),
        eq(mload(add(clone, 0xd)), mload(add(other, 0xd)))
      )
    }
  }
}
