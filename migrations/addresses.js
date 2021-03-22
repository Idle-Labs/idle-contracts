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
}

const USDC = {
  'live': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'live-fork': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // needed for truffle
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
  'kovan': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'kovan-fork': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // needed for truffle
  'local': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'local-fork': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'test': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'coverage': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

  'deploy': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // used for truffle Teams deploy, now kovan
};

const idleDAIV4 = '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4';
const idleWETHV4 = '0xC8E6CA6E96a326dC448307A5fDE90a0b21fd7f80';
const idleUSDCV4 = '0x5274891bEC421B39D23760c04A6755eCB444797C';
const idleUSDTV4 = '0xF34842d05A1c888Ca02769A633DF37177415C2f8';
const idleSUSDV4 = '0xF52CDcD458bf455aeD77751743180eC4A595Fd3F';
const idleTUSDV4 = '0xc278041fDD8249FE4c1Aad1193876857EEa3D68c';
const idleWBTCV4 = '0x8C81121B15197fA0eEaEE1DC75533419DcfD3151';
const idleDAISafeV4 = '0xa14eA0E11121e6E951E87c66AFe460A00BCD6A16';
const idleUSDCSafeV4 = '0x3391bc034f2935ef0e1e41619445f998b2680d35';
const idleUSDTSafeV4 = '0x28fAc5334C9f7262b3A3Fe707e250E01053e07b5';
const idleMultisig = '0xaDa343Cb6820F4f5001749892f6CAA9920129F2A';

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
  idleDAISafeV4,
  idleUSDCSafeV4,
  idleUSDTSafeV4,
];

const minimalInitializableProxyFactory = "0x91baced76e3e327ba7850ef82a7a8251f6e43fb8";
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
  idleDAIV4: idleDAIV4,
  idleWETHV4: idleWETHV4,
  idleUSDCV4: idleUSDCV4,
  idleUSDTV4: idleUSDTV4,
  idleSUSDV4: idleSUSDV4,
  idleTUSDV4: idleTUSDV4,
  idleWBTCV4: idleWBTCV4,
  idleDAISafeV4: idleDAISafeV4,
  idleUSDCSafeV4: idleUSDCSafeV4,
  idleUSDTSafeV4: idleUSDTSafeV4,
  IDLE: IDLE,
  timelock: timelock,
  proxyAdmin: proxyAdmin,
  proxyAdminETH: proxyAdminETH,
  allIdleTokens: allIdleTokens,
  aaveAddressesProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
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
  addr0: '0x0000000000000000000000000000000000000000',
  idleController: '0x275DA8e61ea8E02d51EDd8d0DC5c0E62b4CDB0BE',
  governorAlpha: '0x2256b25CFC8E35c3135664FD03E77595042fe31B',
  ecosystemFund: '0xb0aA1f98523Ec15932dd5fAAC5d86e57115571C7',
  vesterFactory: '0xbF875f2C6e4Cc1688dfe4ECf79583193B6089972',
  whale: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
  forkProposer: '0x3675D2A334f17bCD4689533b7Af263D48D96eC72',
  bountyAddressForEB: '0x394495a3800d1504b5686d398836baefebd0c5b7',
  mintRedeemTestUser: '0xF1363D3D55d9e679cC6aa0a0496fD85BDfCF7464'
};
