import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { poweredByMiden } from '@/components/PoweredByMiden';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function About() {
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
        <div className='w-full text-left max-w-2xl sm:max-w-2xl space-y-2 sm:space-y-4'>
          <div className='space-y-5 sm:space-y-6'>
            <h1 className='text-2xl sm:text-3xl font-bold'>
              About Us
            </h1>
            <p>
              Zoro Swap is a next-generation AMM built for{' '}
              <a
                href={'https://miden.xyz/'}
                target='_blank'
                className='text-primary hover:text-foreground'
              >
                the Miden blockchain
              </a>. We combine both passive and actively priced liquidity pools under one
              unified platform.
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              High-Performance & Private
            </h2>
            <p>
              Zoro leverages Miden’s unique capabilities:{' '}
              <em>privacy, local execution, low latency, and high throughput</em>. Using
              these we enable a private, high-frequency AMM (hfAMM).
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              Efficient Liquidity
            </h2>
            <p>
              Actively priced pools require far less TVL than traditional AMMs while
              generating strong fee APRs. This reduces reliance on incentives and
              improving long-term sustainability.
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              Built for Miden’s DeFi Ecosystem
            </h2>
            <p>
              By providing both robust passive pools and advanced high-frequency private
              pools, Zoro serves everyone from everyday traders to institutions, helping
              drive the growth of the broader Miden ecosystem.
            </p>
          </div>
          <div className='pt-8 sm:pt-4 pb-2 sm:pb-0 flex sm:justify-start justify-center sm:items-start'>
            <Link to='/'>
              <Button
                variant='secondary'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors'
              >
                ← Back to Swap
              </Button>
            </Link>
          </div>
          {/* Powered by MIDEN */}
          <div className='flex items-center justify-center'>
            {poweredByMiden}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default About;
