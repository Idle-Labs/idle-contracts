pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IIdleTokenV3_1.sol";
import "./interfaces/IIdleToken.sol";

contract IdleBatchConverter is Initializable, Ownable, Pausable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // batchDeposits[user][batchId] = amount
  mapping (address => mapping (uint256 => uint256)) public batchDeposits;
  mapping (uint256 => uint256) public batchTotals;
  mapping (uint256 => uint256) public batchRedeemedTotals;
  uint256 public currBatch;
  address public idleToken;
  address public newIdleToken;
  address public underlying;

  function initialize(address _idleToken, address _newIdleToken) public initializer {
    Ownable.initialize(msg.sender);
    Pausable.initialize(msg.sender);
    idleToken = _idleToken;
    newIdleToken = _newIdleToken;
    underlying = IIdleTokenV3_1(idleToken).token();
    IERC20(underlying).safeApprove(newIdleToken, uint256(-1));
  }
  // User should approve this contract first to spend IdleTokens idleToken
  function deposit() external whenNotPaused {
    uint256 bal = IERC20(idleToken).balanceOf(msg.sender);
    IERC20(idleToken).safeTransferFrom(msg.sender, address(this), bal);
    batchDeposits[msg.sender][currBatch] = bal;
    batchTotals[currBatch] = batchTotals[currBatch].add(bal);
  }
  function withdraw(uint256 batchId) external whenNotPaused {
    require(currBatch != 0 && batchId < currBatch, 'Batch id invalid');
    uint256 deposited = batchDeposits[msg.sender][batchId];
    uint256 batchBal = batchRedeemedTotals[batchId];
    uint256 share = deposited.mul(batchBal).div(batchTotals[batchId]);
    if (share > batchBal) {
      share = batchBal;
    }
    batchRedeemedTotals[batchId] = batchBal.sub(share);
    batchTotals[batchId] = batchTotals[batchId].sub(deposited);
    batchDeposits[msg.sender][batchId] = 0;
    IERC20(newIdleToken).safeTransfer(msg.sender, share);
  }
  function migrateFromToIdle(bool _skipRebalance) external whenNotPaused returns (uint256) {
    IIdleToken(idleToken).redeemIdleToken(IERC20(idleToken).balanceOf(address(this)), true, new uint256[](0));
    uint256 minted = IIdleTokenV3_1(newIdleToken).mintIdleToken(
      IERC20(underlying).balanceOf(address(this)), _skipRebalance, address(0)
    );
    batchRedeemedTotals[currBatch] = minted;
    currBatch = currBatch + 1;
  }
  function emergencyWithdrawToken(address _token, address _to) external onlyOwner {
    IERC20(_token).safeTransfer(_to, IERC20(_token).balanceOf(address(this)));
  }
}
