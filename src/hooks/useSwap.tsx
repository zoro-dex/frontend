import { API } from '@/lib/config';
import { compileSwapTransaction, serializeNote } from '@/lib/ZoroSwapNote';
import { ZoroContext } from '@/providers/ZoroContext';
import { type TokenConfig } from '@/providers/ZoroProvider';
import { useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const useSwap = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState<undefined | string>();
  const [noteId, setNoteId] = useState<undefined | string>();
  const { client, accountId, poolAccountId } = useContext(ZoroContext);

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
    if (!poolAccountId || !accountId || !client) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      // Create the private swap note
      const { noteId, note } = await compileSwapTransaction({
        amount,
        poolAccountId,
        buyToken,
        sellToken,
        minAmountOut: minAmountOut,
        userAccountId: accountId,
        client,
      });

      // Serialize and submit to backend via HTTP
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
    }
  }, [client, accountId, poolAccountId]);

  const value = useMemo(() => ({ swap, isLoading, error, orderId, noteId }), [
    swap,
    error,
    isLoading,
    orderId,
    noteId,
  ]);

  return value;
};
