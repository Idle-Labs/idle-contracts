/**
 * @title: Idle Token Governance main contract
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

import "../interfaces/iERC20Fulcrum.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IGovToken.sol";
import "../interfaces/IIdleTokenV3_1.sol";
import "../interfaces/IERC3156FlashBorrower.sol";
import "../interfaces/IAaveIncentivesController.sol";

import "../interfaces/Comptroller.sol";
import "../interfaces/CERC20.sol";
import "../interfaces/AToken.sol";
import "../interfaces/IdleController.sol";
import "../interfaces/PriceOracle.sol";
import "../interfaces/IIdleTokenHelper.sol";

import "../GST2ConsumerV2.sol";

contract IdleTokenV3_1NoConst is Initializable, ERC20, ERC20Detailed, ReentrancyGuard, Ownable, Pausable, IIdleTokenV3_1, GST2ConsumerV2 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 internal ONE_18 = 10**18;
  // State variables
  // eg. DAI address
  address public token;
  // eg. iDAI address
  address internal iToken;
  // eg. cDAI address
  address internal cToken;
  // Idle rebalancer current implementation address
  address public rebalancer;
  // Address collecting underlying fees
  address public feeAddress;
  // Last iToken price, used to pause contract in case of a black swan event
  uint256 public lastITokenPrice;
  // eg. 18 for DAI
  uint256 internal tokenDecimals;
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
  mapping(address => uint256) internal userNoFeeQty;
  // variable used for avoid the call of mint and redeem in the same tx
  bytes32 internal _minterBlock;

  // Events
  event Rebalance(address _rebalancer, uint256 _amount);
  event Referral(uint256 _amount, address _ref);

  // ########## IdleToken V4_1 updates
  // Idle governance token
  address public IDLE = address(0x875773784Af8135eA0ef43b5a374AaD105c5D39e);
  // Compound governance token
  address public COMP = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
  uint256 internal constant FULL_ALLOC = 100000;

  // Idle distribution controller
  address public idleController = address(0x275DA8e61ea8E02d51EDd8d0DC5c0E62b4CDB0BE);
  // oracle used for calculating the avgAPR with gov tokens
  address public oracle;
  // eg cDAI -> COMP
  mapping(address => address) internal protocolTokenToGov;
  // Whether openRebalance is enabled or not
  bool public isRiskAdjusted;
  // last allocations submitted by rebalancer
  uint256[] internal lastRebalancerAllocations;

  // ########## IdleToken V5 updates
  // Fee for flash loan
  uint256 public flashLoanFee;
  // IdleToken helper address
  address public tokenHelper;

  /**
  * @dev Emitted on flashLoan()
  * @param target The address of the flash loan receiver contract
  * @param initiator The address initiating the flash loan
  * @param amount The amount flash borrowed
  * @param premium The flash loan fee
  **/
  event FlashLoan(
    address indexed target,
    address indexed initiator,
    uint256 amount,
    uint256 premium
  );

  // Addresses for stkAAVE distribution from Aave
  address public stkAAVE = address(0x4da27a545c0c5B758a6BA100e3a049001de870f5);
  address internal aToken;
  // ########## End IdleToken V5 updates

  // ####################################################
  // ################# INIT METHODS #####################
  // ####################################################

  function _initV1(
    string memory _name, // eg. IdleDAI
    string memory _symbol, // eg. IDLEDAI
    address _token
  ) public initializer {
    // copied from old initialize() method removed at commit 04e29bd6f9282ef5677edc16570918da1a72dd3a
    // Initialize inherited contracts
    ERC20Detailed.initialize(_name, _symbol, 18);
    Ownable.initialize(msg.sender);
    Pausable.initialize(msg.sender);
    ReentrancyGuard.initialize();
    // Initialize storage variables
    maxUnlentPerc = 1000;
    token = _token;
    tokenDecimals = ERC20Detailed(_token).decimals();
    // end of old initialize method
    oracle = address(0xB5A8f07dD4c3D315869405d702ee8F6EA695E8C5);
    feeAddress = address(0xBecC659Bfc6EDcA552fa1A67451cC6b38a0108E4);
    rebalancer = address(0xB3C8e5534F0063545CBbb7Ce86854Bf42dB8872B);
    fee = 10000;
    iToken = address(0);
  }

  /**
   * It allows owner to manually initialize new contract implementation which supports IDLE distribution
   *
   * @param _newGovTokens : array of gov token addresses
   * @param _protocolTokens : array of protocol tokens supported
   * @param _wrappers : array of wrappers for protocol tokens
   * @param _lastRebalancerAllocations : array of allocations
   * @param _isRiskAdjusted : flag whether is risk adjusted or not
   */
  function manualInitialize(
    address[] calldata _newGovTokens,
    address[] calldata _protocolTokens,
    address[] calldata _wrappers,
    uint256[] calldata _lastRebalancerAllocations,
    bool _isRiskAdjusted,
    address _cToken
  ) external onlyOwner {
    cToken = _cToken;
    isRiskAdjusted = _isRiskAdjusted;
    // set all available tokens and set the protocolWrappers mapping in the for loop
    allAvailableTokens = _protocolTokens;
    // same as setGovTokens, copied to avoid make the method public and save on bytecode size
    govTokens = _newGovTokens;
    // set protocol token to gov token mapping
    for (uint256 i = 0; i < _protocolTokens.length; i++) {
      protocolWrappers[_protocolTokens[i]] = _wrappers[i];
      if (i < _newGovTokens.length) {
        if (_newGovTokens[i] == IDLE) { continue; }
        protocolTokenToGov[_protocolTokens[i]] = _newGovTokens[i];
      }
    }

    lastRebalancerAllocations = _lastRebalancerAllocations;
    lastAllocations = _lastRebalancerAllocations;
    // Idle multisig
    addPauser(address(0xaDa343Cb6820F4f5001749892f6CAA9920129F2A));
    // Remove pause ability from msg.sender
    // renouncePauser();
  }

  // ####################################################
  // ################# INIT METHODS #####################
  // ####################################################

  function _init(address _tokenHelper, address _aToken, address _newOracle) external {
    require(tokenHelper == address(0), 'DONE');
    tokenHelper = _tokenHelper;
    flashLoanFee = 90;
    aToken = _aToken;
    oracle = _newOracle;
  }

  // onlyOwner
  /**
   * It allows owner to modify allAvailableTokens array in case of emergency
   * ie if a bug on a interest bearing token is discovered and reset protocolWrappers
   * associated with those tokens.
   *
   * @param protocolTokens : array of protocolTokens addresses (eg [cDAI, iDAI, ...])
   * @param wrappers : array of wrapper addresses (eg [IdleCompound, IdleFulcrum, ...])
   * @param _newGovTokens : array of governance token addresses
   * @param _newGovTokensEqualLen : array of governance token addresses for each
   *  protocolToken (addr0 should be used for protocols with no govToken)
   */
  function setAllAvailableTokensAndWrappers(
    address[] calldata protocolTokens,
    address[] calldata wrappers,
    address[] calldata _newGovTokens,
    address[] calldata _newGovTokensEqualLen
  ) external onlyOwner {
    require(protocolTokens.length == wrappers.length, "LEN");
    require(_newGovTokensEqualLen.length >= protocolTokens.length, '!>=');

    govTokens = _newGovTokens;

    address newGov;
    address protToken;
    for (uint256 i = 0; i < protocolTokens.length; i++) {
      protToken = protocolTokens[i];
      require(protToken != address(0) && wrappers[i] != address(0), "0");
      protocolWrappers[protToken] = wrappers[i];

      // set protocol token to gov token mapping
      newGov = _newGovTokensEqualLen[i];
      if (newGov != IDLE) {
        protocolTokenToGov[protToken] = newGov;
      }
    }

    allAvailableTokens = protocolTokens;
  }

  /**
   * It allows owner to set the flash loan fee
   *
   * @param _flashFee : new flash loan fee. Max is FULL_ALLOC
   */
  function setFlashLoanFee(uint256 _flashFee)
    external onlyOwner {
      require((flashLoanFee = _flashFee) < FULL_ALLOC, "<");
  }

  /**
   * It allows owner to set the cToken address
   *
   * @param _cToken : new cToken address
   */
  function setCToken(address _cToken)
    external onlyOwner {
      require((cToken = _cToken) != address(0), "0");
  }

  /**
   * It allows owner to set the aToken address
   *
   * @param _aToken : new aToken address
   */
  function setAToken(address _aToken)
    external onlyOwner {
      require((aToken = _aToken) != address(0), "0");
  }

  /**
   * It allows owner to set the IdleRebalancerV3_1 address
   *
   * @param _rebalancer : new IdleRebalancerV3_1 address
   */
  function setRebalancer(address _rebalancer)
    external onlyOwner {
      require((rebalancer = _rebalancer) != address(0), "0");
  }

  /**
   * It allows owner to set the fee (1000 == 10% of gained interest)
   *
   * @param _fee : fee amount where 100000 is 100%, max settable is 10%
   */
  function setFee(uint256 _fee)
    external onlyOwner {
      // 100000 == 100% -> 10000 == 10%
      require((fee = _fee) <= FULL_ALLOC / 10, "HIGH");
  }

  /**
   * It allows owner to set the fee address
   *
   * @param _feeAddress : fee address
   */
  function setFeeAddress(address _feeAddress)
    external onlyOwner {
      require((feeAddress = _feeAddress) != address(0), "0");
  }

  /**
   * It allows owner to set the oracle address for getting avgAPR
   *
   * @param _oracle : new oracle address
   */
  function setOracleAddress(address _oracle)
    external onlyOwner {
      require((oracle = _oracle) != address(0), "0");
  }

  /**
   * It allows owner to set the max unlent asset percentage (1000 == 1% of unlent asset max)
   *
   * @param _perc : max unlent perc where 100000 is 100%
   */
  function setMaxUnlentPerc(uint256 _perc)
    external onlyOwner {
      require((maxUnlentPerc = _perc) <= 100000, "HIGH");
  }

  /**
   * Used by Rebalancer to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 100000)
   */
  function setAllocations(uint256[] calldata _allocations) external {
    require(msg.sender == rebalancer || msg.sender == owner(), "!AUTH");
    _setAllocations(_allocations);
  }

  /**
   * Used by Rebalancer or in openRebalance to set the new allocations
   *
   * @param _allocations : array with allocations in percentages (100% => 100000)
   */
  function _setAllocations(uint256[] memory _allocations) internal {
    require(_allocations.length == allAvailableTokens.length, "LEN");
    uint256 total;
    for (uint256 i = 0; i < _allocations.length; i++) {
      total = total.add(_allocations[i]);
    }
    lastRebalancerAllocations = _allocations;
    require(total == FULL_ALLOC, "TOT");
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
  * Get currently used gov tokens
  *
  * @return : array of govTokens supported
  */
  function getGovTokens() external view returns (address[] memory) {
    return govTokens;
  }

  /**
  * Get currently used protocol tokens (cDAI, aDAI, ...)
  *
  * @return : array of protocol tokens supported
  */
  function getAllAvailableTokens() external view returns (address[] memory) {
    return allAvailableTokens;
  }

  /**
  * Get gov token associated to a protocol token eg protocolTokenToGov[cDAI] = COMP
  *
  * @return : address of the gov token
  */
  function getProtocolTokenToGov(address _protocolToken) external view returns (address) {
    return protocolTokenToGov[_protocolToken];
  }

  /**
   * IdleToken price for a user considering fees, in underlying
   * this is useful when you need to redeem exactly X underlying
   *
   * @return : price in underlying token counting fees for a specific user
   */
  function tokenPriceWithFee(address user)
    external view
    returns (uint256 priceWFee) {
      uint256 userAvgPrice = userAvgPrices[user];
      priceWFee = _tokenPrice();
      if (userAvgPrice != 0 && priceWFee > userAvgPrice) {
        priceWFee = priceWFee.mul(FULL_ALLOC).sub(fee.mul(priceWFee.sub(userAvgPrice))).div(FULL_ALLOC);
      }
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
    returns (address[] memory, uint256[] memory) {
    return IIdleTokenHelper(tokenHelper).getAPRs(address(this));
  }

  /**
   * Get current avg APR of this IdleToken
   *
   * @return avgApr: current weighted avg apr
   */
  function getAvgAPR()
    public view
    returns (uint256) {
    return IIdleTokenHelper(tokenHelper).getAPR(address(this), cToken, aToken);
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
      } else {
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
   *
   * @param _amount : amount of underlying token to be lended
   * @param : not used anymore
   * @param _referral : referral address
   * @return mintedTokens : amount of IdleTokens minted
   */
  function mintIdleToken(uint256 _amount, bool, address _referral)
    external nonReentrant whenNotPaused
    returns (uint256 mintedTokens) {
    _minterBlock = keccak256(abi.encodePacked(tx.origin, block.number));
    _redeemGovTokens(msg.sender);
    // Get current IdleToken price
    uint256 idlePrice = _tokenPrice();
    // transfer tokens to this contract
    IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

    mintedTokens = _amount.mul(ONE_18).div(idlePrice);
    _mint(msg.sender, mintedTokens);

    // Update avg price and user idx for each gov tokens
    _updateUserInfo(msg.sender, mintedTokens);
    _updateUserFeeInfo(msg.sender, mintedTokens, idlePrice);

    if (_referral != address(0)) {
      emit Referral(_amount, _referral);
    }
  }

  /**
   * Helper method for mintIdleToken, updates minter gov indexes and avg price
   *
   * @param _to : minter account
   * @param _mintedTokens : number of newly minted tokens
   */
  function _updateUserInfo(address _to, uint256 _mintedTokens) internal {
    address govToken;
    uint256 usrBal = balanceOf(_to);
    uint256 _usrIdx;

    for (uint256 i = 0; i < govTokens.length; i++) {
      govToken = govTokens[i];
      _usrIdx = usersGovTokensIndexes[govToken][_to];

      // calculate user idx
      usersGovTokensIndexes[govToken][_to] = _usrIdx.add(
        _mintedTokens.mul(govTokensIndexes[govToken].sub(_usrIdx)).div(usrBal)
      );
    }
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   *
   * @param _amount : amount of IdleTokens to be burned
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleToken(uint256 _amount)
    external
    returns (uint256) {
      return _redeemIdleToken(_amount, new bool[](govTokens.length));
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   * WARNING: if elements in the `_skipGovTokenRedeem` are set to `true` then the rewards will be GIFTED to the pool
   *
   * @param _amount : amount of IdleTokens to be burned
   * @param _skipGovTokenRedeem : array of flags whether to redeem or not specific gov tokens
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleTokenSkipGov(uint256 _amount, bool[] calldata _skipGovTokenRedeem)
    external
    returns (uint256) {
      return _redeemIdleToken(_amount, _skipGovTokenRedeem);
  }

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   *
   * @param _amount : amount of IdleTokens to be burned
   * @param _skipGovTokenRedeem : array of flag for redeeming or not gov tokens. Funds will be gifted to the pool
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function _redeemIdleToken(uint256 _amount, bool[] memory _skipGovTokenRedeem)
    internal nonReentrant
    returns (uint256 redeemedTokens) {
      _checkMintRedeemSameTx();
      _redeemGovTokensInternal(msg.sender, _skipGovTokenRedeem);

      if (_amount != 0) {
        uint256 price = _tokenPrice();
        uint256 valueToRedeem = _amount.mul(price).div(ONE_18);
        uint256 balanceUnderlying = _contractBalanceOf(token);

        if (valueToRedeem > balanceUnderlying) {
          redeemedTokens = _redeemHelper(_amount, balanceUnderlying);
        } else {
          redeemedTokens = valueToRedeem;
        }
        // get eventual performance fee
        redeemedTokens = _getFee(_amount, redeemedTokens, price);
        // burn idleTokens
        _burn(msg.sender, _amount);
        // send underlying minus fee to msg.sender
        _transferTokens(token, msg.sender, redeemedTokens);
      }
  }

  function _redeemHelper(uint256 _amount, uint256 _balanceUnderlying) internal returns (uint256 redeemedTokens) {
    address currToken;
    uint256 idleSupply = totalSupply();
    address[] memory _allAvailableTokens = allAvailableTokens;

    for (uint256 i = 0; i < _allAvailableTokens.length; i++) {
      currToken = _allAvailableTokens[i];
      redeemedTokens = redeemedTokens.add(
        _redeemProtocolTokens(
          currToken,
          // _amount * protocolPoolBalance / idleSupply
          _amount.mul(_contractBalanceOf(currToken)).div(idleSupply) // amount to redeem
        )
      );
    }
    // and get a portion of the eventual unlent balance
    redeemedTokens = redeemedTokens.add(_amount.mul(_balanceUnderlying).div(idleSupply));
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

      _redeemGovTokens(msg.sender);

      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        _transferTokens(allAvailableTokens[i], msg.sender, _amount.mul(_contractBalanceOf(allAvailableTokens[i])).div(totalSupply()));
      }
      // Get a portion of the eventual unlent balance
      _transferTokens(token, msg.sender, _amount.mul(_contractBalanceOf(token)).div(totalSupply()));
      _burn(msg.sender, _amount);
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
   * @dev The fee to be charged for a given loan.
   * @param _token The loan currency.
   * @param _amount The amount of tokens lent.
   * @return The amount of `token` to be charged for the loan, on top of the returned principal.
   */
  function flashFee(address _token, uint256 _amount) public view returns (uint256) {
    require(_token == token, '!EQ');
    return _amount.mul(flashLoanFee).div(FULL_ALLOC);
  }

  /**
   * @dev The amount of currency available to be lent.
   * @param _token The loan currency.
   * @return The amount of `token` that can be borrowed.
   */
  function maxFlashLoan(address _token) external view returns (uint256) {
    if (_token == token) {
      return _tokenPrice().mul(totalSupply()).div(ONE_18);
    }
  }

  /**
   * Allow any users to borrow funds inside a tx if they return the same amount + `flashLoanFee`
   *
   * @param _receiver : flash loan receiver, should have the IERC3156FlashBorrower interface
   * @param _token : used to check that the requested token is the correct one
   * @param _amount : amount of `token` to borrow
   * @param _params : params that should be passed to the _receiverAddress in the `executeOperation` call
   */
  function flashLoan(
    IERC3156FlashBorrower _receiver,
    address _token,
    uint256 _amount,
    bytes calldata _params
  ) external whenNotPaused nonReentrant returns (bool) {
    address receiverAddr = address(_receiver);
    require(_token == token, "!EQ");
    require(receiverAddr != address(0) && _amount > 0, "0");

    // get current underlying unlent balance
    uint256 balance = _contractBalanceOf(token);

    if (_amount > balance) {
      // Unlent is not enough, some funds needs to be redeemed from underlying protocols
      uint256 toRedeem = _amount.sub(balance);
      uint256 _toRedeemAux;
      address currToken;
      uint256 currBalanceUnderlying;
      uint256 availableLiquidity;
      uint256 redeemed;
      uint256 protocolTokenPrice;
      ILendingProtocol protocol;
      bool isEnough;
      bool haveWeInvestedEnough;

      // We cycle through interest bearing tokens currently in use (eg [cDAI, aDAI])
      // (ie we cycle each lending protocol where we have some funds currently deposited)
      for (uint256 i = 0; i < allAvailableTokens.length; i++) {
        currToken = allAvailableTokens[i];
        protocol = ILendingProtocol(protocolWrappers[currToken]);
        protocolTokenPrice = protocol.getPriceInToken();
        availableLiquidity = protocol.availableLiquidity();
        currBalanceUnderlying = _contractBalanceOf(currToken).mul(protocolTokenPrice).div(ONE_18);
        // We need to check:
        // 1. if Idle has invested enough in that protocol to cover the user request
        haveWeInvestedEnough = currBalanceUnderlying >= toRedeem;
        // 2. if the current lending protocol has enough liquidity available (not borrowed) to cover the user requested amount
        isEnough = availableLiquidity >= toRedeem;
        // in order to calculate `_toRedeemAux` which is the amount of underlying (eg DAI)
        // that we have to redeem from that lending protocol
        _toRedeemAux = haveWeInvestedEnough ?
          // if we lent enough and that protocol has enough liquidity we redeem `toRedeem` and we are done, otherwise we redeem `availableLiquidity`
          (isEnough ? toRedeem : availableLiquidity) :
          // if we did not lent enough and that liquidity is available then we redeem all what we deposited, otherwise we redeem `availableLiquidity`
          (currBalanceUnderlying <= availableLiquidity ? currBalanceUnderlying : availableLiquidity);

        // do the actual redeem on the lending protocol
        redeemed = _redeemProtocolTokens(
          currToken,
          // convert amount from underlying to protocol token
          _toRedeemAux.mul(ONE_18).div(protocolTokenPrice)
        );
        // tokens are now in this contract
        if (haveWeInvestedEnough && isEnough) {
          break;
        }

        toRedeem = toRedeem.sub(redeemed);
      }
    }

    require(_contractBalanceOf(token) >= _amount, "LOW");
    // transfer funds
    _transferTokens(token, receiverAddr, _amount);
    // calculate fee
    uint256 _flashFee = flashFee(token, _amount);
    // call _receiver `onFlashLoan`
    require(
      _receiver.onFlashLoan(msg.sender, token, _amount, _flashFee, _params) == keccak256("ERC3156FlashBorrower.onFlashLoan"),
      "EXEC"
    );
    // transfer _amount + _flashFee from _receiver
    IERC20(token).safeTransferFrom(receiverAddr, address(this), _amount.add(_flashFee));

    // Put underlyings in lending once again with rebalance
    _rebalance();

    emit FlashLoan(receiverAddr, msg.sender, _amount, _flashFee);

    return true;
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
    uint256 totNav = _contractBalanceOf(token).mul(ONE_18); // eventual underlying unlent balance
    address[] memory _allAvailableTokens = allAvailableTokens;
    for (uint256 i = 0; i < _allAvailableTokens.length; i++) {
      currToken = _allAvailableTokens[i];
      totNav = totNav.add(
        // NAV = price * poolSupply
        _getPriceInToken(protocolWrappers[currToken]).mul(
          _contractBalanceOf(currToken)
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
      uint256[] memory _lastAllocations = lastAllocations;
      uint256 lastLen = _lastAllocations.length;
      bool areAllocationsEqual = rebalancerLastAllocations.length == lastLen;
      if (areAllocationsEqual) {
        for (uint256 i = 0; i < lastLen || !areAllocationsEqual; i++) {
          if (_lastAllocations[i] != rebalancerLastAllocations[i]) {
            areAllocationsEqual = false;
            break;
          }
        }
      }

      uint256 balance = _contractBalanceOf(token);

      if (areAllocationsEqual && balance == 0) {
        return false;
      }

      uint256 maxUnlentBalance = _getCurrentPoolValue().mul(maxUnlentPerc).div(FULL_ALLOC);
      if (balance > maxUnlentBalance) {
        // mint the difference
        _mintWithAmounts(rebalancerLastAllocations, balance.sub(maxUnlentBalance));
      }

      if (areAllocationsEqual) {
        return false;
      }

      // Instead of redeeming everything during rebalance we redeem and mint only what needs
      // to be reallocated
      // get current allocations in underlying (it does not count unlent underlying)
      (uint256[] memory amounts, uint256 totalInUnderlying) = _getCurrentAllocations();

      if (balance == 0 && maxUnlentPerc > 0) {
        totalInUnderlying = totalInUnderlying.sub(maxUnlentBalance);
      }

      (uint256[] memory toMintAllocations, uint256 totalToMint, bool lowLiquidity) = _redeemAllNeeded(
        amounts,
        // calculate new allocations given the total (not counting unlent balance)
        _amountsFromAllocations(rebalancerLastAllocations, totalInUnderlying)
      );
      // if some protocol has liquidity that we should redeem, we do not update
      // lastAllocations to force another rebalance next time
      if (!lowLiquidity) {
        // Update lastAllocations with rebalancerLastAllocations
        delete lastAllocations;
        lastAllocations = rebalancerLastAllocations;
      }

      uint256 totalRedeemd = _contractBalanceOf(token);

      if (totalRedeemd <= maxUnlentBalance) {
        return false;
      }

      // Do not mint directly using toMintAllocations check with totalRedeemd
      uint256[] memory tempAllocations = new uint256[](toMintAllocations.length);
      for (uint256 i = 0; i < toMintAllocations.length; i++) {
        // Calc what would have been the correct allocations percentage if all was available
        tempAllocations[i] = toMintAllocations[i].mul(FULL_ALLOC).div(totalToMint);
      }

      // partial amounts
      _mintWithAmounts(tempAllocations, totalRedeemd.sub(maxUnlentBalance));

      emit Rebalance(msg.sender, totalInUnderlying.add(maxUnlentBalance));

      return true; // hasRebalanced
  }

  /**
   * Redeem unclaimed governance tokens and update governance global index and user index if needed
   * if called during redeem it will send all gov tokens accrued by a user to the user
   *
   * @param _to : user address
   */
  function _redeemGovTokens(address _to) internal {
    _redeemGovTokensInternal(_to, new bool[](govTokens.length));
  }

  /**
   * Redeem unclaimed governance tokens and update governance global index and user index if needed
   * if called during redeem it will send all gov tokens accrued by a user to the user
   *
   * @param _to : user address
   * @param _skipGovTokenRedeem : array of flag for redeeming or not gov tokens
   */
  function _redeemGovTokensInternal(address _to, bool[] memory _skipGovTokenRedeem) internal {
    address[] memory _govTokens = govTokens;
    if (_govTokens.length == 0) {
      return;
    }
    uint256 supply = totalSupply();
    uint256 usrBal = balanceOf(_to);
    address govToken;

    if (supply > 0) {
      for (uint256 i = 0; i < _govTokens.length; i++) {
        govToken = _govTokens[i];

        _redeemGovTokensFromProtocol(govToken);

        // get current gov token balance
        uint256 govBal = _contractBalanceOf(govToken);
        if (govBal > 0) {
          // update global index with ratio of govTokens per idleToken
          govTokensIndexes[govToken] = govTokensIndexes[govToken].add(
            // check how much gov tokens for each idleToken we gained since last update
            govBal.sub(govTokensLastBalances[govToken]).mul(ONE_18).div(supply)
          );
          // update global var with current govToken balance
          govTokensLastBalances[govToken] = govBal;
        }

        if (usrBal > 0) {
          uint256 usrIndex = usersGovTokensIndexes[govToken][_to];
          // check if user has accrued something
          uint256 delta = govTokensIndexes[govToken].sub(usrIndex);
          if (delta != 0) {
            uint256 share = usrBal.mul(delta).div(ONE_18);
            uint256 bal = _contractBalanceOf(govToken);
            // To avoid rounding issue
            if (share > bal) {
              share = bal;
            }
            if (_skipGovTokenRedeem[i]) { // -> gift govTokens[i] accrued to the pool
              // update global index with ratio of govTokens per idleToken
              govTokensIndexes[govToken] = govTokensIndexes[govToken].add(
                // check how much gov tokens for each idleToken we gained since last update
                share.mul(ONE_18).div(supply.sub(usrBal))
              );
            } else {
              uint256 feeDue;
              // no fee for IDLE governance token
              if (feeAddress != address(0) && fee > 0 && govToken != IDLE) {
                feeDue = share.mul(fee).div(FULL_ALLOC);
                // Transfer gov token fee to feeAddress
                _transferTokens(govToken, feeAddress, feeDue);
              }
              // Transfer gov token to user
              _transferTokens(govToken, _to, share.sub(feeDue));
              // Update last balance
              govTokensLastBalances[govToken] = _contractBalanceOf(govToken);
            }
          }
        }
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
    if (_govToken == COMP || _govToken == IDLE || _govToken == stkAAVE) {
      address[] memory holders = new address[](1);
      holders[0] = address(this);

      if (_govToken == IDLE) {
        // For IDLE, the distribution is done only to IdleTokens, so `holders` and
        // `tokens` parameters are the same and equal to address(this)
        IdleController(idleController).claimIdle(holders, holders);
        return;
      }

      address[] memory tokens = new address[](1);
      if (_govToken == stkAAVE && aToken != address(0)) {
        tokens[0] = aToken;
        IAaveIncentivesController _ctrl = IAaveIncentivesController(AToken(tokens[0]).getIncentivesController());
        _ctrl.claimRewards(tokens, _ctrl.getUserUnclaimedRewards(address(this)), address(this));
        return;
      }
      if (cToken != address(0)) {
        tokens[0] = cToken;
        Comptroller(CERC20(tokens[0]).comptroller()).claimComp(holders, tokens, false, true);
      }
    }
  }

  /**
   * Update receiver userAvgPrice paid for each idle token,
   * receiver will pay fees accrued
   *
   * @param usr : user that should have balance update
   * @param qty : new amount deposited / transferred, in idleToken
   * @param price : sender userAvgPrice
   */
  function _updateUserFeeInfo(address usr, uint256 qty, uint256 price) internal {
    uint256 usrBal = balanceOf(usr);
    // ((avgPrice * oldBalance) + (senderAvgPrice * newQty)) / totBalance
    userAvgPrices[usr] = userAvgPrices[usr].mul(usrBal.sub(qty)).add(price.mul(qty)).div(usrBal);
  }

  /**
   * Calculate fee in underlyings and send them to feeAddress
   *
   * @param amount : in idleTokens
   * @param redeemed : in underlying
   * @param currPrice : current idleToken price
   * @return : net value in underlying
   */
  function _getFee(uint256 amount, uint256 redeemed, uint256 currPrice) internal returns (uint256) {
    uint256 avgPrice = userAvgPrices[msg.sender];
    if (currPrice < avgPrice) {
      return redeemed;
    }
    // 10**23 -> ONE_18 * FULL_ALLOC
    uint256 feeDue = amount.mul(currPrice.sub(avgPrice)).mul(fee).div(10**23);
    _transferTokens(token, feeAddress, feeDue);
    return redeemed.sub(feeDue);
  }

  /**
   * Mint specific amounts of protocols tokens
   *
   * @param allocations : array of amounts to be minted
   * @param total : total amount
   * @return : net value in underlying
   */
  function _mintWithAmounts(uint256[] memory allocations, uint256 total) internal {
    // mint for each protocol and update currentTokensUsed
    uint256[] memory protocolAmounts = _amountsFromAllocations(allocations, total);

    uint256 currAmount;
    address protWrapper;
    address[] memory _tokens = allAvailableTokens;
    for (uint256 i = 0; i < protocolAmounts.length; i++) {
      currAmount = protocolAmounts[i];
      if (currAmount != 0) {
        protWrapper = protocolWrappers[_tokens[i]];
        // Transfer _amount underlying token (eg. DAI) to protWrapper
        _transferTokens(token, protWrapper, currAmount);
        ILendingProtocol(protWrapper).mint();
      }
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
   * @param amounts : array with current allocations in underlying
   * @param newAmounts : array with new allocations in underlying
   * @return toMintAllocations : array with amounts to be minted
   * @return totalToMint : total amount that needs to be minted
   */
  function _redeemAllNeeded(
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
    address[] memory _tokens = allAvailableTokens;
    // check the difference between amounts and newAmounts
    for (uint256 i = 0; i < amounts.length; i++) {
      currToken = _tokens[i];
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
          toRedeem.mul(ONE_18).div(protocol.getPriceInToken())
        );
        // tokens are now in this contract
      } else {
        toMintAllocations[i] = newAmount.sub(currAmount);
        totalToMint = totalToMint.add(toMintAllocations[i]);
      }
    }
  }

  /**
   * Get the contract balance of every protocol currently used
   *
   * @return amounts : array with all amounts for each protocol in order,
   *                   eg [amountCompoundInUnderlying, amountFulcrumInUnderlying]
   * @return total : total AUM in underlying
   */
  function _getCurrentAllocations() internal view
    returns (uint256[] memory amounts, uint256 total) {
      // Get balance of every protocol implemented
      address currentToken;
      address[] memory _tokens = allAvailableTokens;
      uint256 tokensLen = _tokens.length;
      amounts = new uint256[](tokensLen);
      for (uint256 i = 0; i < tokensLen; i++) {
        currentToken = _tokens[i];
        amounts[i] = _getPriceInToken(protocolWrappers[currentToken]).mul(
          _contractBalanceOf(currentToken)
        ).div(ONE_18);
        total = total.add(amounts[i]);
      }
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
      address[] memory _tokens = allAvailableTokens;
      for (uint256 i = 0; i < _tokens.length; i++) {
        currentToken = _tokens[i];
        total = total.add(_getPriceInToken(protocolWrappers[currentToken]).mul(
          _contractBalanceOf(currentToken)
        ).div(ONE_18));
      }

      // add unlent balance
      total = total.add(_contractBalanceOf(token));
  }

  /**
   * Get contract balance of _token
   *
   * @param _token : address of the token to read balance
   * @return total : balance of _token in this contract
   */
  function _contractBalanceOf(address _token) internal view returns (uint256) {
    // Original implementation:
    //
    // return IERC20(_token).balanceOf(address(this));

    // Optimized implementation inspired by uniswap https://github.com/Uniswap/uniswap-v3-core/blob/main/contracts/UniswapV3Pool.sol#L144
    //
    // 0x70a08231 -> selector for 'function balanceOf(address) returns (uint256)'
    (bool success, bytes memory data) =
        _token.staticcall(abi.encodeWithSelector(0x70a08231, address(this)));
    require(success);
    return abi.decode(data, (uint256));
  }


  /**
   * Get price of 1 protocol token in underlyings
   *
   * @param _token : address of the protocol token
   * @return price : price of protocol token
   */
  function _getPriceInToken(address _token) internal view returns (uint256) {
    return ILendingProtocol(_token).getPriceInToken();
  }

  /**
   * Check that no mint has been made in the same block from the same EOA
   */
  function _checkMintRedeemSameTx() internal view {
    require(keccak256(abi.encodePacked(tx.origin, block.number)) != _minterBlock, "REE");
  }

  // ILendingProtocols calls
  /**
   * Redeem underlying tokens through protocol wrapper
   *
   * @param _amount : amount of `_token` to redeem
   * @param _token : protocol token address
   * @return tokens : new tokens minted
   */
  function _redeemProtocolTokens(address _token, uint256 _amount)
    internal
    returns (uint256 tokens) {
      if (_amount != 0) {
        // Transfer _amount of _protocolToken (eg. cDAI) to _wrapperAddr
        address _wrapperAddr = protocolWrappers[_token];
        _transferTokens(_token, _wrapperAddr, _amount);
        tokens = ILendingProtocol(_wrapperAddr).redeem(address(this));
      }
  }

  function _transferTokens(address _token, address _to, uint256 _amount) internal {
    IERC20(_token).safeTransfer(_to, _amount);
  }
}
