pragma solidity 0.5.16;

// interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAaveIncentivesController.sol";

contract AaveIncentivesControllerMock is IAaveIncentivesController {
  uint256 public rewards;
  address public aaveMock;

  constructor(address _aaveMock) public {
    aaveMock = _aaveMock;
  }

  function _setRewards(uint256 _rewards) external {
    rewards = _rewards;
  }

  function claimRewards(
    address[] calldata,
    uint256 amount,
    address to
  ) external returns (uint256) {
    require(amount == rewards, 'Rewards are different');
    IERC20(aaveMock).transfer(to, amount);
    return amount;
  }

  function getUserUnclaimedRewards(address) external view returns (uint256) {
    return rewards;
  }
}
