import type { PoolBalance } from '@/hooks/usePoolsBalances';
import type { PoolInfo } from '@/hooks/usePoolsInfo';
import { OracleContext } from '@/providers/OracleContext';
import { formalNumberFormat, prettyBigintFormat } from '@/utils/format';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { useContext } from 'react';
import AssetIcon from './AssetIcon';
import { Button } from './ui/button';

const LiquidityPoolRow = ({
  pool,
  poolBalances,
  managePool,
  className,
}: {
  pool: PoolInfo;
  poolBalances: PoolBalance;
  managePool: (pool: PoolInfo) => void;
  className?: string;
}) => {
  const { connected: isConnected } = useWallet();
  const decimals = pool.decimals;
  const { prices } = useContext(OracleContext);
  const balance = BigInt(0);
  const price = prices[pool.oracleId]?.priceFeed;
  const formattedPrice = formalNumberFormat(price?.value);
  return (
    <tr className={className}>
      <td className=''>
        <div className='flex items-center gap-2'>
          <AssetIcon faucetId={pool.symbol} size={64} />
          <div>
            <h4>{pool.name}</h4>
            <p>
              ${pool.symbol}
            </p>
            <p className='text-xs color-disabled'>
              ${formattedPrice}
            </p>
          </div>
        </div>
      </td>
      <td>n / a</td>
      <td className='px-4 py-3'>
        {prettyBigintFormat({ value: poolBalances.totalLiabilities, expo: decimals })} /
        {' '}
        Inf
      </td>
      <td>{prettyBigintFormat({ value: poolBalances.reserve, expo: decimals })}</td>
      {
        /*<td className={styles.green}>
        {pool.apr24h === 0 ? '<0.01' : pool.apr24h} <small>%</small> /{' '}
        {pool.apr7d === 0 ? '<0.01' : pool.apr7d} <small>%</small>
      </td>*/
      }
      <td
        className={`${!balance || balance < BigInt(10000) ? 'opacity-70' : ''}`}
      >
        {prettyBigintFormat({ value: balance, expo: decimals })}{'  '}
        <small>{pool.symbol}</small>
      </td>
      <td className='max-w-[100px] sticky box-border text-right'>
        <Button
          onClick={() => {
            managePool(pool);
          }}
          size='sm'
          disabled={!isConnected}
        >
          Manage
        </Button>
      </td>
    </tr>
  );
};

export default LiquidityPoolRow;
