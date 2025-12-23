import { API } from '@/lib/config';
import { compileSwapTransaction, serializeNote } from '@/lib/ZoroSwapNote';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type SwapStatus = 'idle' | 'signing' | 'confirming' | 'submitting' | 'done';

async function waitForTransactionPropagation(client: WebClient): Promise<void> {
  // Sync state twice with a delay to ensure the transaction has propagated
  // todo use a loop here and check for commitment instead of these arbitrary 2secs
  await client.syncState();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await client.syncState();
}

export const useSwap = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState<undefined | string>();
  const [noteId, setNoteId] = useState<undefined | string>();
  const { client, accountId, poolAccountId } = useContext(ZoroContext);
  const { requestTransaction } = useWallet();

  const swap = useCallback(async ({
    amount,
    minAmountOut,
    sellToken,
    buyToken,
  }: {
    amount: bigint;
    minAmountOut: bigint;
    buyToken: TokenConfig;
    sellToken: TokenConfig;
  }) => {
    if (!poolAccountId || !accountId || !client || !requestTransaction) {
      return;
    }
    setError('');
    setIsLoading(true);
    setStatus('idle');
    try {
      // Create the private swap note and transaction
      const { tx, noteId, note } = await compileSwapTransaction({
        amount,
        poolAccountId,
        buyToken,
        sellToken,
        minAmountOut: minAmountOut,
        userAccountId: accountId,
        client,
      });

      // Submit transaction to wallet (creates note on-chain)
      setStatus('signing');
      await requestTransaction(tx);

      // Wait for transaction to propagate to Miden node
      setStatus('confirming');
      await waitForTransactionPropagation(client);

      // Serialize and submit note details to backend via HTTP
      setStatus('submitting');
      const serializedNote = serializeNote(note);
      const response = await fetch(`${API.endpoint}/orders/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_data: serializedNote }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to submit order');
      }

      setStatus('done');
      setNoteId(noteId);
      setOrderId(result.order_id);
    } catch (err) {
      console.error(err);
      toast.error(
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>Error swapping</p>
          <p style={{ fontSize: '.875rem', opacity: 0.9 }}>
            {`${err}`}
          </p>
        </div>,
      );
    } finally {
      setIsLoading(false);
      setStatus('idle');
    }
  }, [client, accountId, poolAccountId, requestTransaction]);

  const value = useMemo(() => ({ swap, isLoading, status, error, orderId, noteId }), [
    swap,
    error,
    isLoading,
    status,
    orderId,
    noteId,
  ]);

  return value;
};
