import { Transaction } from '@mysten/sui/transactions';

export interface DryRunArgs {
  tx: Transaction;
  coinInType: string;
  coinInAmount: bigint;
  coinOutType: string;
  coinOutAmount?: bigint;
  checkObjectChanges?: boolean;
  gasBudget?: bigint;
}
