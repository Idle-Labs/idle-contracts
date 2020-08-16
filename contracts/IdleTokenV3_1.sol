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
import "./interfaces/IIdleRebalancerV3.sol";

import "./interfaces/Comptroller.sol";
import "./interfaces/CERC20.sol";

import "./GST2ConsumerV2.sol";

contract IdleTokenV3_1 is Initializable, ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable, IIdleTokenV3_1, GST2ConsumerV2 {
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

  /**
   * @dev constructor, initialize some variables, mainly addresses of other contracts
   *
   * @param _name : IdleToken name
   * @param _symbol : IdleToken symbol
   * @param _token : underlying token address
   * @param _iToken : iToken address
   * @param _rebalancer : Idle Rebalancer address
   */
  function initialize(
    string memory _name, // eg. IdleDAI
    string memory _symbol, // eg. IDLEDAI
    address _token,
    address _iToken,
    address _cToken,
    address _rebalancer
  )
    public initializer
     {
      require(_rebalancer != address(0), "IDLE:IS_0");
      // Initialize inherited contracts
      ERC20Detailed.initialize(_name, _symbol, 18);
      Ownable.initialize(msg.sender);
      Pausable.initialize(msg.sender);
      ReentrancyGuard.initialize();
      GST2ConsumerV2.initialize();
      // Initialize storage variables
      maxUnlentPerc = 1000;

      token = _token;
      tokenDecimals = ERC20Detailed(_token).decimals();
      iToken = _iToken;
      cToken = _cToken;
      rebalancer = _rebalancer;
  }

  // During a black swan event is possible that iToken price decreases instead of increasing,
  // with the consequence of lowering the IdleToken price. To mitigate this we implemented a
  // check on the iToken price that prevents users from minting cheap IdleTokens or rebalancing
  // the pool in this specific case. The redeemIdleToken won't be paused but the rebalance process
  // won't be triggered in this case.
  modifier whenITokenPriceHasNotDecreased() {
    if (iToken != address(0)) {
      uint256 iTokenPrice = iERC20Fulcrum(iToken).tokenPrice();
      require(
        iTokenPrice >= lastITokenPrice,
        "IDLE:ITOKEN_PRICE"
      );

      _;

      if (iTokenPrice > lastITokenPrice) {
        lastITokenPrice = iTokenPrice;
      }
    } else {
      _;
    }
  }

  // onlyOwner
  /**
   * It allows owner to modify allAvailableTokens array in case of emergency
   * ie if a bug on a interest bearing token is discovered and reset protocolWrappers
   * associated with those tokens.
   *
   * @param protocolTokens : array of protocolTokens addresses (eg [cDAI, iDAI, ...])
   * @param wrappers : array of wrapper addresses (eg [IdleCompound, IdleFulcrum, ...])
   */
  function setAllAvailableTokensAndWrappers(
    address[] calldata protocolTokens,
    address[] calldata wrappers
  ) external onlyOwner {
    require(protocolTokens.length == wrappers.length, "IDLE:LEN_DIFF");

    for (uint256 i = 0; i < protocolTokens.length; i++) {
      require(protocolTokens[i] != address(0) && wrappers[i] != address(0), "IDLE:IS_0");
      protocolWrappers[protocolTokens[i]] = wrappers[i];
    }
    allAvailableTokens = protocolTokens;
  }

  /**
   * It allows owner to set the _iToken address
   *
   * @param _iToken : new _iToken address (can be address(0) which means disabled)
   */
  function setIToken(address _iToken)
    external onlyOwner {
      iToken = _iToken;
  }

  /**
   * It allows owner to set gov tokens array
   * In case of any errors gov distribution can be paused by passing an empty array
   *
   * @param _newGovTokens : array of governance token addresses
   */
  function setGovTokens(
    address[] calldata _newGovTokens
  ) external onlyOwner {
    govTokens = _newGovTokens;
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
   * It allows owner to set the fee address
   *
   * @param _feeAddress : fee address
   */
  function setFeeAddress(address _feeAddress)
    external onlyOwner {
      require(_feeAddress != address(0), "IDLE:IS_0");
      feeAddress = _feeAddress;
  }

  // view
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
   * Get current avg APR of this IdleToken (not counting gov tokens APR and unlent perc)
   *
   * @return avgApr: current weighted avg apr
   */
  function getAvgAPR()
    external view
    returns (uint256 avgApr) {
      (, uint256[] memory amounts, uint256 total) = _getCurrentAllocations();
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        if (amounts[i] == 0) {
          continue;
        }
        // avgApr = avgApr.add(currApr.mul(weight).div(ONE_18))
        avgApr = avgApr.add(
          ILendingProtocol(protocolWrappers[allAvailableTokens[i]]).getAPR().mul(
            amounts[i]
          )
        );
      }

      avgApr = avgApr.div(total);
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
    _updateUserFeeInfo(recipient, amount, userAvgPrices[sender]);
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
    _updateUserFeeInfo(recipient, amount, userAvgPrices[msg.sender]);
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
    external nonReentrant whenNotPaused whenITokenPriceHasNotDecreased
    returns (uint256 mintedTokens) {
    _minterBlock = keccak256(abi.encodePacked(tx.origin, block.number));
    _redeemGovTokens(msg.sender, true);
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
   * NOTE: If the contract is paused or iToken price has decreased one can still redeem but no rebalance happens.
   * NOTE 2: If iToken price has decresed one should not redeem (but can do it) otherwise he would capitalize the loss.
   *         Ideally one should wait until the black swan event is terminated
   *
   * @param _amount : amount of IdleTokens to be burned
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleToken(uint256 _amount)
    external nonReentrant
    returns (uint256 redeemedTokens) {
      // Check that no mint has been made in the same block from the same EOA
      require(keccak256(abi.encodePacked(tx.origin, block.number)) != _minterBlock, "IDLE:REENTR");
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
    external nonReentrant {
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
    internal whenNotPaused whenITokenPriceHasNotDecreased
    returns (bool) {
      // check if we need to rebalance by looking at the allocations in rebalancer contract
      uint256[] memory rebalancerLastAllocations = IIdleRebalancerV3(rebalancer).getAllocations();
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
        maxUnlentBalance = _getCurrentPoolValue().mul(maxUnlentPerc).div(100000);
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
        totalInUnderlying = totalInUnderlying.sub(_getCurrentPoolValue().mul(maxUnlentPerc).div(100000));
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
        maxUnlentBalance = _getCurrentPoolValue().mul(maxUnlentPerc).div(100000);
      }

      uint256 totalRedeemd = IERC20(token).balanceOf(address(this));

      if (totalRedeemd <= maxUnlentBalance) {
        return false;
      }

      // Do not mint directly using toMintAllocations check with totalRedeemd
      uint256[] memory tempAllocations = new uint256[](toMintAllocations.length);
      for (uint256 i = 0; i < toMintAllocations.length; i++) {
        // Calc what would have been the correct allocations percentage if all was available
        tempAllocations[i] = toMintAllocations[i].mul(100000).div(totalToMint);
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
          // redeem gov tokens for this contract with the corresponding lending protocol wrapper
          if (i == 0) {
            address[] memory holders = new address[](1);
            address[] memory cTokens = new address[](1);
            holders[0] = address(this);
            cTokens[0] = cToken;
            Comptroller(CERC20(allAvailableTokens[0]).comptroller()).claimComp(holders, cTokens, false, true);
          }
        }
        // In case new Gov tokens will be supported this should be updated

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
          if (feeAddress != address(0) && fee > 0) {
            feeDue = share.mul(fee).div(100000);
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
   * Update avg price paid for each idle token of a user
   *
   * @param usr : user that should have balance update
   * @param qty : new amount deposited / transferred, in idleToken
   * @param price : curr idleToken price in underlying
   */
  function _updateUserFeeInfo(address usr, uint256 qty, uint256 price) internal {
    if (fee == 0) {
      userNoFeeQty[usr] = userNoFeeQty[usr].add(qty);
      return;
    }

    uint256 totBalance = balanceOf(usr).sub(userNoFeeQty[usr]);
    uint256 oldAvgPrice = userAvgPrices[usr];
    uint256 oldBalance = totBalance.sub(qty);
    userAvgPrices[usr] = oldAvgPrice.mul(oldBalance).div(totBalance).add(price.mul(qty).div(totBalance));
  }

  /**
   * Calculate fee and send them to feeAddress
   *
   * @param amount : in idleTokens
   * @param redeemed : in underlying
   * @return : net value in underlying
   */
  function _getFee(uint256 amount, uint256 redeemed, uint256 currPrice) internal returns (uint256) {
    if (fee > 0 && feeAddress != address(0)) {
      uint256 noFeeQty = userNoFeeQty[msg.sender];
      if (noFeeQty > 0 && noFeeQty > amount) {
        noFeeQty = amount;
      }

      uint256 totalValPaid = noFeeQty.mul(currPrice).add(amount.sub(noFeeQty).mul(userAvgPrices[msg.sender])).div(ONE_18);
      if (redeemed < totalValPaid) {
        return redeemed;
      }
      uint256 feeDue = redeemed.sub(totalValPaid).mul(fee).div(100000);
      IERC20(token).safeTransfer(feeAddress, feeDue);
      userNoFeeQty[msg.sender] = userNoFeeQty[msg.sender].sub(noFeeQty);
      return redeemed.sub(feeDue);
    }

    userNoFeeQty[msg.sender] = balanceOf(msg.sender).sub(amount);
    return redeemed;
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
        currBalance = total.mul(allocations[i]).div(100000);
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
