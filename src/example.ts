import { SafeCoinTx } from './safe-coin';
import dotenv from 'dotenv';
import invariant from 'tiny-invariant';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { suiClient } from './utils';
import { Transaction } from '@mysten/sui/transactions';
import { HopApi, HopApiOptions } from '@hop.ag/sdk';

import { getFullnodeUrl } from '@mysten/sui/client';

dotenv.config();

invariant(process.env.KEY && process.env.HOP_API_KEY, 'Private key missing');

export const keypair = Ed25519Keypair.fromSecretKey(
  Uint8Array.from(Buffer.from(process.env.KEY, 'base64')).slice(1)
);

export const executeTx = async (tx: Transaction) => {
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
    requestType: 'WaitForLocalExecution',
  });

  // return if the tx hasn't succeed
  if (result.effects?.status?.status !== 'success') {
    console.log('\n\nCreating a new stable pool failed');
    return;
  }

  console.log('SUCCESS!');
};

const safeCoinTx = new SafeCoinTx();

const hop_api_options: HopApiOptions = {
  api_key: process.env.HOP_API_KEY,

  // 1bps = 0.01%. 10_000bps = 100%.
  fee_bps: 0,
  fee_wallet: keypair.getPublicKey().toSuiAddress(),

  // option to charge fees in sui when possible
  // instead of only the output token
  charge_fees_in_sui: false,
};

const sdk = new HopApi(getFullnodeUrl('mainnet'), hop_api_options);

const DEEP_TYPE =
  '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP';

const USDC_TYPE =
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

(async () => {
  const quote = await sdk.fetchQuote({
    token_in: '0x2::sui::SUI',
    token_out: DEEP_TYPE,
    amount_in: 2_000_000_000n,
  });

  const response = await sdk.fetchTx({
    trade: quote.trade,
    sui_address: keypair.getPublicKey().toSuiAddress(),
    gas_budget: 0.3e9, // optional default is 0.03 SUI
    max_slippage_bps: 1000, // optional default is 1%
  });
  const pred = await safeCoinTx.checkTx({
    tx: response.transaction,
    coinInType: '0x2::sui::SUI',
    coinInAmount: 2_000_000_000n,
    checkObjectChanges: true,
  });

  console.log(pred);
})();
