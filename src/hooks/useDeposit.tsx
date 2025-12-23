import { API } from '@/lib/config';
import { compileDepositTransaction } from '@/lib/ZoroDepositNote';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { TransactionType, useWallet } from '@demox-labs/miden-wallet-adapter';
import { useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const useDeposit = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const { requestTransaction } = useWallet();
  const [txId, setTxId] = useState<undefined | string>();
  const [noteId, setNoteId] = useState<undefined | string>();
  const { client, accountId, poolAccountId } = useContext(ZoroContext);

  const deposit = useCallback(async ({
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
      const { tx, noteId, note } = await compileDepositTransaction({
        amount,
        poolAccountId,
        token,
        minAmountOut: minAmountOut,
        userAccountId: accountId,
        client,
      });
      console.log('Compiled note');
      const txId = await requestTransaction({
        type: TransactionType.Custom,
        payload: tx,
      });
      console.log('Requested TX');
      await client.syncState();
      console.log('Syncing client');
      let serialized = btoa(
        String.fromCharCode.apply(null, note.serialize() as unknown as number[]),
      );
      console.log('Sending serialized');
      await new Promise(r => setTimeout(r, 20000));
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

  const value = useMemo(() => ({ deposit, isLoading, error, txId, noteId }), [
    deposit,
    error,
    isLoading,
    txId,
    noteId,
  ]);

  return value;
};

async function submitNoteToServer(serializedNote: string) {
  try {
    console.log('Submitting deposit note to server');
    const response = await fetch(`${API.endpoint}/deposit/submit`, {
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
    const result = await response.json();
    console.log('Note submitted to server:', result);
  } catch (error) {
    console.error('Failed to submit note to server:', error);
    throw error;
  }
}
