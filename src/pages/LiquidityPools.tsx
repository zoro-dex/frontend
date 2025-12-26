import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import LiquidityPoolsTable from '@/components/LiquidityPoolsTable';
import { OracleContext } from '@/providers/OracleContext';
import { ZoroContext } from '@/providers/ZoroContext';
import { useContext, useEffect, useMemo } from 'react';

function LiquidityPools() {
  const { liquidity_pools } = useContext(ZoroContext);
  const { refreshPrices } = useContext(OracleContext);
  const priceIds = useMemo(() => {
    return liquidity_pools.map(p => p.oracleId);
  }, [liquidity_pools]);

  useEffect(() => {
    refreshPrices(priceIds);
    const interval = setInterval(() => {
      refreshPrices(priceIds);
    }, 20000);
    return () => {
      clearInterval(interval);
    };
  }, [
    priceIds,
    refreshPrices,
  ]);

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col dotted-bg'>
      <title>Pools - ZoroSwap | DeFi on Miden</title>
      <meta
        name='description'
        content='Deposit to ZoroSwap pools to earn attractive yield'
      />
      <meta property='og:title' content='About - ZoroSwap | DeFi on Miden' />
      <meta
        property='og:description'
        content='Deposit to ZoroSwap pools to earn attractive yield'
      />
      <meta name='twitter:title' content='About - ZoroSwap | DeFi on Miden' />
      <meta
        name='twitter:description'
        content='Deposit to ZoroSwap pools to earn attractive yield'
      />
      <Header />
      <main className='flex flex-1 items-center justify-center p-4 sm:mt-10'>
        <LiquidityPoolsTable />
      </main>
      <Footer />
    </div>
  );
}

export default LiquidityPools;
