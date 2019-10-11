pragma solidity 0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./IdleToken.sol";

contract IdleFactory is Ownable {
  // tokenAddr (eg. DAI add) => idleTokenAddr (eg. idleDAI)
  mapping (address => address) public underlyingToIdleTokenMap;
  address[] public tokensSupported;

  function newIdleToken(
    string calldata _name, // eg. IdleDAI
    string calldata _symbol, // eg. IDLEDAI
    uint8 _decimals, // eg. 18
    address _token,
    address _cToken,
    address _iToken,
    address _rebalancer,
    address _idleCompound,
    address _idleFulcrum
  ) external onlyOwner returns(address) {
    IdleToken idleToken = new IdleToken(
      _name, // eg. IdleDAI
      _symbol, // eg. IDLEDAI
      _decimals, // eg. 18
      _token,
      _cToken,
      _iToken,
      _rebalancer,
      _idleCompound,
      _idleFulcrum
    );
    if (underlyingToIdleTokenMap[_token] == address(0)) {
      tokensSupported.push(_token);
    }
    underlyingToIdleTokenMap[_token] = address(idleToken);

    idleToken.transferOwnership(msg.sender);
    idleToken.addPauser(msg.sender);
    idleToken.renouncePauser();

    return address(idleToken);
  }

  function supportedTokens() external view returns(address[] memory) {
    return tokensSupported;
  }
}
