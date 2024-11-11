import { SafeCoinTx } from '../sdk/safe-coin-tx';
import dotenv from 'dotenv';
import invariant from 'tiny-invariant';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { HopApi, HopApiOptions } from '@hop.ag/sdk';

dotenv.config();

invariant(process.env.KEY && process.env.HOP_API_KEY, 'Private key missing');

export const keypair = Ed25519Keypair.fromSecretKey(
  Uint8Array.from(Buffer.from(process.env.KEY, 'base64')).slice(1)
);

export const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });

export const safeCoinTx = new SafeCoinTx();

const hop_api_options: HopApiOptions = {
  api_key: process.env.HOP_API_KEY,
  fee_bps: 0,
  fee_wallet: keypair.getPublicKey().toSuiAddress(),
  charge_fees_in_sui: true,
};

export const hopSdk = new HopApi(getFullnodeUrl('mainnet'), hop_api_options);

export const DEEP_TYPE =
  '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP';

export const USDC_TYPE =
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

export const getAmountWithSlippage = (amount: bigint, slippage: bigint) => {
  return amount - (amount * slippage) / 10_000n;
};
