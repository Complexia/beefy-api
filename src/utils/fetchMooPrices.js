const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { MULTICHAIN_RPC } = require('../constants');
import { multicallAddress, web3Factory } from './web3';
import { MultiCall } from 'eth-multicall';
const IVault = require('../abis/BeefyVaultV6');

export const fetchMooPrices = async (pools, tokenPrices, lpPrices) => {
  let moo = {};

  await fetchPpfs(pools);

  for (let i = 0; i < pools.length; i++) {
    const mooPrice = calcMooPrice(pools[i], tokenPrices, lpPrices);
    moo = { ...moo, ...mooPrice };
  }
  return moo;
};

const fetchPpfs = async pools => {
  const chainIds = pools.map(p => p.chainId);
  const uniqueChainIds = [...new Set(chainIds)];

  for (let i = 0; i < uniqueChainIds.length; i++) {
    const web3 = web3Factory(uniqueChainIds[i]);
    let filtered = pools.filter(p => p.chainId == uniqueChainIds[i]);
    const multicall = new MultiCall(web3, multicallAddress(uniqueChainIds[i]));

    const ppfsCalls = [];
    pools.forEach(pool => {
      const tokenContract = new web3.eth.Contract(IVault, pool.address);
      ppfsCalls.push({
        ppfs: tokenContract.methods.pricePerShare(),
      });
    });

    const res = await multicall.all([ppfsCalls]);

    const ppfss = res[0].map(v => new BigNumber(v.ppfs));

    for (let i = 0; i < ppfss.length; i++) {
      filtered[i].ppfs = ppfss[i];
    }
  }
};

const calcMooPrice = (pool, tokenPrices, lpPrices) => {
  const price = pool.oracle == 'tokens' ? tokenPrices[pool.oracleId] : lpPrices[pool.oracleId];
  const mooPrice = pool.ppfs.times(price).dividedBy(pool.decimals);
  return { [pool.name]: mooPrice.toNumber() };
};

module.exports = { fetchMooPrices };
