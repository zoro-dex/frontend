import { API } from '@/lib/config';
import { compileDepositTransaction } from '@/lib/ZoroDepositNote';
import { compileWithdrawTransaction } from '@/lib/ZoroWithdrawNote';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
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
      const { tx, noteId, note } = await compileWithdrawTransaction({
        amount,
        poolAccountId,
        token,
        minAmountOut: minAmountOut,
        userAccountId: accountId,
        client,
      });
      const txId = await requestTransaction(tx);
      await client.syncState();
      let serialized = btoa(
        String.fromCharCode.apply(null, note.serialize() as unknown as number[]),
      );
      await new Promise(r => setTimeout(r, 10000));
      await submitNoteToServer(serialized);
      setNoteId(noteId);
      setTxId(txId);
    } catch (err) {
      console.error(err);
      toast.error(
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>Error depositing</p>
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

async function submitNoteToServer(serializedNote: string) {
  try {
    const response = await fetch(`${API.endpoint}/withdraw/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note_data: serializedNote,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Failed to submit note to server:', error);
    throw error;
  }
}
