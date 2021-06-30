/**
 * @title: Idle Token Bootstrap contract
 * @summary: Used to deploy a new instance of an idleToken. The contract will then
 * be upgraded to IdleTokenGovernance
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
import "./interfaces/IERC3156FlashBorrower.sol";

import "./interfaces/Comptroller.sol";
import "./interfaces/CERC20.sol";
import "./interfaces/IdleController.sol";
import "./interfaces/PriceOracle.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IIdleTokenHelper.sol";

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
  * @param premium The fee flash borrowed
  **/
  event FlashLoan(
    address indexed target,
    address indexed initiator,
    uint256 amount,
    uint256 premium
  );

  // Addresses for stkAAVE distribution from Aave
  address public constant stkAAVE = address(0x4da27a545c0c5B758a6BA100e3a049001de870f5);
  address private aToken;

  // ####################################################
  // ################# INIT METHODS #####################
  // ####################################################

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
    address _cToken,
    address _aToken
  ) external onlyOwner {
    cToken = _cToken;
    aToken = _aToken;
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
    renouncePauser();
  }

  function _init(
    string calldata _name, // eg. IdleDAI
    string calldata _symbol, // eg. IDLEDAI
    address _token
  ) external initializer {
    // copied from old initialize() method removed at commit 04e29bd6f9282ef5677edc16570918da1a72dd3a
    // Initialize inherited contracts
    ERC20Detailed.initialize(_name, _symbol, 18);
    Ownable.initialize(msg.sender);
    Pausable.initialize(msg.sender);
    ReentrancyGuard.initialize();
    // Initialize storage variables
    maxUnlentPerc = 1000;
    flashLoanFee = 80;
    token = _token;
    tokenDecimals = ERC20Detailed(_token).decimals();
    // end of old initialize method
    oracle = address(0xB5A8f07dD4c3D315869405d702ee8F6EA695E8C5);
    feeAddress = address(0xBecC659Bfc6EDcA552fa1A67451cC6b38a0108E4);
    rebalancer = address(0xB3C8e5534F0063545CBbb7Ce86854Bf42dB8872B);
    tokenHelper = address(0x5B7400cC634a49650Cb3212D882512424fED00ed);
    fee = 10000;
    iToken = address(0);
  }

  // ####################################################
  // ############### END INIT METHODS ###################
  // ####################################################

  // Contract interfact for IIdleTokenV3_1
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
   * IdleToken price calculation, in underlying
   *
   * @return : price in underlying token
   */
  function tokenPrice() external view returns (uint256) {}

  /**
   * Get APR of every ILendingProtocol
   *
   * @return addresses: array of token addresses
   * @return aprs: array of aprs (ordered in respect to the `addresses` array)
   */
  function getAPRs() external view returns (address[] memory, uint256[] memory) {}

  /**
   * Get current avg APR of this IdleToken
   *
   * @return avgApr: current weighted avg apr
   */
  function getAvgAPR() public view returns (uint256) {}

  /**
   * Get how many gov tokens a user is entitled to (this may not include eventual undistributed tokens)
   *
   * @param _usr : user address
   * @return : array of amounts for each gov token
   */
  function getGovTokensAmounts(address _usr) external view returns (uint256[] memory _amounts) {}

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
    external returns (uint256 mintedTokens) {}


  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   *
   * @param _amount : amount of IdleTokens to be burned
   * @return redeemedTokens : amount of underlying tokens redeemed
   */
  function redeemIdleToken(uint256 _amount) external returns (uint256 redeemedTokens) {}

  /**
   * Here we calc the pool share one can withdraw given the amount of IdleToken they want to burn
   * and send interest-bearing tokens (eg. cDAI/iDAI) directly to the user.
   * Underlying (eg. DAI) is not redeemed here.
   *
   * @param _amount : amount of IdleTokens to be burned
   */
  function redeemInterestBearingTokens(uint256 _amount) external {}

  /**
   * Dynamic allocate all the pool across different lending protocols if needed,
   * rebalance without params
   *
   * NOTE: this method can be paused
   *
   * @return : whether has rebalanced or not
   */
  function rebalance() external returns (bool) {}

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
   * @return hasRebalanced : whether has rebalanced or not
   * @return avgApr : the new avg apr after rebalance
   */
  function openRebalance(uint256[] calldata _newAllocations)
    external whenNotPaused
    returns (bool hasRebalanced, uint256 avgApr) {}
}
