import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import {
  hopSdk,
  DEEP_TYPE,
  safeCoinTx,
  keypair,
  getAmountWithSlippage,
} from './setup';

test('hop aggregator', async () => {
  const amountIn = 200_000_000n;

  const quote = await hopSdk.fetchQuote({
    token_in: '0x2::sui::SUI',
    token_out: DEEP_TYPE,
    amount_in: amountIn,
  });

  const response = await hopSdk.fetchTx({
    trade: quote.trade,
    sui_address: keypair.getPublicKey().toSuiAddress(),
    gas_budget: 0.3e9,
    max_slippage_bps: 1000,
  });

  expect(quote.amount_out_with_fee).toBeGreaterThan(
    getAmountWithSlippage(quote.amount_out_with_fee, 1000n)
  );

  await expect(
    safeCoinTx.checkTx({
      tx: response.transaction,
      coinInType: SUI_TYPE_ARG,
      coinInAmount: amountIn,
      coinOutType: DEEP_TYPE,
      coinOutAmount: getAmountWithSlippage(quote.amount_out_with_fee, 1000n),
      checkObjectChanges: true,
    })
  ).resolves.not.toThrow();
});
