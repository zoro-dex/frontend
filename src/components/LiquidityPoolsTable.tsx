import { usePoolsBalances } from '@/hooks/usePoolsBalances';
import { type PoolInfo, usePoolsInfo } from '@/hooks/usePoolsInfo';
import { useOrderUpdates } from '@/hooks/useWebSocket';
import { ModalContext } from '@/providers/ModalContext';
import { useCallback, useContext, useRef, useState } from 'react';
import LiquidityPoolRow from './LiquidityPoolRow';
import { type LpDetails, OrderStatus, type TxResult } from './OrderStatus';
import PoolModal from './PoolModal';
import { poweredByMiden } from './PoweredByMiden';
import { Card } from './ui/card';

const LiquidityPoolsTable = () => {
  const { data: poolsInfo, refetch: refetchPoolsInfo } = usePoolsInfo();
  const { data: poolBalances } = usePoolsBalances();
  const modalContext = useContext(ModalContext);
  const lastShownNoteId = useRef<string | undefined>(undefined);
  const [txResult, setTxResult] = useState<undefined | TxResult>();
  const [lpDetails, setLpDetails] = useState<undefined | LpDetails>(undefined);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const { orderStatus } = useOrderUpdates();

  const openOrderStatusModal = useCallback((noteId: string) => {
    lastShownNoteId.current = noteId;
    setIsSuccessModalOpen(true);
  }, []);

  const openPoolManagementModal = useCallback(
    (pool: PoolInfo) => {
      modalContext.openModal(
        <PoolModal
          pool={pool}
          refetchPoolInfo={refetchPoolsInfo}
          setTxResult={setTxResult}
          setLpDetails={setLpDetails}
          onSuccess={openOrderStatusModal}
        />,
      );
    },
    [modalContext, refetchPoolsInfo, openOrderStatusModal],
  );

  return (
    <div className='w-full max-w-[920px]'>
      <Card>
        <h1 className='sr-only'>Liquidity Pools</h1>
        <div className='relative overflow-x-auto bg-neutral-primary-soft shadow-xs rounded-xl'>
          <table className='w-full text-sm text-left rtl:text-right text-body rounded-xl text-xs'>
            <thead>
              <tr>
                <th></th>
                <th>Apr(24h / 7d)</th>
                <th>TVL / Cap</th>
                <th>Saturation</th>
                <th>My position</th>
                <th className='sticky'></th>
              </tr>
            </thead>
            <tbody>
              {poolsInfo?.liquidityPools.map(p => {
                const balances = poolBalances?.find(b =>
                  b.faucetIdBech32 == p.faucetIdBech32
                );
                return balances
                  ? (
                    <LiquidityPoolRow
                      key={p.faucetIdBech32}
                      pool={p}
                      poolBalances={balances}
                      managePool={openPoolManagementModal}
                    />
                  )
                  : (
                    <tr key={p.faucetId + '-skeleton'}>
                      <td>
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className='flex justify-center mt-6'>
        {poweredByMiden}
      </div>
      {isSuccessModalOpen && (
        <OrderStatus
          title={lpDetails?.actionType + ' Order'}
          onClose={() => setIsSuccessModalOpen(false)}
          swapResult={txResult}
          lpDetails={lpDetails}
          orderStatus={txResult?.noteId
            ? orderStatus[txResult.noteId]?.status
            : undefined}
        />
      )}
    </div>
  );
};

export default LiquidityPoolsTable;
