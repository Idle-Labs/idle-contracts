pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "./interfaces/IIdleTokenV3_1.sol";
import "./interfaces/IIdleToken.sol";

// This contract should never have tokens at the end of a transaction.
// if for some reason tokens are stuck inside there is an emergency withdraw method
// This contract is not audited
contract IdleBatchConverter is Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // batchDeposits[user][batchId] = amount
  mapping (address => mapping (uint256 => uint256)) public batchDeposits;
  mapping (uint256 => uint256) batchTotals;
  mapping (uint256 => uint256) batchRedeemedTotals;
  uint256 public currBatch;

  address public idleToken;
  address public newIdleToken;

  constructor(address _idleToken, address _newIdleToken) public {
    idleToken = _idleToken;
    newIdleToken = _newIdleToken;
  }

  // User should approve this contract first to spend IdleTokens idleToken
  function deposit() external {
    uint256 bal = IERC20(idleToken).balanceOf(msg.sender);
    IERC20(idleToken).safeTransferFrom(msg.sender, address(this), bal);

    batchDeposits[msg.sender][currBatch] = bal;
    batchTotals[currBatch] = batchTotals[currBatch].add(bal);
  }

  function withdraw(uint256 batchId) external {
    require(currBatch != 0 && batchId < currBatch, 'Batch id invalid');

    uint256 deposited = batchDeposits[msg.sender][batchId];
    uint256 batchBal = batchRedeemedTotals[batchId];
    uint256 share = deposited.mul(batchBal).div(batchTotals[batchId]);
    batchRedeemedTotals[batchId] = batchRedeemedTotals[batchId].sub(share);
    batchTotals[batchId] = batchTotals[batchId].sub(deposited);
    batchDeposits[msg.sender][batchId] = 0;
    IERC20(newIdleToken).safeTransfer(msg.sender, share);
  }

  // idleToken : old idle address
  // _to : new idle address
  // _underlying : underlying addr intially redeemd (eg. DAI)
  function migrateFromToIdle(bool _skipRebalance) external returns (uint256) {
    address _underlying = IIdleTokenV3_1(idleToken).token();
    IIdleToken(idleToken).redeemIdleToken(IERC20(idleToken).balanceOf(address(this)), true, new uint256[](0));
    uint256 underlyingBalance = IERC20(_underlying).balanceOf(address(this));
    IERC20(_underlying).safeApprove(newIdleToken, underlyingBalance);
    IERC20(_underlying).safeApprove(newIdleToken, underlyingBalance);
    uint256 minted = IIdleTokenV3_1(newIdleToken).mintIdleToken(underlyingBalance, _skipRebalance, address(0));
    batchRedeemedTotals[currBatch] = minted;
    currBatch = currBatch + 1;
  }

  // onlyOwner
  function emergencyWithdrawToken(address _token, address _to) external onlyOwner {
    IERC20(_token).safeTransfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}
