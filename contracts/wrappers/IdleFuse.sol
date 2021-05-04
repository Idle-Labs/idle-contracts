/**
 * @title: FUSE RAI wrapper
 * @summary: Used for interacting with the Fuse protocol.
 *           This contract holds assets only during a tx, after tx it should be empty
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/FuseCERC20.sol";
import "../interfaces/WhitePaperInterestRateModel.sol";
import "./IdleCompoundLike.sol";

// This contract should be deployed with a minimal proxy factory
contract IdleFuse is IdleCompoundLike {
  using SafeMath for uint256;

  /**
   * Calculate next supply rate for Fuse, given an `_amount` supplied
   *
   * @param _amount : new underlying amount supplied
   * @return : yearly net rate
   */
  function nextSupplyRate(uint256 _amount)
    external view
    returns (uint256) {
      FuseCERC20 cToken = FuseCERC20(token);
      WhitePaperInterestRateModel white = WhitePaperInterestRateModel(FuseCERC20(token).interestRateModel());
      uint256 ratePerBlock = white.getSupplyRate(
        cToken.getCash().add(_amount),
        cToken.totalBorrows(),
        cToken.totalReserves().add(cToken.totalFuseFees()).add(cToken.totalAdminFees()),
        cToken.reserveFactorMantissa().add(cToken.fuseFeeMantissa()).add(cToken.adminFeeMantissa())
      );
      return ratePerBlock.mul(blocksPerYear).mul(100);
  }
}
