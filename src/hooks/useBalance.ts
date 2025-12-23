import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { prettyBigintFormat } from '@/utils/format';
import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface BalanceParams {
  token?: TokenConfig;
}

const getBalanceFromClient = async (
  client: WebClient,
  faucetId: AccountId,
  accountId?: AccountId,
) => {
  if (accountId == null) return BigInt(0);
  const acc = await client.getAccount(accountId);
  console.log(acc);
  const balance = acc?.vault().getBalance(faucetId);
  return balance;
};

export const useBalance = (
  { token }: BalanceParams,
) => {
  const { client, accountId } = useContext(ZoroContext);
  const [balance, setBalance] = useState<bigint | null>(null);
  const faucetId = token?.faucetId;
  console.log(token?.faucetIdBech32);
  const refetch = useCallback(async () => {
    if (!accountId || !faucetId || !client) return;
    await client.syncState();
    const newBalance = await getBalanceFromClient(client, faucetId, accountId);
    setBalance(BigInt(newBalance ?? 0));
  }, [accountId, client, faucetId]);

  useEffect(() => {
    refetch();
    const clear = setInterval(refetch, 10000);
    return () => clearInterval(clear);
  }, [refetch]);

  const value = useMemo(() => ({
    balance,
    refetch,
    formatted: prettyBigintFormat({
      value: balance || undefined,
      expo: token?.decimals || 0,
    }),
  }), [
    balance,
    refetch,
    token,
  ]);

  return value;
};
