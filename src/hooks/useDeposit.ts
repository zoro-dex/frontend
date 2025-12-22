import { emptyFn } from '@/utils/shared';
import { useMemo } from 'react';
import type { PoolInfo } from './usePoolsInfo';

export const useDeposit = ({ pool, slippage }: { pool: PoolInfo; slippage: number }) => {
  const value = useMemo(() => ({
    isLoading: false,
    deposit: async ({ amount }: { amount: bigint }) => emptyFn(),
  }), []);
  return value;
};
