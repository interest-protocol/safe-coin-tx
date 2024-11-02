import { SuiClient, DryRunTransactionBlockResponse } from '@mysten/sui/client';

import { Transaction } from '@mysten/sui/transactions';
import util from 'util';

import {
  normalizeStructTag,
  normalizeSuiAddress,
  SUI_TYPE_ARG,
} from '@mysten/sui/utils';
import invariant from 'tiny-invariant';
import { suiClient, isOwnedByAddress } from './utils';

export interface CheckTxArgs {
  tx: Transaction;
  coinInType: string;
  coinInAmount: bigint;
  coinOutType?: string;
  coinOutAmount?: bigint;
  checkObjectChanges?: boolean;
}

export const log = (x: unknown) =>
  console.log(util.inspect(x, false, null, true));

export class SafeCoinTx {
  #client: SuiClient;
  #suiCoinType = normalizeStructTag(SUI_TYPE_ARG);
  #coinType = '0x2::coin::Coin';

  constructor(client: SuiClient = suiClient) {
    this.#client = client;
  }

  async checkTx({
    tx,
    coinInType,
    coinInAmount,
    coinOutType,
    coinOutAmount,
    checkObjectChanges = true,
  }: CheckTxArgs): Promise<boolean> {
    try {
      const result = await this.#client.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: this.#client }),
      });

      invariant(
        result.effects.status.status === 'success',
        'Transaction failed'
      );

      this.#verifyCoinBalanceChange(result, {
        coinInType,
        coinInAmount,
        coinOutType,
        coinOutAmount,
      });

      if (checkObjectChanges) this.#verifyObjectChanges(result);

      return true;
    } catch {
      return false;
    }
  }

  #verifyCoinBalanceChange(
    result: DryRunTransactionBlockResponse,
    {
      coinInType,
      coinInAmount,
      coinOutType,
      coinOutAmount,
    }: Omit<CheckTxArgs, 'tx' | 'checkObjectChanges'>
  ) {
    coinInAmount = coinInAmount * -1n;

    coinInType = normalizeStructTag(coinInType);

    const sender = normalizeSuiAddress(result.input.sender);

    const totalGasUsed = this.#calculateGasUsed(result);

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
        'Too much coin was sold'
      );
      invariant(
        balanceChangesMap[this.#suiCoinType] >= totalGasUsed,
        'Too much gas was used'
      );
      invariant(
        totalGasUsed >= suiChangeAmount,
        'The amount of gas used is too high'
      );
    }

    if (coinOutType && coinOutAmount) {
      invariant(
        balanceChangesMap[coinOutType] >= coinOutAmount,
        'The amount of coin sold does not match the amount of coin bought'
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
          'Object change is missing objectType property'
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
