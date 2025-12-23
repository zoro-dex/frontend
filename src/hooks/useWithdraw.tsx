import { compileWithdrawTransaction } from '@/lib/ZoroWithdrawNote';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { TransactionType, useWallet } from '@demox-labs/miden-wallet-adapter';
import { useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const useWithdraw = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const { requestTransaction } = useWallet();
  const [txId, setTxId] = useState<undefined | string>();
  const [noteId, setNoteId] = useState<undefined | string>();
  const { client, accountId, poolAccountId } = useContext(ZoroContext);

  const withdraw = useCallback(async ({
    amount,
    minAmountOut,
    token,
  }: {
    amount: bigint;
    minAmountOut: bigint;
    token: TokenConfig;
  }) => {
    if (!poolAccountId || !accountId || !client || !requestTransaction) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const { tx, noteId } = await compileWithdrawTransaction({
        amount,
        poolAccountId,
        token,
        minAmountOut: minAmountOut,
        userAccountId: accountId,
        client,
      });
      const txId = await requestTransaction({
        type: TransactionType.Custom,
        payload: tx,
      });
      await client.syncState();
      setNoteId(noteId);
      setTxId(txId);
    } catch (err) {
      console.error(err);
      toast.error(
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>Error withdrawing</p>
          <p style={{ fontSize: '.875rem', opacity: 0.9 }}>
            {`${err}`}
          </p>
        </div>,
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, accountId, poolAccountId, requestTransaction]);

  const value = useMemo(() => ({ withdraw, isLoading, error, txId, noteId }), [
    withdraw,
    error,
    isLoading,
    txId,
    noteId,
  ]);

  return value;
};
