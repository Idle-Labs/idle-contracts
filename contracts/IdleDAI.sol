pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/CERC20.sol";
import "./interfaces/iERC20Fulcrum.sol";
import "./IdleHelp.sol";

contract IdleDAI is ERC20, ERC20Detailed, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address public cToken; // cTokens have 8 decimals
  address public iToken; // iTokens have 18 decimals
  address public token;
  address public bestToken;

  uint256 public blocksInAYear;
  uint256 public minRateDifference;

  /**
   * @dev constructor
   */
  constructor(address _cToken, address _iToken, address _token)
    public
    ERC20Detailed("IdleDAI", "IDLEDAI", 18) {
      cToken = _cToken;
      iToken = _iToken;
      token = _token;
      blocksInAYear = 2102400; // ~15 sec per block
      minRateDifference = 100000000000000000; // 0.1% min
  }

  // onlyOwner
  function setMinRateDifference(uint256 _rate)
    external onlyOwner {
      minRateDifference = _rate;
  }
  function setBlocksInAYear(uint256 _blocks)
    external onlyOwner {
      blocksInAYear = _blocks;
  }
  function setToken(address _token)
    external onlyOwner {
      token = _token;
  }
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }
  function setCToken(address _cToken)
    external onlyOwner {
      cToken = _cToken;
  }
  // This should never be called, only in case of contract failure
  // after an audit this should be removed
  function emergencyWithdraw(address _token, uint256 _value)
    external onlyOwner {
      IERC20 underlying = IERC20(_token);
      if (_value != 0) {
        underlying.safeTransfer(msg.sender, _value);
      } else {
        underlying.safeTransfer(msg.sender, underlying.balanceOf(address(this)));
      }
  }

  // view
  function tokenPrice()
    public view
    returns (uint256 price) {
      uint256 poolSupply = IERC20(cToken).balanceOf(address(this));
      if (bestToken == iToken) {
        poolSupply = IERC20(iToken).balanceOf(address(this));
      }

      price = IdleHelp.getPriceInToken(
        cToken,
        iToken,
        bestToken,
        this.totalSupply(),
        poolSupply
      );
  }
  function rebalanceCheck()
    public view
    returns (bool, address) {
      return IdleHelp.rebalanceCheck(cToken, iToken, bestToken, blocksInAYear, minRateDifference);
  }
  function getAPRs()
    external view
    returns (uint256, uint256) {
      return IdleHelp.getAPRs(cToken, iToken, blocksInAYear);
  }

  // public
  /**
   * @dev User should 'approve' _amount tokens before calling mintIdleToken
   */
  function mintIdleToken(uint256 _amount)
    external nonReentrant
    returns (uint256 mintedTokens) {
      require(_amount > 0, "Amount is not > 0");

      // First rebalance the current pool if needed
      rebalance();

      // get a handle for the underlying asset contract
      IERC20 underlying = IERC20(token);
      // transfer to this contract
      underlying.safeTransferFrom(msg.sender, address(this), _amount);

      uint256 idlePrice = 10**18;
      uint256 totalSupply = this.totalSupply();

      if (totalSupply != 0) {
        idlePrice = tokenPrice();
      }

      if (bestToken == cToken) {
        _mintCTokens(_amount);
      } else {
        _mintITokens(_amount);
      }
      if (totalSupply == 0) {
        mintedTokens = _amount; // 1:1
      } else {
        mintedTokens = _amount.mul(10**18).div(idlePrice);
      }
      _mint(msg.sender, mintedTokens);
  }

  /**
   * @dev here we calc the pool share of the cTokens | iTokens one can withdraw
   */
  function redeemIdleToken(uint256 _amount)
    external nonReentrant
    returns (uint256 tokensRedeemed) {
    uint256 idleSupply = this.totalSupply();
    require(idleSupply > 0, 'No IDLEDAI have been issued');

    if (bestToken == cToken) {
      uint256 cPoolBalance = IERC20(cToken).balanceOf(address(this));
      uint256 cDAItoRedeem = _amount.mul(cPoolBalance).div(idleSupply);
      tokensRedeemed = _redeemCTokens(cDAItoRedeem, msg.sender);
    } else {
      uint256 iPoolBalance = IERC20(iToken).balanceOf(address(this));
      uint256 iDAItoRedeem = _amount.mul(iPoolBalance).div(idleSupply);
      // TODO we should inform the user of the eventual excess of token that can be redeemed directly in Fulcrum
      tokensRedeemed = _redeemITokens(iDAItoRedeem, msg.sender);
    }
    _burn(msg.sender, _amount);
    rebalance();
  }

  /**
   * @dev Convert cToken pool in iToken pool (or the contrary) if needed
   * Everyone should be incentivized in calling this method
   */
  function rebalance()
    public {
      (bool shouldRebalance, address newBestTokenAddr) = rebalanceCheck();
      if (!shouldRebalance) {
        return;
      }

      if (bestToken != address(0)) {
        // bestToken here is the 'old' best token
        if (bestToken == cToken) {
          _redeemCTokens(IERC20(cToken).balanceOf(address(this)), address(this)); // token are now in this contract
          _mintITokens(IERC20(token).balanceOf(address(this)));
        } else {
          _redeemITokens(IERC20(iToken).balanceOf(address(this)), address(this));
          _mintCTokens(IERC20(token).balanceOf(address(this)));
        }
      }

      // Update best token address
      bestToken = newBestTokenAddr;
  }
  /**
   * @dev here we are redeeming unclaimed token (from iToken contract) to this contracts
   * then converting the claimedTokens in the bestToken after rebalancing
   * Everyone should be incentivized in calling this method
   */
  function claimITokens()
    external
    returns (uint256 claimedTokens) {
      claimedTokens = iERC20Fulcrum(iToken).claimLoanToken();
      if (claimedTokens == 0) {
        return claimedTokens;
      }

      rebalance();
      if (bestToken == cToken) {
        _mintCTokens(claimedTokens);
      } else {
        _mintITokens(claimedTokens);
      }

      return claimedTokens;
  }

  // internal
  function _mintCTokens(uint256 _amount)
    internal
    returns (uint256 cTokens) {
      if (IERC20(token).balanceOf(address(this)) == 0) {
        return cTokens;
      }
      // approve the transfer to cToken contract
      IERC20(token).safeIncreaseAllowance(cToken, _amount);

      // get a handle for the corresponding cToken contract
      CERC20 _cToken = CERC20(cToken);
      // mint the cTokens and assert there is no error
      require(_cToken.mint(_amount) == 0, "Error minting");
      // cTokens are now in this contract

      // generic solidity formula is exchangeRateMantissa = (underlying / cTokens) * 1e18
      uint256 exchangeRateMantissa = _cToken.exchangeRateStored(); // (exchange_rate * 1e18)
      // so cTokens = (underlying * 1e18) / exchangeRateMantissa
      cTokens = _amount.mul(10**18).div(exchangeRateMantissa);
  }
  function _mintITokens(uint256 _amount)
    internal
    returns (uint256 iTokens) {
      if (IERC20(token).balanceOf(address(this)) == 0) {
        return iTokens;
      }
      // approve the transfer to iToken contract
      IERC20(token).safeIncreaseAllowance(iToken, _amount);
      // get a handle for the corresponding iToken contract
      iERC20Fulcrum _iToken = iERC20Fulcrum(iToken);
      // mint the iTokens
      iTokens = _iToken.mint(address(this), _amount);
  }

  function _redeemCTokens(uint256 _amount, address _account)
    internal
    returns (uint256 tokens) {
      CERC20 _cToken = CERC20(cToken);
      // redeem all user's underlying
      require(_cToken.redeem(_amount) == 0, "Something went wrong when redeeming in cTokens");

      // generic solidity formula is exchangeRateMantissa = (underlying / cTokens) * 1e18
      uint256 exchangeRateMantissa = _cToken.exchangeRateStored(); // exchange_rate * 1e18
      // so underlying = (exchangeRateMantissa * cTokens) / 1e18
      tokens = _amount.mul(exchangeRateMantissa).div(10**18);

      if (_account != address(this)) {
        IERC20(token).safeTransfer(_account, tokens);
      }
  }
  function _redeemITokens(uint256 _amount, address _account)
    internal
    returns (uint256 tokens) {
      tokens = iERC20Fulcrum(iToken).burn(_account, _amount);
  }
}
