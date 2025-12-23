import { ZoroContext } from '@/providers/ZoroContext';
import type { TokenConfig } from '@/providers/ZoroProvider';
import { Felt, Word } from '@demox-labs/miden-sdk';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const useLPBalance = ({ token }: { token?: TokenConfig }) => {
  const { client, poolAccountId, accountId } = useContext(ZoroContext);
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    refetch();
  }, [client, poolAccountId, accountId]);

  const refetch = useCallback(async () => {
    if (!poolAccountId || !client || !accountId || !token) return;
    const account = await client.getAccount(poolAccountId);
    const storage = account?.storage();
    const lp = storage?.getMapItem(
      11,
      Word.newFromFelts([
        new Felt(token.faucetId.prefix().asInt()),
        new Felt(token.faucetId.suffix().asInt()),
        new Felt(accountId.prefix().asInt()),
        new Felt(accountId.suffix().asInt()),
      ]),
    )?.toFelts();
    console.log('new LP:', lp);
    const balance = lp?.[0].asInt() ?? BigInt(0);
    setBalance(balance);
  }, [poolAccountId, client, accountId, token]);

  const value = useMemo(() => ({
    balance,
    refetch,
  }), [balance, refetch]);
  return value;
};
