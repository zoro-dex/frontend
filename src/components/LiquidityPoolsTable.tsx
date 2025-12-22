import { usePoolsBalances } from '@/hooks/usePoolsBalances';
import { type PoolInfo, usePoolsInfo } from '@/hooks/usePoolsInfo';
import { ModalContext } from '@/providers/ModalContext';
import { useCallback, useContext } from 'react';
import LiquidityPoolRow from './LiquidityPoolRow';
import { Card } from './ui/card';

const LiquidityPoolsTable = () => {
  const { data: poolsInfo, refetch: refetchPoolsInfo } = usePoolsInfo();
  const { data: poolBalances } = usePoolsBalances();
  const modalContext = useContext(ModalContext);

  const openPoolManagementModal = useCallback(
    (pool: PoolInfo) => {
      modalContext.openModal(
        <PoolModal pool={pool} refetchPoolInfo={refetchPoolsInfo} />,
      );
    },
    [modalContext, refetchPoolsInfo],
  );

  return (
    <div className='w-full max-w-[920px]'>
      <Card>
        <h1 className='sr-only'>Liquidity Pools</h1>
        <div className='relative overflow-x-auto bg-neutral-primary-soft shadow-xs rounded-xl'>
          <table className='w-full text-sm text-left rtl:text-right text-body rounded-xl'>
            <thead>
              <tr className='text-xs'>
                <th>Pool</th>
                <th>Apr(24h / 7d)</th>
                <th>Liabilities / Cap</th>
                <th>Reserves</th>
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
    </div>
  );
};

export default LiquidityPoolsTable;
