require('dotenv').config();

const cDAI = {
  'live': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'proxy': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'live-fork': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', // needed for truffle
  'kovan': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
  'kovan-fork': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // needed for truffle
  'local': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'local-fork': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'test': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  'coverage': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',

  'deploy': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // used for truffle Teams deploy, now kovan
};
const iDAI = {
  'live': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'proxy': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'live-fork': '0x493C57C4763932315A328269E1ADaD09653B9081', // needed for truffle
  'kovan': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d',
  'kovan-fork': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d', // needed for truffle
  'local': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'local-fork': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'test': '0x493C57C4763932315A328269E1ADaD09653B9081',
  'coverage': '0x493C57C4763932315A328269E1ADaD09653B9081',

  'deploy': '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d', // used for truffle Teams deploy, now kovan
};
const aDAI = {
  'live': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'proxy': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'live-fork': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'local-fork': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'test': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
  'coverage': '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',

  'deploy': '', // used for truffle Teams deploy, now kovan
};

const aDAIV2 = {
  'live': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'proxy': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'live-fork': '0x028171bCA77440897B824Ca71D1c56caC55b68A3', // needed for truffle
  'kovan': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'kovan-fork': '0x028171bCA77440897B824Ca71D1c56caC55b68A3', // needed for truffle
  'mumbai': '0x639cB7b21ee2161DF9c882483C9D55c90c20Ca3e',
  'matic': '0x27F8D03b3a2196956ED754baDc28D73be8830A6e',
  'local': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'local-fork': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'test': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  'coverage': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',

  'deploy': '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
};

const CHAI = {
  'live': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'proxy': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'live-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // needed for truffle
  'kovan': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'kovan-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // needed for truffle
  'local': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'local-fork': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'test': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',
  'coverage': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215',

  'deploy': '0x06AF07097C9Eeb7fD685c692751D5C66dB49c215', // used for truffle Teams deploy, now kovan
};
const DAI = {
  'live': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'proxy': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'live-fork': '0x6B175474E89094C44Da98b954EedeAC495271d0F', // needed for truffle
  'kovan': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
  'kovan-fork': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // needed for truffle
  'mumbai': '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F',
  'matic': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  'local': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'local-fork': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'test': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'coverage': '0x6B175474E89094C44Da98b954EedeAC495271d0F',

  'deploy': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // used for truffle Teams deploy, now kovan
};
const yxDAI = {
  'live': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'proxy': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'live-fork': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a', // needed for truffle
  'kovan': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'kovan-fork': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a', // needed for truffle
  'local': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'local-fork': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'test': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',
  'coverage': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a',

  'deploy': '0xb299BCDF056d17Bd1A46185eCA8bCE458B00DC4a', // used for truffle Teams deploy, now kovan
};
const COMP = {
  'live': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'proxy': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'live-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'kovan': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'kovan-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888', // needed for truffle
  'local': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'local-fork': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'test': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'coverage': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'deploy': '0xc00e94cb662c3520282e6f5717214004a7f26888', // used for truffle Teams deploy, now kovan
}
const stkAAVE = {
  'live': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'proxy': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'live-fork': '0x4da27a545c0c5B758a6BA100e3a049001de870f5', // needed for truffle
  'kovan': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'kovan-fork': '0x4da27a545c0c5B758a6BA100e3a049001de870f5', // needed for truffle
  'local': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'local-fork': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'test': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'coverage': '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
  'deploy': '0x4da27a545c0c5B758a6BA100e3a049001de870f5', // used for truffle Teams deploy, now kovan
}

const cUSDC = {
  'live': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'live-fork': '0x39AA39c021dfbaE8faC545936693aC917d5E7563', // needed for truffle
  // Attention: This is the new interest rate model
  'kovan': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35',
  'kovan-fork': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35', // needed for truffle
  'local': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'local-fork': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'test': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  'coverage': '0x39AA39c021dfbaE8faC545936693aC917d5E7563',

  'deploy': '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35', // used for truffle Teams deploy, now kovan
};
const iUSDC = {
  'live': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'live-fork': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'local-fork': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'test': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',
  'coverage': '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f',

  'deploy': '', // used for truffle Teams deploy, now kovan
};
const aUSDC = {
  'live': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E',
  'live-fork': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E',
  'local-fork': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E',
  'test': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E',
  'coverage': '0x9bA00D6856a4eDF4665BcA2C2309936572473B7E',

  'deploy': '', // used for truffle Teams deploy, now kovan
};

const aUSDCV2 = {
  'live': '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  'live-fork': '0xBcca60bB61934080951369a648Fb03DF4F96263C', // needed for truffle
  'matic': '0x1a13F4Ca1d028320A707D99520AbFefca3998b7F',
  'kovan': '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  'kovan-fork': '0xBcca60bB61934080951369a648Fb03DF4F96263C', // needed for truffle
  'local': '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  'local-fork': '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  'test': '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  'coverage': '0xBcca60bB61934080951369a648Fb03DF4F96263C',

  'deploy': '0xBcca60bB61934080951369a648Fb03DF4F96263C'
}

const USDC = {
  'live': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'live-fork': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // needed for truffle
  'matic': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  'kovan': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF',
  'kovan-fork': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF', // needed for truffle
  'local': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'local-fork': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'test': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'coverage': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',

  'deploy': '0x75B0622Cec14130172EaE9Cf166B92E5C112FaFF', // used for truffle Teams deploy, now kovan
};
const yxUSDC = {
  'live': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',
  'live-fork': '0xd2F45883627f26EC34825486ca4c25235A0da0C3', // needed for truffle
  'kovan': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',
  'kovan-fork': '0xd2F45883627f26EC34825486ca4c25235A0da0C3', // needed for truffle
  'local': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',
  'local-fork': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',
  'test': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',
  'coverage': '0xd2F45883627f26EC34825486ca4c25235A0da0C3',

  'deploy': '0xd2F45883627f26EC34825486ca4c25235A0da0C3', // used for truffle Teams deploy, now kovan
};

const cUSDT = {
  'live': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  'live-fork': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9', // needed for truffle
  // Attention: This is the new interest rate model
  'kovan': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  'kovan-fork': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9', // needed for truffle
  'local': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  'local-fork': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  'test': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  'coverage': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',

  'deploy': '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9', // used for truffle Teams deploy, now kovan
};
const iUSDT = {
  'live': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',
  'live-fork': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B', // needed for truffle
  'kovan': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',
  'kovan-fork': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B', // needed for truffle
  'local': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',
  'local-fork': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',
  'test': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',
  'coverage': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B',

  'deploy': '0x8326645f3Aa6De6420102Fdb7Da9E3a91855045B', // used for truffle Teams deploy, now kovan
};
const aUSDT = {
  'live': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  'live-fork': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8', // needed for truffle
  'kovan': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  'kovan-fork': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8', // needed for truffle
  'local': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  'local-fork': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  'test': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  'coverage': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',

  'deploy': '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8', // used for truffle Teams deploy, now kovan
};
const aUSDTV2 = {
  'live': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  'live-fork': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811', // needed for truffle
  'kovan': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  'kovan-fork': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811', // needed for truffle
  'local': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  'local-fork': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  'test': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
  'coverage': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',

  'deploy': '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
};
const USDT = {
  'live': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'live-fork': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // needed for truffle
  'kovan': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'kovan-fork': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // needed for truffle
  'local': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'local-fork': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'test': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'coverage': '0xdAC17F958D2ee523a2206206994597C13D831ec7',

  'deploy': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // used for truffle Teams deploy, now kovan
};

const aTUSD = {
  'live': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'live-fork': '0x4DA9b813057D04BAef4e5800E36083717b4a0341', // needed for truffle
  'kovan': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'kovan-fork': '0x4DA9b813057D04BAef4e5800E36083717b4a0341', // needed for truffle
  'local': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'local-fork': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'test': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'coverage': '0x4DA9b813057D04BAef4e5800E36083717b4a0341',
  'deploy': '0x4DA9b813057D04BAef4e5800E36083717b4a0341', // used for truffle Teams deploy, now kovan
};

const aTUSDV2 = {
  'live': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  'live-fork': '0x101cc05f4A51C0319f570d5E146a8C625198e636', // needed for truffle
  'kovan': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  'kovan-fork': '0x101cc05f4A51C0319f570d5E146a8C625198e636', // needed for truffle
  'local': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  'local-fork': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  'test': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  'coverage': '0x101cc05f4A51C0319f570d5E146a8C625198e636',

  'deploy': '0x101cc05f4A51C0319f570d5E146a8C625198e636',
};

const TUSD = {
  'live': '0x0000000000085d4780B73119b644AE5ecd22b376',
  'live-fork': '0x0000000000085d4780B73119b644AE5ecd22b376', // needed for truffle
  'kovan': '0x0000000000085d4780B73119b644AE5ecd22b376',
  'kovan-fork': '0x0000000000085d4780B73119b644AE5ecd22b376', // needed for truffle
  'local': '0x0000000000085d4780B73119b644AE5ecd22b376',
  'local-fork': '0x0000000000085d4780B73119b644AE5ecd22b376',
  'test': '0x0000000000085d4780B73119b644AE5ecd22b376',
  'coverage': '0x0000000000085d4780B73119b644AE5ecd22b376',

  'deploy': '0x0000000000085d4780B73119b644AE5ecd22b376', // used for truffle Teams deploy, now kovan
};

const aSUSD = {
  'live': '0x625ae63000f46200499120b906716420bd059240',
  'live-fork': '0x625ae63000f46200499120b906716420bd059240', // needed for truffle
  'kovan': '0x625ae63000f46200499120b906716420bd059240',
  'kovan-fork': '0x625ae63000f46200499120b906716420bd059240', // needed for truffle
  'local': '0x625ae63000f46200499120b906716420bd059240',
  'local-fork': '0x625ae63000f46200499120b906716420bd059240',
  'test': '0x625ae63000f46200499120b906716420bd059240',
  'coverage': '0x625ae63000f46200499120b906716420bd059240',
  'deploy': '0x625ae63000f46200499120b906716420bd059240', // used for truffle Teams deploy, now kovan
};
const aSUSDV2 = {
  'live': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
  'live-fork': '0x6c5024cd4f8a59110119c56f8933403a539555eb', // needed for truffle
  'kovan': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
  'kovan-fork': '0x6c5024cd4f8a59110119c56f8933403a539555eb', // needed for truffle
  'local': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
  'local-fork': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
  'test': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
  'coverage': '0x6c5024cd4f8a59110119c56f8933403a539555eb',

  'deploy': '0x6c5024cd4f8a59110119c56f8933403a539555eb',
}
const SUSD = {
  'live': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  'live-fork': '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // needed for truffle
  'kovan': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  'kovan-fork': '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // needed for truffle
  'local': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  'local-fork': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  'test': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  'coverage': '0x57ab1ec28d129707052df4df418d58a2d46d5f51',

  'deploy': '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // used for truffle Teams deploy, now kovan
};
const cWBTC = {
  'live': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
  'live-fork': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4', // needed for truffle
  'kovan': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
  'kovan-fork': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4', // needed for truffle
  'local': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
  'local-fork': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
  'test': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',
  'coverage': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4',

  'deploy': '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4', // used for truffle Teams deploy, now kovan
};
const cWBTCV2 = {
  'live': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  'live-fork': '0xccf4429db6322d5c611ee964527d42e5d685dd6a', // needed for truffle
  'kovan': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  'kovan-fork': '0xccf4429db6322d5c611ee964527d42e5d685dd6a', // needed for truffle
  'local': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  'local-fork': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  'test': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',
  'coverage': '0xccf4429db6322d5c611ee964527d42e5d685dd6a',

  'deploy': '0xccf4429db6322d5c611ee964527d42e5d685dd6a', // used for truffle Teams deploy, now kovan
};
const iWBTC = {
  'live': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',
  'live-fork': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5', // needed for truffle
  'kovan': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',
  'kovan-fork': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5', // needed for truffle
  'local': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',
  'local-fork': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',
  'test': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',
  'coverage': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5',

  'deploy': '0xBA9262578EFef8b3aFf7F60Cd629d6CC8859C8b5', // used for truffle Teams deploy, now kovan
};
const aWBTC = {
  'live': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3',
  'live-fork': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3', // needed for truffle
  'kovan': '',
  'kovan-fork': '', // needed for truffle
  'local': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3',
  'local-fork': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3',
  'test': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3',
  'coverage': '0xFC4B8ED459e00e5400be803A9BB3954234FD50e3',

  'deploy': '', // used for truffle Teams deploy, now kovan
};

const aWBTCV2 = {
  'live': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  'live-fork': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656', // needed for truffle
  'kovan': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  'kovan-fork': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656', // needed for truffle
  'local': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  'local-fork': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  'test': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  'coverage': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',

  'deploy': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'
};

const WBTC = {
  'live': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'live-fork': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // needed for truffle
  'kovan': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'kovan-fork': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // needed for truffle
  'local': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'local-fork': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'test': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'coverage': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',

  'deploy': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // used for truffle Teams deploy, now kovan
};
const cWETH = {
  'live': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  'proxy': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  'live-fork': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5', // needed for truffle
  'kovan': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
  'kovan-fork': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // needed for truffle
  'local': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  'local-fork': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  'test': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  'coverage': '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',

  'deploy': '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // used for truffle Teams deploy, now kovan
};
const aWETH = {
  'live': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'proxy': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'live-fork': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e', // needed for truffle
  'matic': '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390',
  'kovan': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'kovan-fork': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e', // needed for truffle
  'local': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'local-fork': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'test': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  'coverage': '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',

  'deploy': '', // used for truffle Teams deploy, now kovan
};
const WETH = {
  'live': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'proxy': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'live-fork': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // needed for truffle
  'matic': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  'kovan': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'kovan-fork': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // needed for truffle
  'local': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'local-fork': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'test': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'coverage': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

  'deploy': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // used for truffle Teams deploy, now kovan
};
const RAI = {
  'live': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
  'proxy': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
  'live-fork': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919', // needed for truffle
  'kovan': '0x76b06a2f6dF6f0514e7BEC52a9AfB3f603b477CD',
  'kovan-fork': '0x76b06a2f6dF6f0514e7BEC52a9AfB3f603b477CD', // needed for truffle
  'local': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
  'local-fork': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
  'test': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
  'coverage': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',

  'deploy': '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919', // used for truffle Teams deploy, now kovan
};
const crRAI = {
  'live': '0xf8445C529D363cE114148662387eba5E62016e20',
  'proxy': '0xf8445C529D363cE114148662387eba5E62016e20',
  'live-fork': '0xf8445C529D363cE114148662387eba5E62016e20', // needed for truffle
  'kovan': '0xf8445C529D363cE114148662387eba5E62016e20',
  'kovan-fork': '0xf8445C529D363cE114148662387eba5E62016e20', // needed for truffle
  'local': '0xf8445C529D363cE114148662387eba5E62016e20',
  'local-fork': '0xf8445C529D363cE114148662387eba5E62016e20',
  'test': '0xf8445C529D363cE114148662387eba5E62016e20',
  'coverage': '0xf8445C529D363cE114148662387eba5E62016e20',

  'deploy': '0xf8445C529D363cE114148662387eba5E62016e20', // used for truffle Teams deploy, now kovan
};
const fuseRAI = {
  'live': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'proxy': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'live-fork': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE', // needed for truffle
  'kovan': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'kovan-fork': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE', // needed for truffle
  'local': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'local-fork': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'test': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',
  'coverage': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE',

  'deploy': '0x752F119bD4Ee2342CE35E2351648d21962c7CAfE', // used for truffle Teams deploy, now kovan
};
const aRAI = {
  'live': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'proxy': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'live-fork': '0xc9bc48c72154ef3e5425641a3c747242112a46af', // needed for truffle
  'kovan': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'kovan-fork': '0xc9bc48c72154ef3e5425641a3c747242112a46af', // needed for truffle
  'local': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'local-fork': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'test': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'coverage': '0xc9bc48c72154ef3e5425641a3c747242112a46af',
  'deploy': '0xc9bc48c72154ef3e5425641a3c747242112a46af', // used for truffle Teams deploy, now kovan
};
const FEI = {
  'live': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'proxy': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'live-fork': '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // needed for truffle
  'kovan': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'kovan-fork': '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // needed for truffle
  'local': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'local-fork': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'test': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'coverage': '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
  'deploy': '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // used for truffle Teams deploy, now kovan
};
const crFEI = {
  'live': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'proxy': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'live-fork': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91', // needed for truffle
  'kovan': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'kovan-fork': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91', // needed for truffle
  'local': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'local-fork': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'test': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'coverage': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91',
  'deploy': '0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91', // used for truffle Teams deploy, now kovan
};
const fuseFEI = {
  'live': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'proxy': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'live-fork': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945', // needed for truffle
  'kovan': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'kovan-fork': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945', // needed for truffle
  'local': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'local-fork': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'test': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'coverage': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945',
  'deploy': '0xd8553552f8868C1Ef160eEdf031cF0BCf9686945', // used for truffle Teams deploy, now kovan
};
const WMATIC = {
  'matic': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  'mumbai': '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
};
const crDAI = {
  'matic': '0x4eCEDdF62277eD78623f9A94995c680f8fd6C00e',
};
const crUSDC = {
  'matic': '0x73CF8c5D14Aa0EbC89f18272A568319F5BAB6cBD',
};
const crWETH = {
  'matic': '0x7ef18d0a9C3Fb1A716FF6c3ED0Edf52a2427F716',
};

const idleDAIV4 = '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4';
const idleUSDCV4 = '0x5274891bEC421B39D23760c04A6755eCB444797C';
const idleUSDTV4 = '0xF34842d05A1c888Ca02769A633DF37177415C2f8';
const idleSUSDV4 = '0xF52CDcD458bf455aeD77751743180eC4A595Fd3F';
const idleTUSDV4 = '0xc278041fDD8249FE4c1Aad1193876857EEa3D68c';
const idleWBTCV4 = '0x8C81121B15197fA0eEaEE1DC75533419DcfD3151';
const idleWETHV4 = '0xC8E6CA6E96a326dC448307A5fDE90a0b21fd7f80';
const idleRAIV4 = '0x5C960a3DCC01BE8a0f49c02A8ceBCAcf5D07fABe';
const idleFEIV4 = '0xb2d5CB72A621493fe83C6885E4A776279be595bC';
const idleDAISafeV4 = '0xa14eA0E11121e6E951E87c66AFe460A00BCD6A16';
const idleUSDCSafeV4 = '0x3391bc034f2935ef0e1e41619445f998b2680d35';
const idleUSDTSafeV4 = '0x28fAc5334C9f7262b3A3Fe707e250E01053e07b5';

const idleMultisig = '0xaDa343Cb6820F4f5001749892f6CAA9920129F2A';

const mumbaiIdleDAIV4 = '0x45a3598Ac8aDb2c6233979f710DC6a3D006238E0';

const maticIdleDAIV4 = '0x8a999F5A3546F8243205b2c0eCb0627cC10003ab';
const maticIdleUSDCV4 = '0x1ee6470CD75D5686d0b2b90C0305Fa46fb0C89A1';
const maticIdleWETHV4 = '0xfdA25D931258Df948ffecb66b5518299Df6527C4';

const IDLE = '0x875773784Af8135eA0ef43b5a374AaD105c5D39e';
const timelock = '0xD6dABBc2b275114a2366555d6C481EF08FDC2556';
const proxyAdmin = '0x7740792812A00510b50022D84e5c4AC390e01417';
const proxyAdminETH = '0xc2ff102E62027DE1205a7EDd4C8a8F58C1E5e3e8';

const allIdleTokens = [
  idleDAIV4,
  idleUSDCV4,
  idleUSDTV4,
  idleSUSDV4,
  idleTUSDV4,
  idleWBTCV4,
  idleWETHV4,
  idleDAISafeV4,
  idleUSDCSafeV4,
  idleUSDTSafeV4,
];

const minimalInitializableProxyFactory = {
  "live": "0x91baced76e3e327ba7850ef82a7a8251f6e43fb8",
  "mainnet": "0x91baced76e3e327ba7850ef82a7a8251f6e43fb8",
  "local": "0x91baced76e3e327ba7850ef82a7a8251f6e43fb8",
  "mumbai": "0xaE905A2895676F589C4A9E934845521B17e5387E",
  "matic": "0xad27d10eF37E809B67B1a7e74f65E781Cc5A693D",
};

const idleAaveV2Implementation = "0x01A3688D7d01390677e85256406B3156aCd59C64";
const idleAaveV2DAI = idleAaveV2Implementation;
const idleAaveV2USDC = "0xC9f16B7496843A82e51457aA84002d55036d8aA2";
const idleAaveV2USDT = "0x52E6CFE2f0dF1a76b4110a1F0BF79e7149eAd9db";
                     // 0xa462e7799e6f141402d183600D2335AC0E8AC7C7 duplicate
const idleAaveV2SUSD = "0x8678ACE49f9F60F19994E6A1D6D5526D162C1172";
const idleAaveV2TUSD = "0xE35c52F30Ba68C77E94c4ECED51551fEA6801B8e";
const idleAaveV2WBTC = "0x69435730D6Af2249265C4fF578D89Ec4c827C475";
const idleAaveV2DAISafe = "0xb7e6b842fdc0F2F5563c575dea271BB2F37AB09f";
const idleAaveV2USDCSafe = "0x9Ceb46147dc9E9cBBdD350EC53Ab143f6F20ECCD";
const idleAaveV2USDTSafe = "0xf834443C84235aB0C79Da83Fa5b18e32E1A7F271";
const idleAaveV2RAI = "0xA1f0aED05C063c201Dcf63e28B19Bd260D8561A8";
const idleAaveV2FEI = undefined;

// IdleCompoundLike
const idleCREAMImplementation = "0x8aff17b2c4951be77ae74db0ca77903389d9943a";
const idleFUSEImplementation = "0x8788050c3026557C539a2b8fCe146E27fA4ACc4F";

const maticIdleAaveV2Implementation = "0x6958d9088CE32491B11D22Cb358FC2ea6D5a463B";
const maticIdleAaveV2DAI = "0xA2C19beA882cc0B1749361Ac56118486336c300f";
const maticIdleAaveV2USDC = "0xa3734Ea6A5522d1eA24751ABED18232A1bfb8F59";
const maticIdleAaveV2WETH = "0x8482946A24e83FE15732b88dB07eEeBFA8776b05";

const priceOracleV2 = {
  'live': '0xB5A8f07dD4c3D315869405d702ee8F6EA695E8C5',
  'matic': '0x27F06D00d73Ec426193473726BB0671267Fd27F0',
};

const idleTokenHelper = {
  "mainnet": "0x5B7400cC634a49650Cb3212D882512424fED00ed",
  "matic":   "0x17e0D3F5CAEdE03c97bEcaC4Ecb27739A15E9485",
};

module.exports = {
  creator: process.env.CREATOR,
  rebalancerManager: process.env.REBALANCE_MANAGER,
  gstAddress: "0x0000000000b3F879cb30FE243b4Dfee438691c04",
  idlePriceCalculator: '0xAefb1325A2C1756Bc3fcc516D6C2CF947D225358',
  idleDAIBest: '0x78751b12da02728f467a44eac40f5cbc16bd7934',
  idleRebalancerDAIBest: '0x99d053a0f4b4100e739c6b42829c7cb59c031d08',
  cDAI: cDAI,
  iDAI: iDAI,
  aDAI: aDAI,
  aDAIV2: aDAIV2,
  CHAI: CHAI,
  DAI: DAI,
  yxDAI: yxDAI,
  COMP: COMP,
  stkAAVE: stkAAVE,
  cUSDC: cUSDC,
  iUSDC: iUSDC,
  aUSDC: aUSDC,
  aUSDCV2: aUSDCV2,
  USDC: USDC,
  yxUSDC: yxUSDC,
  cUSDT: cUSDT,
  iUSDT: iUSDT,
  aUSDT: aUSDT,
  aUSDTV2: aUSDTV2,
  USDT: USDT,
  aTUSD: aTUSD,
  aTUSDV2: aTUSDV2,
  TUSD: TUSD,
  aSUSD: aSUSD,
  aSUSDV2: aSUSDV2,
  SUSD: SUSD,
  cWBTC: cWBTC,
  cWBTCV2: cWBTCV2,
  iWBTC: iWBTC,
  aWBTC: aWBTC,
  aWBTCV2: aWBTCV2,
  WBTC: WBTC,
  aWETH: aWETH,
  cWETH: cWETH,
  WETH: WETH,
  RAI: RAI,
  crRAI: crRAI,
  WMATIC: WMATIC,
  fuseRAI: fuseRAI,
  aRAI: aRAI,
  crDAI: crDAI,
  crUSDC: crUSDC,
  crWETH: crWETH,
  FEI: FEI,
  crFEI: crFEI,
  fuseFEI: fuseFEI,
  idleDAIV4: idleDAIV4,
  idleUSDCV4: idleUSDCV4,
  idleUSDTV4: idleUSDTV4,
  idleSUSDV4: idleSUSDV4,
  idleTUSDV4: idleTUSDV4,
  idleWBTCV4: idleWBTCV4,
  idleWETHV4: idleWETHV4,
  idleRAIV4: idleRAIV4,
  idleFEIV4: idleFEIV4,
  idleDAISafeV4: idleDAISafeV4,
  idleUSDCSafeV4: idleUSDCSafeV4,
  idleUSDTSafeV4: idleUSDTSafeV4,
  mumbaiIdleDAIV4: mumbaiIdleDAIV4,
  maticIdleDAIV4: maticIdleDAIV4,
  maticIdleUSDCV4: maticIdleUSDCV4,
  maticIdleWETHV4: maticIdleWETHV4,
  IDLE: IDLE,
  timelock: timelock,
  proxyAdmin: proxyAdmin,
  proxyAdminETH: proxyAdminETH,
  allIdleTokens: allIdleTokens,
  aaveAddressesProvider: {
    'mainnet': '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    'mumbai': '0x178113104fEcbcD7fF8669a0150721e231F0FD4B',
    'matic': '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
  },
  minimalInitializableProxyFactory,
  idleAaveV2Implementation,
  idleAaveV2DAI,
  idleAaveV2USDC,
  idleAaveV2USDT,
  idleAaveV2SUSD,
  idleAaveV2TUSD,
  idleAaveV2WBTC,
  idleAaveV2DAISafe,
  idleAaveV2USDCSafe,
  idleAaveV2USDTSafe,
  idleAaveV2RAI,
  idleAaveV2FEI,
  maticIdleAaveV2Implementation,
  maticIdleAaveV2DAI,
  maticIdleAaveV2USDC,
  maticIdleAaveV2WETH,
  idleCREAMImplementation,
  idleFUSEImplementation,
  addr0: '0x0000000000000000000000000000000000000000',
  idleController: '0x275DA8e61ea8E02d51EDd8d0DC5c0E62b4CDB0BE',
  governorAlpha: '0x2256b25CFC8E35c3135664FD03E77595042fe31B',
  ecosystemFund: '0xb0aA1f98523Ec15932dd5fAAC5d86e57115571C7',
  vesterFactory: '0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972',
  whale: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
  forkProposer: '0x3675D2A334f17bCD4689533b7Af263D48D96eC72',
  bountyAddressForEB: '0x394495a3800d1504b5686d398836baefebd0c5b7',
  mintRedeemTestUser: '0xF1363D3D55d9e679cC6aa0a0496fD85BDfCF7464',
  idleWETHUser: '0xe4E69ef860D3018B61A25134D60678be8628f780',
  idleTokenHelper: idleTokenHelper,
  lastIdleTokenImplementation: '0xd133552be9724b501e1ee9c257e34e07317b5db6',
  priceOracleV2: priceOracleV2,
  mainnetProposer: '',
  feeTreasury: "0x69a62C24F16d4914a48919613e8eE330641Bcb94",
  treasuryMultisig: "0xFb3bD022D5DAcF95eE28a6B07825D4Ff9C5b3814",
  devLeagueMultisig: "0xe8eA8bAE250028a8709A3841E0Ae1a44820d677b",
  rebalancerHelper: '0x735a3792AC5655B21c0cae47D1c75184705dAA52'
};
