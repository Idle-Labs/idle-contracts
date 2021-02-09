/**
 * @title: Idle Token (V3) main contract
 * @summary: ERC20 that holds pooled user funds together
 *           Each token rapresent a share of the underlying pools
 *           and with each token user have the right to redeem a portion of these pools
 * @author: Idle Labs Inc., idle.finance
 */
pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol";

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./interfaces/iERC20Fulcrum.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IGovToken.sol";
import "./interfaces/IIdleTokenV3_1.sol";

import "./interfaces/Comptroller.sol";
import "./interfaces/CERC20.sol";
import "./interfaces/IdleController.sol";
import "./interfaces/PriceOracle.sol";

import "./GST2ConsumerV2.sol";

contract IdleTokenGovernance is Initializable, ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable, IIdleTokenV3_1, GST2ConsumerV2 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 private constant ONE_18 = 10**18;
  // State variables
  // eg. DAI address
  address public token;
  // eg. iDAI address
  address private iToken;
  // eg. cDAI address
  address private cToken;
  // Idle rebalancer current implementation address
  address public rebalancer;
  // Address collecting underlying fees
  address public feeAddress;
  // Last iToken price, used to pause contract in case of a black swan event
  uint256 public lastITokenPrice;
  // eg. 18 for DAI
  uint256 private tokenDecimals;
  // Max unlent assets percentage for gas friendly swaps
  uint256 public maxUnlentPerc; // 100000 == 100% -> 1000 == 1%
  // Current fee on interest gained
  uint256 public fee;
  // eg. [cTokenAddress, iTokenAddress, ...]
  address[] public allAvailableTokens;
  // eg. [COMPAddress, CRVAddress, ...]
  address[] public govTokens;
  // last fully applied allocations (ie when all liquidity has been correctly placed)
  // eg. [5000, 0, 5000, 0] for 50% in compound, 0% fulcrum, 50% aave, 0 dydx. same order of allAvailableTokens
  uint256[] public lastAllocations;
  // Map that saves avg idleToken price paid for each user, used to calculate earnings
  mapping(address => uint256) public userAvgPrices;
  // eg. cTokenAddress => IdleCompoundAddress
  mapping(address => address) public protocolWrappers;
  // array with last balance recorded for each gov tokens
  mapping (address => uint256) public govTokensLastBalances;
  // govToken -> user_address -> user_index eg. usersGovTokensIndexes[govTokens[0]][msg.sender] = 1111123;
  mapping (address => mapping (address => uint256)) public usersGovTokensIndexes;
  // global indices for each gov tokens used as a reference to calculate a fair share for each user
  mapping (address => uint256) public govTokensIndexes;
  // Map that saves amount with no fee for each user
  mapping(address => uint256) private userNoFeeQty;
  // variable used for avoid the call of mint and redeem in the same tx
  bytes32 private _minterBlock;

  // Events
  event Rebalance(address _rebalancer, uint256 _amount);
  event Referral(uint256 _amount, address _ref);

  // ########## IdleToken V4_1 updates
  // Idle governance token
  address public constant IDLE = address(0x875773784Af8135eA0ef43b5a374AaD105c5D39e);
  // Compound governance token
  address public constant COMP = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
  uint256 private constant FULL_ALLOC = 100000;

  // Idle distribution controller
  address public constant idleController = address(0x275DA8e61ea8E02d51EDd8d0DC5c0E62b4CDB0BE);
  // oracle used for calculating the avgAPR with gov tokens
  address public oracle;
  // eg cDAI -> COMP
  mapping(address => address) private protocolTokenToGov;
  // Whether openRebalance is enabled or not
  bool public isRiskAdjusted;
  // last allocations submitted by rebalancer
  uint256[] private lastRebalancerAllocations;

  // onlyOwner
  /**
   * It allows owner to modify allAvailableTokens array in case of emergency
   * ie if a bug on a interest bearing token is discovered and reset protocolWrappers
   * associated with those tokens.
   *
   * @param protocolTokens : array of protocolTokens addresses (eg [cDAI, iDAI, ...])
   * @param wrappers : array of wrapper addresses (eg [IdleCompound, IdleFulcrum, ...])
   * @param allocations : array of allocations
   * @param keepAllocations : whether to update lastRebalancerAllocations or not
   */
  function setAllAvailableTokensAndWrappers(
    address[] calldata protocolTokens,
    address[] calldata wrappers,
    uint256[] calldata allocations,
    bool keepAllocations
  ) external onlyOwner {
    require(protocolTokens.length == wrappers.length && (allocations.length == wrappers.length || keepAllocations), "IDLE:LEN_DIFF");

    for (uint256 i = 0; i < protocolTokens.length; i++) {
      require(protocolTokens[i] != address(0) && wrappers[i] != address(0), "IDLE:IS_0");
      protocolWrappers[protocolTokens[i]] = wrappers[i];
    }
    allAvailableTokens = protocolTokens;

    if (keepAllocations) {
      require(protocolTokens.length == allAvailableTokens.length, "IDLE:LEN_DIFF2");
      return;
    }
    _setAllocations(allocations);
  }

  /**
   * It allows owner to set gov tokens array
   * In case of any errors gov distribution can be paused by passing an empty array
   *
   * @param _newGovTokens : array of governance token addresses
   * @param _protocolTokens : array of interest bearing token addresses
   */
  function setGovTokens(
    address[] calldata _newGovTokens,
    address[] calldata _protocolTokens
  ) external onlyOwner {
    govTokens = _newGovTokens;
    // Reset protocolTokenToGov mapping
    for (uint256 i = 0; i < allAvailableTokens.length; i++) {
      protocolTokenToGov[allAvailableTokens[i]] = address(0);
    }
    // set protocol token to gov token mapping
    for (uint256 i = 0; i < _protocolTokens.length; i++) {
      address newGov = _newGovTokens[i];
      if (newGov == IDLE) { continue; }
      protocolTokenToGov[_protocolTokens[i]] = _newGovTokens[i];
    }
  }

  /**
   * It allows owner to set the IdleRebalancerV3_1 address
   *
   * @param _rebalancer : new IdleRebalancerV3_1 address
   */
  function setRebalancer(address _rebalancer)
    external onlyOwner {
      require(_rebalancer != address(0), "IDLE:IS_0");
      rebalancer = _rebalancer;
  }

  /**
   * It allows owner to set the fee (1000 == 10% of gained interest)
   *
   * @param _fee : fee amount where 100000 is 100%, max settable is 10%
   */
  function setFee(uint256 _fee)
    external onlyOwner {
      // 100000 == 100% -> 10000 == 10%
      require(_fee <= 10000, "IDLE:TOO_HIGH");
      fee = _fee;
  }

  /**
   * It allows owner to set the fee address
   *
   * @param _feeAddress : fee address
   */
  function setFeeAddress(address _feeAddress)
    external onlyOwner {
      require(_feeAddress != address(0), "IDLE:IS_0");
      feeAddress = _feeAddress;
  }

  /**
   * It allows owner to set the oracle address for getting avgAPR
   *
   * @param _oracle : new oracle address
   */
  function setOracleAddress(address _oracle)
    external onlyOwner {
      require(_oracle != address(0), "IDLE:IS_0");
      oracle = _oracle;
  }

  /**
   * It allows owner to set the max unlent asset percentage (1000 == 1% of unlent asset max)
   *
   * @param _perc : max unlent perc where 100000 is 100%
   */
  function setMaxUnlentPerc(uint256 _perc)
    external onlyOwner {
      require(_perc <= 100000, "IDLE:TOO_HIGH");
      maxUnlentPerc = _perc;
  }

  /**
   * It allows owner to set the isRiskAdjusted flag
   *
   * @param _isRiskAdjusted : flag for openRebalance
   */
  function setIsRiskAdjusted(bool _isRiskAdjusted)
    external onlyOwner {
      isRiskAdjusted = _isRiskAdjusted;
  }

  /**
   * Used by Rebalancer to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 100000)
   */
  function setAllocations(uint256[] calldata _allocations) external {
    require(msg.sender == rebalancer || msg.sender == owner(), "IDLE:!AUTH");
    _setAllocations(_allocations);
  }

  /**
   * Used by Rebalancer or in openRebalance to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 100000)
   */
  function _setAllocations(uint256[] memory _allocations) internal {
    require(_allocations.length == allAvailableTokens.length, "IDLE:!EQ_LEN");
    uint256 total;
    for (uint256 i = 0; i < _allocations.length; i++) {
      total = total.add(_allocations[i]);
    }
    lastRebalancerAllocations = _allocations;
    require(total == FULL_ALLOC, "IDLE:!EQ_TOT");
  }

  // view
  /**
   * Get latest allocations submitted by rebalancer
   *
   * @return : array of allocations ordered as allAvailableTokens
   */
  function getAllocations() external view returns (uint256[] memory) {
    return lastRebalancerAllocations;
  }

  /**
   * IdleToken price calculation, in underlying
   *
   * @return : price in underlying token
   */
  function tokenPrice()
    external view
    returns (uint256) {
    return _tokenPrice();
  }

  /**
   * Get APR of every ILendingProtocol
   *
   * @return addresses: array of token addresses
   * @return aprs: array of aprs (ordered in respect to the `addresses` array)
   */
  function getAPRs()
    external view
    returns (address[] memory addresses, uint256[] memory aprs) {
      address currToken;
      addresses = new address[](allAvailableTokens.length);
      aprs = new uint256[](allAvailableTokens.length);
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currToken = allAvailableTokens[i];
        addresses[i] = currToken;
        aprs[i] = ILendingProtocol(protocolWrappers[currToken]).getAPR();
      }
  }

  /**
   * Get current avg APR of this IdleToken
   *
   * @return avgApr: current weighted avg apr
   */
  function getAvgAPR()
    external view
    returns (uint256) {
    return _getAvgAPR();
  }

  /**
   * Get current avg APR of this IdleToken
   *
   * @return avgApr: current weighted avg apr
   */
  function _getAvgAPR()
    internal view
    returns (uint256 avgApr) {
      (, uint256[] memory amounts, uint256 total) = _getCurrentAllocations();
      // IDLE gov token won't be counted here because is not in allAvailableTokens
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        if (amounts[i] == 0) {
          continue;
        }
        address protocolToken = allAvailableTokens[i];
        // avgApr = avgApr.add(currApr.mul(weight).div(ONE_18))
        avgApr = avgApr.add(
          ILendingProtocol(protocolWrappers[protocolToken]).getAPR().mul(
            amounts[i]
          )
        );
        // Add weighted gov tokens apr
        address currGov = protocolTokenToGov[protocolToken];
        if (govTokens.length > 0 && currGov != address(0)) {
          avgApr = avgApr.add(amounts[i].mul(getGovApr(currGov)));
        }
      }

      avgApr = avgApr.div(total);
  }

  /**
   * Get gov token APR
   *
   * @return : apr scaled to 1e18
   */
  function getGovApr(address _govToken) internal view returns (uint256) {
    // In case new Gov tokens will be supported this should be updated, no need to add IDLE apr
    if (_govToken == COMP && cToken != address(0)) {
      return PriceOracle(oracle).getCompApr(cToken, token);
    }
  }

  /**
   * ERC20 modified transferFrom that also update the avgPrice paid for the recipient and
   * updates user gov idx
   *
   * @param sender : sender account
   * @param recipient : recipient account
   * @param amount : value to transfer
   * @return : flag whether transfer was successful or not
   */
  function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
    _updateUserGovIdxTransfer(sender, recipient, amount);
    _transfer(sender, recipient, amount);
    _approve(sender, msg.sender, allowance(sender, msg.sender).sub(amount, "ERC20: transfer amount exceeds allowance"));
    _updateUserFeeInfoTransfer(sender, recipient, amount, userAvgPrices[sender]);
    return true;
  }

  /**
   * ERC20 modified transfer that also update the avgPrice paid for the recipient and
   * updates user gov idx
   *
   * @param recipient : recipient account
   * @param amount : value to transfer
   * @return : flag whether transfer was successful or not
   */
  function transfer(address recipient, uint256 amount) public returns (bool) {
    _updateUserGovIdxTransfer(msg.sender, recipient, amount);
    _transfer(msg.sender, recipient, amount);
    _updateUserFeeInfoTransfer(msg.sender, recipient, amount, userAvgPrices[msg.sender]);
    return true;
  }

  /**
   * Helper method for transfer and transferFrom, updates recipient gov indexes
   *
   * @param _from : sender account
   * @param _to : recipient account
   * @param amount : value to transfer
   */
  function _updateUserGovIdxTransfer(address _from, address _to, uint256 amount) internal {
    address govToken;
    uint256 govTokenIdx;
    uint256 sharePerTokenFrom;
    uint256 shareTo;
    uint256 balanceTo = balanceOf(_to);
    for (uint256 i = 0; i < govTokens.length; i++) {
      govToken = govTokens[i];
      if (balanceTo == 0) {
        usersGovTokensIndexes[govToken][_to] = usersGovTokensIndexes[govToken][_from];
        continue;
      }

      govTokenIdx = govTokensIndexes[govToken];
      // calc 1 idleToken value in gov shares for user `_from`
      sharePerTokenFrom = govTokenIdx.sub(usersGovTokensIndexes[govToken][_from]);
      // calc current gov shares (before transfer) for user `_to`
      shareTo = balanceTo.mul(govTokenIdx.sub(usersGovTokensIndexes[govToken][_to])).div(ONE_18);
      // user `_to` should have -> shareTo + (sharePerTokenFrom * amount / 1e18) = (balanceTo + amount) * (govTokenIdx - userIdx) / 1e18
      // so userIdx = govTokenIdx - ((shareTo * 1e18 + (sharePerTokenFrom * amount)) / (balanceTo + amount))
      usersGovTokensIndexes[govToken][_to] = govTokenIdx.sub(
        shareTo.mul(ONE_18).add(sharePerTokenFrom.mul(amount)).div(
          balanceTo.add(amount)
        )
      );
    }
  }

  /**
   * Get how many gov tokens a user is entitled to (this may not include eventual undistributed tokens)
   *
   * @param _usr : user address
   * @return : array of amounts for each gov token
   */
  function getGovTokensAmounts(address _usr) external view returns (uint256[] memory _amounts) {
    address govToken;
    uint256 usrBal = balanceOf(_usr);
    _amounts = new uint256[](govTokens.length);
    for (uint256 i = 0; i < _amounts.length; i++) {
      govToken = govTokens[i];
      _amounts[i] = usrBal.mul(govTokensIndexes[govToken].sub(usersGovTokensIndexes[govToken][_usr])).div(ONE_18);
    }
  }

  // external
  /**
   * Used to mint IdleTokens, given an underlying amount (eg. DAI).
   * This method triggers a rebalance of the pools if _skipRebalance is set to false
   * NOTE: User should 'approve' _amount of tokens before calling mintIdleToken
   * NOTE 2: this method can be paused
   * This method use GasTokens of this contract (if present) to get a gas discount
   *
   * @param _amount : amount of underlying token to be lended
   * @param _referral : referral address
   * @return mintedTokens : amount of IdleTokens minted
   */
  function mintIdleToken(uint256 _amount, bool _skipRebalance, address _referral)
    external nonReentrant whenNotPaused
    returns (uint256 mintedTokens) {
    _minterBlock = keccak256(abi.encodePacked(tx.origin, block.number));
    _redeemGovTokens(msg.sender, false);
    // Get current IdleToken price
    uint256 idlePrice = _tokenPrice();
    // transfer tokens to this contract
    IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

    if (!_skipRebalance) {
      // lend assets and rebalance the pool if needed
      _rebalance();
    }

    mintedTokens = _amount.mul(ONE_18).div(idlePrice);
    _mint(msg.sender, mintedTokens);

    // Update avg price and/or userNoFeeQty
    _updateUserFeeInfo(msg.sender, mintedTokens, idlePrice);
    // Update user idx for each gov tokens
    _updateUserGovIdx(msg.sender, mintedTokens);

    if (_referral != address(0)) {
      emit Referral(_amount, _referral);
    }
  }

  /**
   * Helper method for mintIdleToken, updates minter gov indexes
   *
   * @param _to : minter account
   * @param _mintedTokens : number of newly minted tokens
   */
  function _updateUserGovIdx(address _to, uint256 _mintedTokens) internal {
    address govToken;
    uint256 usrBal = balanceOf(_to);
    uint256 _govIdx;
    uint256 _usrIdx;

    for (uint256 i = 0; i < govTokens.length; i++) {
      govToken = govTokens[i];
      _govIdx = govTokensIndexes[govToken];
      _usrIdx = usersGovTokensIndexes[govToken][_to];

      // calculate user idx
      usersGovTokensIndexes[govToken][_to] = usrBal.mul(_usrIdx).add(
        _mintedTokens.mul(_govIdx.sub(_usrIdx))
      ).div(usrBal);
    }
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   *
   * @param _amount : amount of IdleTokens to be burned
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleToken(uint256 _amount)
    external nonReentrant
    returns (uint256 redeemedTokens) {
      _checkMintRedeemSameTx();

      _redeemGovTokens(msg.sender, false);

      uint256 price = _tokenPrice();
      uint256 valueToRedeem = _amount.mul(price).div(ONE_18);
      uint256 balanceUnderlying = IERC20(token).balanceOf(address(this));
      uint256 idleSupply = totalSupply();

      if (valueToRedeem <= balanceUnderlying) {
        redeemedTokens = valueToRedeem;
      } else {
        address currToken;
        for (uint256 i = 0; i < allAvailableTokens.length; i++) {
          currToken = allAvailableTokens[i];
          redeemedTokens = redeemedTokens.add(
            _redeemProtocolTokens(
              currToken,
              // _amount * protocolPoolBalance / idleSupply
              _amount.mul(IERC20(currToken).balanceOf(address(this))).div(idleSupply), // amount to redeem
              address(this)
            )
          );
        }
        // Get a portion of the eventual unlent balance
        redeemedTokens = redeemedTokens.add(_amount.mul(balanceUnderlying).div(idleSupply));
      }
      // get eventual performance fee
      redeemedTokens = _getFee(_amount, redeemedTokens, price);
      // burn idleTokens
      _burn(msg.sender, _amount);
      // send underlying minus fee to msg.sender
      IERC20(token).safeTransfer(msg.sender, redeemedTokens);
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   * and send interest-bearing tokens (eg. cDAI/iDAI) directly to the user.
   * Underlying (eg. DAI) is not redeemed here.
   *
   * @param _amount : amount of IdleTokens to be burned
   */
  function redeemInterestBearingTokens(uint256 _amount)
    external nonReentrant whenPaused {
      _checkMintRedeemSameTx();

      _redeemGovTokens(msg.sender, false);

      uint256 idleSupply = totalSupply();
      address currentToken;

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currentToken = allAvailableTokens[i];
        IERC20(currentToken).safeTransfer(
          msg.sender,
          _amount.mul(IERC20(currentToken).balanceOf(address(this))).div(idleSupply) // amount to redeem
        );
      }
      // Get a portion of the eventual unlent balance
      IERC20(token).safeTransfer(
        msg.sender,
        _amount.mul(IERC20(token).balanceOf(address(this))).div(idleSupply) // amount to redeem
      );

      _burn(msg.sender, _amount);
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed, use gas refund from gasToken
   *
   * NOTE: this method can be paused.
   * msg.sender should approve this contract to spend GST2 tokens before calling
   * this method
   *
   * @return : whether has rebalanced or not
   */
  function rebalanceWithGST()
    external gasDiscountFrom(msg.sender)
    returns (bool) {
      return _rebalance();
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed,
   * rebalance without params
   *
   * NOTE: this method can be paused
   *
   * @return : whether has rebalanced or not
   */
  function rebalance() external returns (bool) {
    return _rebalance();
  }

  /**
   * Allow any users to set new allocations as long as the new allocation
   * gives a better avg APR than before
   * Allocations should be in the format [100000, 0, 0, 0, ...] where length is the same
   * as lastAllocations variable and the sum of all value should be == 100000
   *
   * This method is not callble if this instance of IdleToken is a risk adjusted instance
   * NOTE: this method can be paused
   *
   * @param _newAllocations : array with new allocations in percentage
   * @return : whether has rebalanced or not
   * @return avgApr : the new avg apr after rebalance
   */
  function openRebalance(uint256[] calldata _newAllocations)
    external whenNotPaused
    returns (bool, uint256 avgApr) {
      require(!isRiskAdjusted, "IDLE:NOT_ALLOWED");
      uint256 initialAPR = _getAvgAPR();
      // Validate and update rebalancer allocations
      _setAllocations(_newAllocations);
      bool hasRebalanced = _rebalance();
      uint256 newAprAfterRebalance = _getAvgAPR();
      require(newAprAfterRebalance > initialAPR, "IDLE:NOT_IMPROV");
      return (hasRebalanced, newAprAfterRebalance);
  }

  // internal
  /**
   * Get current idleToken price based on net asset value and totalSupply
   *
   * @return price: value of 1 idleToken in underlying
   */
  function _tokenPrice() internal view returns (uint256 price) {
    uint256 totSupply = totalSupply();
    if (totSupply == 0) {
      return 10**(tokenDecimals);
    }

    address currToken;
    uint256 totNav = IERC20(token).balanceOf(address(this)).mul(ONE_18); // eventual underlying unlent balance

    for (uint256 i = 0; i < allAvailableTokens.length; i++) {
      currToken = allAvailableTokens[i];
      totNav = totNav.add(
        // NAV = price * poolSupply
        ILendingProtocol(protocolWrappers[currToken]).getPriceInToken().mul(
          IERC20(currToken).balanceOf(address(this))
        )
      );
    }

    price = totNav.div(totSupply); // idleToken price in token wei
  }

  /**
   * Dynamic allocate all the pool across different lending protocols if needed
   *
   * NOTE: this method can be paused
   *
   * @return : whether has rebalanced or not
   */
  function _rebalance()
    internal whenNotPaused
    returns (bool) {
      // check if we need to rebalance by looking at the last allocations submitted by rebalancer
      uint256[] memory rebalancerLastAllocations = lastRebalancerAllocations;
      bool areAllocationsEqual = rebalancerLastAllocations.length == lastAllocations.length;
      if (areAllocationsEqual) {
        for (uint256 i = 0; i < lastAllocations.length || !areAllocationsEqual; i++) {
          if (lastAllocations[i] != rebalancerLastAllocations[i]) {
            areAllocationsEqual = false;
            break;
          }
        }
      }

      uint256 balance = IERC20(token).balanceOf(address(this));
      uint256 maxUnlentBalance;

      if (areAllocationsEqual && balance == 0) {
        return false;
      }

      if (balance > 0) {
        maxUnlentBalance = _getCurrentPoolValue().mul(maxUnlentPerc).div(FULL_ALLOC);
        if (lastAllocations.length == 0) {
          // set in storage
          lastAllocations = rebalancerLastAllocations;
        }

        if (balance > maxUnlentBalance) {
          // mint the difference
          _mintWithAmounts(allAvailableTokens, _amountsFromAllocations(rebalancerLastAllocations, balance.sub(maxUnlentBalance)));
        }
      }

      if (areAllocationsEqual) {
        return false;
      }

      // Instead of redeeming everything during rebalance we redeem and mint only what needs
      // to be reallocated
      // get current allocations in underlying (it does not count unlent underlying)
      (address[] memory tokenAddresses, uint256[] memory amounts, uint256 totalInUnderlying) = _getCurrentAllocations();

      if (balance == 0 && maxUnlentPerc > 0) {
        totalInUnderlying = totalInUnderlying.sub(_getCurrentPoolValue().mul(maxUnlentPerc).div(FULL_ALLOC));
      }
      // calculate new allocations given the total (not counting unlent balance)
      uint256[] memory newAmounts = _amountsFromAllocations(rebalancerLastAllocations, totalInUnderlying);
      (uint256[] memory toMintAllocations, uint256 totalToMint, bool lowLiquidity) = _redeemAllNeeded(tokenAddresses, amounts, newAmounts);
      // if some protocol has liquidity that we should redeem, we do not update
      // lastAllocations to force another rebalance next time
      if (!lowLiquidity) {
        // Update lastAllocations with rebalancerLastAllocations
        delete lastAllocations;
        lastAllocations = rebalancerLastAllocations;
      }

      // Do not count `maxUnlentPerc` from balance
      if (maxUnlentBalance == 0 && maxUnlentPerc > 0) {
        maxUnlentBalance = _getCurrentPoolValue().mul(maxUnlentPerc).div(FULL_ALLOC);
      }

      uint256 totalRedeemd = IERC20(token).balanceOf(address(this));

      if (totalRedeemd <= maxUnlentBalance) {
        return false;
      }

      // Do not mint directly using toMintAllocations check with totalRedeemd
      uint256[] memory tempAllocations = new uint256[](toMintAllocations.length);
      for (uint256 i = 0; i < toMintAllocations.length; i++) {
        // Calc what would have been the correct allocations percentage if all was available
        tempAllocations[i] = toMintAllocations[i].mul(FULL_ALLOC).div(totalToMint);
      }

      uint256[] memory partialAmounts = _amountsFromAllocations(tempAllocations, totalRedeemd.sub(maxUnlentBalance));
      _mintWithAmounts(allAvailableTokens, partialAmounts);

      emit Rebalance(msg.sender, totalInUnderlying.add(maxUnlentBalance));

      return true; // hasRebalanced
  }

  /**
   * Redeem unclaimed governance tokens and update governance global index and user index if needed
   * if called during redeem it will send all gov tokens accrued by a user to the user
   *
   * @param _to : user address
   * @param _skipRedeem : flag to choose whether to send gov tokens to user or not
   */
  function _redeemGovTokens(address _to, bool _skipRedeem) internal {
    if (govTokens.length == 0) {
      return;
    }
    uint256 supply = totalSupply();
    uint256 usrBal = balanceOf(_to);
    address govToken;

    for (uint256 i = 0; i < govTokens.length; i++) {
      govToken = govTokens[i];

      if (supply > 0) {
        if (!_skipRedeem) {
          _redeemGovTokensFromProtocol(govToken);
        }

        // get current gov token balance
        uint256 govBal = IERC20(govToken).balanceOf(address(this));
        if (govBal > 0) {
          // update global index with ratio of govTokens per idleToken
          govTokensIndexes[govToken] = govTokensIndexes[govToken].add(
            // check how much gov tokens for each idleToken we gained since last update
            govBal.sub(govTokensLastBalances[govToken]).mul(ONE_18).div(supply)
          );
          // update global var with current govToken balance
          govTokensLastBalances[govToken] = govBal;
        }
      }

      if (usrBal > 0) {
        if (!_skipRedeem) {
          uint256 usrIndex = usersGovTokensIndexes[govToken][_to];
          // update current user index for this gov token
          usersGovTokensIndexes[govToken][_to] = govTokensIndexes[govToken];
          // check if user has accrued something
          uint256 delta = govTokensIndexes[govToken].sub(usrIndex);
          if (delta == 0) { continue; }
          uint256 share = usrBal.mul(delta).div(ONE_18);
          uint256 bal = IERC20(govToken).balanceOf(address(this));
          // To avoid rounding issue
          if (share > bal) {
            share = bal;
          }

          uint256 feeDue;
          // no fee for IDLE governance token
          if (feeAddress != address(0) && fee > 0 && govToken != IDLE) {
            feeDue = share.mul(fee).div(FULL_ALLOC);
            // Transfer gov token fee to feeAddress
            IERC20(govToken).safeTransfer(feeAddress, feeDue);
          }
          // Transfer gov token to user
          IERC20(govToken).safeTransfer(_to, share.sub(feeDue));
          // Update last balance
          govTokensLastBalances[govToken] = IERC20(govToken).balanceOf(address(this));
        }
      } else {
        // save current index for this gov token
        usersGovTokensIndexes[govToken][_to] = govTokensIndexes[govToken];
      }
    }
  }

  /**
   * Redeem a specific gov token
   *
   * @param _govToken : address of the gov token to redeem
   */
  function _redeemGovTokensFromProtocol(address _govToken) internal {
    // In case new Gov tokens will be supported this should be updated
    if (_govToken == COMP || _govToken == IDLE) {
      address[] memory holders = new address[](1);
      address[] memory tokens = new address[](1);
      holders[0] = address(this);

      if (_govToken == IDLE) {
        tokens[0] = address(this);
        IdleController(idleController).claimIdle(holders, tokens);
        return;
      }
      if (cToken != address(0)) {
        tokens[0] = cToken;
        Comptroller(CERC20(cToken).comptroller()).claimComp(holders, tokens, false, true);
      }
    }
  }

  /**
   * Update userNoFeeQty of a user on transfers and eventually avg price paid for each idle token
   * userAvgPrice do not consider tokens bought when there was no fee
   *
   * @param from : user address of the sender || address(0) on mint
   * @param usr : user that should have balance update
   * @param qty : new amount deposited / transferred, in idleToken
   * @param price : curr idleToken price in underlying
   */
  function _updateUserFeeInfoTransfer(address from, address usr, uint256 qty, uint256 price) private {
    uint256 userNoFeeQtyFrom = userNoFeeQty[from];
    if (userNoFeeQtyFrom >= qty) {
      userNoFeeQty[from] = userNoFeeQtyFrom.sub(qty);
      userNoFeeQty[usr] = userNoFeeQty[usr].add(qty);
      // No avg price update needed
      return;
    }
    // nofeeQty not counted
    uint256 oldBalance = balanceOf(usr).sub(qty).sub(userNoFeeQty[usr]);
    uint256 newQty = qty.sub(userNoFeeQtyFrom);
    // (avgPrice * oldBalance) + (currPrice * newQty)) / totBalance
    userAvgPrices[usr] = userAvgPrices[usr].mul(oldBalance).add(price.mul(newQty)).div(oldBalance.add(newQty));
    // update no fee quantities
    userNoFeeQty[from] = 0;
    userNoFeeQty[usr] = userNoFeeQty[usr].add(userNoFeeQtyFrom);
  }

  /**
   * Update userNoFeeQty of a user on deposits and eventually avg price paid for each idle token
   * userAvgPrice do not consider tokens bought when there was no fee
   *
   * @param usr : user that should have balance update
   * @param qty : new amount deposited / transferred, in idleToken
   * @param price : curr idleToken price in underlying
   */
  function _updateUserFeeInfo(address usr, uint256 qty, uint256 price) private {
    if (fee == 0) { // on deposits with 0 fee
      userNoFeeQty[usr] = userNoFeeQty[usr].add(qty);
      return;
    }
    // on deposits with fee
    uint256 totBalance = balanceOf(usr).sub(userNoFeeQty[usr]);
    // noFeeQty should not be counted here
    // (avgPrice * oldBalance) + (currPrice * newQty)) / totBalance
    userAvgPrices[usr] = userAvgPrices[usr].mul(totBalance.sub(qty)).add(price.mul(qty)).div(totBalance);
  }

  /**
   * Calculate fee and send them to feeAddress
   *
   * @param amount : in idleTokens
   * @param redeemed : in underlying
   * @param currPrice : current idleToken price
   * @return : net value in underlying
   */
  function _getFee(uint256 amount, uint256 redeemed, uint256 currPrice) internal returns (uint256) {
    uint256 noFeeQty = userNoFeeQty[msg.sender]; // in idleTokens
    bool hasEnoughNoFeeQty = noFeeQty >= amount;

    if (fee == 0 || hasEnoughNoFeeQty) {
      userNoFeeQty[msg.sender] = hasEnoughNoFeeQty ? noFeeQty.sub(amount) : 0;
      return redeemed;
    }
    userNoFeeQty[msg.sender] = 0;
    uint256 elegibleGains = currPrice < userAvgPrices[msg.sender] ? 0 :
      amount.sub(noFeeQty).mul(currPrice.sub(userAvgPrices[msg.sender])).div(ONE_18); // in underlyings
    uint256 feeDue = elegibleGains.mul(fee).div(FULL_ALLOC);
    IERC20(token).safeTransfer(feeAddress, feeDue);
    return redeemed.sub(feeDue);
  }

  /**
   * Mint specific amounts of protocols tokens
   *
   * @param tokenAddresses : array of protocol tokens
   * @param protocolAmounts : array of amounts to be minted
   * @return : net value in underlying
   */
  function _mintWithAmounts(address[] memory tokenAddresses, uint256[] memory protocolAmounts) internal {
    // mint for each protocol and update currentTokensUsed
    uint256 currAmount;
    address protWrapper;

    for (uint256 i = 0; i < protocolAmounts.length; i++) {
      currAmount = protocolAmounts[i];
      if (currAmount == 0) {
        continue;
      }
      protWrapper = protocolWrappers[tokenAddresses[i]];
      // Transfer _amount underlying token (eg. DAI) to protWrapper
      IERC20(token).safeTransfer(protWrapper, currAmount);
      ILendingProtocol(protWrapper).mint();
    }
  }

  /**
   * Calculate amounts from percentage allocations (100000 => 100%)
   *
   * @param allocations : array of protocol allocations in percentage
   * @param total : total amount
   * @return : array with amounts
   */
  function _amountsFromAllocations(uint256[] memory allocations, uint256 total)
    internal pure returns (uint256[] memory newAmounts) {
    newAmounts = new uint256[](allocations.length);
    uint256 currBalance;
    uint256 allocatedBalance;

    for (uint256 i = 0; i < allocations.length; i++) {
      if (i == allocations.length - 1) {
        newAmounts[i] = total.sub(allocatedBalance);
      } else {
        currBalance = total.mul(allocations[i]).div(FULL_ALLOC);
        allocatedBalance = allocatedBalance.add(currBalance);
        newAmounts[i] = currBalance;
      }
    }
    return newAmounts;
  }

  /**
   * Redeem all underlying needed from each protocol
   *
   * @param tokenAddresses : array of protocol tokens addresses
   * @param amounts : array with current allocations in underlying
   * @param newAmounts : array with new allocations in underlying
   * @return toMintAllocations : array with amounts to be minted
   * @return totalToMint : total amount that needs to be minted
   */
  function _redeemAllNeeded(
    address[] memory tokenAddresses,
    uint256[] memory amounts,
    uint256[] memory newAmounts
    ) internal returns (
      uint256[] memory toMintAllocations,
      uint256 totalToMint,
      bool lowLiquidity
    ) {
    toMintAllocations = new uint256[](amounts.length);
    ILendingProtocol protocol;
    uint256 currAmount;
    uint256 newAmount;
    address currToken;
    // check the difference between amounts and newAmounts
    for (uint256 i = 0; i < amounts.length; i++) {
      currToken = tokenAddresses[i];
      newAmount = newAmounts[i];
      currAmount = amounts[i];
      protocol = ILendingProtocol(protocolWrappers[currToken]);
      if (currAmount > newAmount) {
        uint256 toRedeem = currAmount.sub(newAmount);
        uint256 availableLiquidity = protocol.availableLiquidity();
        if (availableLiquidity < toRedeem) {
          lowLiquidity = true;
          toRedeem = availableLiquidity;
        }
        // redeem the difference
        _redeemProtocolTokens(
          currToken,
          // convert amount from underlying to protocol token
          toRedeem.mul(ONE_18).div(protocol.getPriceInToken()),
          address(this) // tokens are now in this contract
        );
      } else {
        toMintAllocations[i] = newAmount.sub(currAmount);
        totalToMint = totalToMint.add(toMintAllocations[i]);
      }
    }
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return tokenAddresses : array with all token addresses used,
   *                          eg [cTokenAddress, iTokenAddress]
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total AUM in underlying
   */
  function _getCurrentAllocations() internal view
    returns (address[] memory tokenAddresses, uint256[] memory amounts, uint256 total) {
      // Get balance of every protocol implemented
      tokenAddresses = new address[](allAvailableTokens.length);
      amounts = new uint256[](allAvailableTokens.length);

      address currentToken;
      uint256 currTokenPrice;

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currentToken = allAvailableTokens[i];
        tokenAddresses[i] = currentToken;
        currTokenPrice = ILendingProtocol(protocolWrappers[currentToken]).getPriceInToken();
        amounts[i] = currTokenPrice.mul(
          IERC20(currentToken).balanceOf(address(this))
        ).div(ONE_18);
        total = total.add(amounts[i]);
      }

      // return addresses and respective amounts in underlying
      return (tokenAddresses, amounts, total);
  }

  /**
   * Get the current pool value in underlying
   *
   * @return total : total AUM in underlying
   */
  function _getCurrentPoolValue() internal view
    returns (uint256 total) {
      // Get balance of every protocol implemented
      address currentToken;

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currentToken = allAvailableTokens[i];
        total = total.add(ILendingProtocol(protocolWrappers[currentToken]).getPriceInToken().mul(
          IERC20(currentToken).balanceOf(address(this))
        ).div(ONE_18));
      }

      // add unlent balance
      total = total.add(IERC20(token).balanceOf(address(this)));
  }

  /**
   * Check that no mint has been made in the same block from the same EOA
   */
  function _checkMintRedeemSameTx() private view {
    require(keccak256(abi.encodePacked(tx.origin, block.number)) != _minterBlock, "IDLE:REENTR");
  }

  // ILendingProtocols calls
  /**
   * Redeem underlying tokens through protocol wrapper
   *
   * @param _amount : amount of `_token` to redeem
   * @param _token : protocol token address
   * @param _account : should be msg.sender when rebalancing and final user when redeeming
   * @return tokens : new tokens minted
   */
  function _redeemProtocolTokens(address _token, uint256 _amount, address _account)
    internal
    returns (uint256 tokens) {
      if (_amount == 0) {
        return tokens;
      }
      // Transfer _amount of _protocolToken (eg. cDAI) to _wrapperAddr
      IERC20(_token).safeTransfer(protocolWrappers[_token], _amount);
      tokens = ILendingProtocol(protocolWrappers[_token]).redeem(_account);
  }
}
