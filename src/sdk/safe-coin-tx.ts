import { SuiClient, DryRunTransactionBlockResponse } from '@mysten/sui/client';

import {
  normalizeStructTag,
  normalizeSuiAddress,
  SUI_TYPE_ARG,
} from '@mysten/sui/utils';
import invariant from 'tiny-invariant';
import { suiClient, isOwnedByAddress } from './utils';

import { DryRunArgs } from './safe-coin-ts.types';

export class SafeCoinTx {
  #client: SuiClient;
  #suiCoinType = normalizeStructTag(SUI_TYPE_ARG);
  #coinType = '0x2::coin::Coin';

  constructor(client: SuiClient = suiClient) {
    this.#client = client;
  }

  async dryRun({
    tx,
    coinInType,
    coinInAmount,
    coinOutType,
    coinOutAmount,
    checkObjectChanges = true,
    gasBudget,
  }: DryRunArgs) {
    invariant(coinInAmount > 0n, 'Coin in amount must be greater than 0');
    invariant(
      !coinOutAmount || coinOutAmount > 0n,
      'Coin out amount must be greater than 0'
    );

    const result = await this.#client.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: this.#client }),
    });

    invariant(result.effects.status.status === 'success', 'Transaction failed');

    this.#verifyCoinBalanceChanges(result, {
      coinInType: normalizeStructTag(coinInType),
      coinInAmount,
      coinOutType: normalizeStructTag(coinOutType),
      coinOutAmount,
      gasBudget,
    });

    if (checkObjectChanges) this.#verifyObjectChanges(result);

    return result;
  }

  #verifyCoinBalanceChanges(
    result: DryRunTransactionBlockResponse,
    {
      coinInType,
      coinInAmount,
      coinOutType,
      coinOutAmount,
      gasBudget,
    }: Omit<DryRunArgs, 'tx' | 'checkObjectChanges'>
  ) {
    coinInAmount = coinInAmount * -1n;

    coinInType = normalizeStructTag(coinInType);

    const sender = normalizeSuiAddress(result.input.sender);

    const totalGasUsed = this.#calculateGasUsed(result);

    if (gasBudget)
      invariant(totalGasUsed * -1n <= gasBudget, 'Gas budget exceeded');

    const balanceChangesMap = result.balanceChanges.reduce(
      (acc, change) => {
        if (!isOwnedByAddress(change.owner, sender)) return acc;

        const coinType = normalizeStructTag(change.coinType);
        return {
          ...acc,
          [coinType]: acc[coinType]
            ? acc[coinType] + BigInt(change.amount)
            : BigInt(change.amount),
        };
      },
      {} as Record<string, bigint>
    );

    const negativeAmounts = Object.values(balanceChangesMap).filter(
      (amounts) => 0n >= amounts
    );

    const isCoinSoldSui = coinInType === this.#suiCoinType;

    invariant(
      negativeAmounts.length === 1 ||
        negativeAmounts.length === (isCoinSoldSui ? 1 : 2),
      'Too many coins were sold'
    );

    const suiChangeAmount = balanceChangesMap[this.#suiCoinType];

    if (isCoinSoldSui) {
      invariant(
        suiChangeAmount >= coinInAmount + totalGasUsed,
        'The amount of Sui sold does not match the amount of Sui taken'
      );
    } else {
      invariant(
        balanceChangesMap[coinInType] >= coinInAmount,
        'The amount of coin sold does not match the amount of coin taken'
      );

      if (coinOutType !== this.#suiCoinType)
        invariant(
          suiChangeAmount >= totalGasUsed,
          'The amount of gas used is too high'
        );
    }

    if (coinOutType && coinOutAmount) {
      const gasCost =
        coinOutType === this.#suiCoinType ? totalGasUsed * -1n : 0n;

      invariant(
        balanceChangesMap[coinOutType] >= coinOutAmount - gasCost,
        'We expected to receive more coins'
      );
    }
  }

  #verifyObjectChanges(result: DryRunTransactionBlockResponse) {
    const sender = normalizeSuiAddress(result.input.sender);

    const ownedObjects = result.objectChanges.filter((change) => {
      if ('owner' in change) return isOwnedByAddress(change.owner, sender);

      return false;
    });

    invariant(
      ownedObjects.every((change) => {
        invariant(
          'objectType' in change,
          'Object change is missing the objectType property'
        );

        return change.objectType.startsWith(this.#coinType);
      }),
      'Only coins can be changed'
    );
  }

  #calculateGasUsed(result: DryRunTransactionBlockResponse) {
    const gasUsed = result.effects.gasUsed;

    return (
      (BigInt(gasUsed.computationCost) +
        BigInt(gasUsed.storageCost) +
        BigInt(gasUsed.nonRefundableStorageFee) -
        BigInt(gasUsed.storageRebate)) *
      -1n
    );
  }
}
