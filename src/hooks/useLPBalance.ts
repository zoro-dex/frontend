import { ZoroContext } from '@/providers/ZoroContext';
import type { TokenConfig } from '@/providers/ZoroProvider';
import { Felt, Word } from '@demox-labs/miden-sdk';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const useLPBalance = ({ token }: { token?: TokenConfig }) => {
  const { client, poolAccountId, accountId, getAccount } = useContext(ZoroContext);
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  const refetch = useCallback(async () => {
    if (!poolAccountId || !client || !accountId || !token) return;
    const account = await getAccount(poolAccountId);
    const storage = account?.storage();
    const lp = storage?.getMapItem(
      11,
      Word.newFromFelts([
        new Felt(accountId.suffix().asInt()),
        new Felt(accountId.prefix().asInt()),
        new Felt(token.faucetId.suffix().asInt()),
        new Felt(token.faucetId.prefix().asInt()),
      ]),
    )?.toFelts();
    const balance = BigInt(lp?.[0].asInt() || BigInt(0)) ?? BigInt(0);
    setBalance(balance);
  }, [poolAccountId, client, accountId, token, getAccount]);

  useEffect(() => {
    refetch();
    const refresh = setInterval(refetch, 10000);
    return () => clearInterval(refresh);
  }, [refetch]);

  const value = useMemo(() => ({
    balance,
    refetch,
  }), [balance, refetch]);
  return value;
};
