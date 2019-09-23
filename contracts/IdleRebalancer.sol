pragma solidity 0.5.11;

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract IdleRebalancer {
  using SafeMath for uint256;

  function calcRebalanceAmounts()
    public view
    /* returns (TokenAmount[] memory amounts) */
    returns (address[] memory tokenAddresses, uint256[] memory amounts)
  {
    // TODO
  }
}
