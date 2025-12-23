import { safeAccountImport } from '@/lib/utils';
import { ZoroContext } from '@/providers/ZoroContext';
import type { TokenConfig } from '@/providers/ZoroProvider';
import { Felt, Word } from '@demox-labs/miden-sdk';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const useLPBalance = ({ token }: { token?: TokenConfig }) => {
  const { client, poolAccountId, accountId } = useContext(ZoroContext);
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  const refetch = useCallback(async () => {
    if (!poolAccountId || !client || !accountId || !token) return;
    await safeAccountImport(client, poolAccountId);
    const account = await client.getAccount(poolAccountId);
    const storage = account?.storage();
    console.log(storage);

    const lp = storage?.getMapItem(
      11,
      Word.newFromFelts([
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(accountId.suffix().asInt()),
        new Felt(accountId.prefix().asInt()),
      ]),
    )?.toFelts();
    const mapping = storage?.getMapItem(
      9,
      Word.newFromFelts([
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
      ]),
    );
    console.log('MAP', mapping);
    const lpSupply = storage?.getMapItem(
      11,
      mapping as Word,
    )?.toFelts();
    const balance = lp?.[0].asInt() ?? BigInt(0);
    const totalSupply = lpSupply?.[0].asInt() ?? BigInt(0);
    console.log('new LP:', balance, totalSupply);
    setBalance(balance);
  }, [poolAccountId, client, accountId, token]);

  useEffect(() => {
    refetch();
    const clear = setInterval(refetch, 10000);
    return () => clearInterval(clear);
  }, [refetch]);

  const value = useMemo(() => ({
    balance,
    refetch,
  }), [balance, refetch]);
  return value;
};
