import {
  aftermathRouter,
  USDC_TYPE,
  DEEP_TYPE,
  safeCoinTx,
  keypair,
  getAmountWithSlippage,
} from './setup';

test('aftermath router', async () => {
  const amountIn = 500_000n;

  const route = await aftermathRouter.getCompleteTradeRouteGivenAmountIn({
    coinInType: USDC_TYPE,
    coinOutType: DEEP_TYPE,
    coinInAmount: amountIn,
  });

  const tx = await aftermathRouter.getTransactionForCompleteTradeRoute({
    completeRoute: route,
    walletAddress: keypair.getPublicKey().toSuiAddress(),
    slippage: 1000,
  });

  await expect(
    safeCoinTx.dryRun({
      tx,
      coinInType: USDC_TYPE,
      coinInAmount: amountIn,
      coinOutType: DEEP_TYPE,
      coinOutAmount: getAmountWithSlippage(route.coinOut.amount, 1000n),
      checkObjectChanges: true,
      gasBudget: 100_000_000n,
    })
  ).resolves.not.toThrow();
});
