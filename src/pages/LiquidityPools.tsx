import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

function LiquidityPools() {
  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col dotted-bg'>
      <title>About - ZoroSwap | DeFi on Miden</title>
      <meta
        name='description'
        content='About ZoroSwap AMM: Zero MEV, minimal slippage, complete privacy.'
      />
      <meta property='og:title' content='About - ZoroSwap | DeFi on Miden' />
      <meta
        property='og:description'
        content='About ZoroSwap AMM: Zero MEV, minimal slippage, complete privacy.'
      />
      <meta name='twitter:title' content='About - ZoroSwap | DeFi on Miden' />
      <meta
        name='twitter:description'
        content='About ZoroSwap AMM: Zero MEV, minimal slippage, complete privacy.'
      />
      <Header />
      <main className='flex-1 flex items-center justify-center p-4 sm:mt-10'>
        TODO
      </main>
      <Footer />
    </div>
  );
}

export default LiquidityPools;
