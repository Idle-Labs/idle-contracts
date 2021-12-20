// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.5.16;
interface IAaveIncentivesControllerPolygon {
  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external returns (uint256);

  /**
   * @dev returns the unclaimed rewards of the user
   * @param user the address of the user
   * @return the unclaimed user rewards
   */
  function getUserUnclaimedRewards(address user) external view returns (uint256);
  function getAssetData(address asset) external view returns (uint256, uint256, uint256);
  function assets(address asset) external view returns (uint256, uint256, uint256);
  function getRewardsBalance(address[] calldata assets, address user) external view returns(uint256);
}
