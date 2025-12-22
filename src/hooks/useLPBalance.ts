import { emptyFn } from '@/utils/shared';
import { useMemo } from 'react';

export const useLPBalance = () => {
  const value = useMemo(() => ({
    balance: BigInt(0),
    refetch: emptyFn,
  }), []);
  return value;
};
