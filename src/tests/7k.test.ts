import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import { getQuote, buildTx, setSuiClient } from '@7kprotocol/sdk-ts';

import {
  USDC_TYPE,
  keypair,
  suiClient,
  safeCoinTx,
  getAmountWithSlippage,
} from './setup';

test('7k aggregator', async () => {
  const amountIn = 200_000_000n;

  setSuiClient(suiClient);

  const quoteResponse = await getQuote({
    tokenIn: SUI_TYPE_ARG,
    tokenOut: USDC_TYPE,
    amountIn: amountIn.toString(),
  });

  const response = await buildTx({
    quoteResponse,
    accountAddress: keypair.getPublicKey().toSuiAddress(),
    slippage: 0.01,
    commission: {
      partner: keypair.getPublicKey().toSuiAddress(),
      commissionBps: 0,
    },
  });

  response.tx.setSender(keypair.getPublicKey().toSuiAddress());
  response.tx.setGasBudget(0.3e9);

  await expect(
    safeCoinTx.dryRun({
      tx: response.tx,
      coinInType: SUI_TYPE_ARG,
      coinInAmount: amountIn,
      coinOutType: USDC_TYPE,
      coinOutAmount: getAmountWithSlippage(
        BigInt(Math.floor(+quoteResponse.returnAmount * 1_000_000)),
        1000n
      ),
      checkObjectChanges: true,
    })
  ).resolves.not.toThrow();
});
