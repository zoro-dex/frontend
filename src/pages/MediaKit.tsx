import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { poweredByMiden } from '@/components/PoweredByMiden';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function MediaKit() {
  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col dotted-bg'>
      <title>About - ZoroSwap | DeFi on Miden</title>
      <meta
        name='description'
        content='Media Kit for the ZoroSwap AMM.'
      />
      <meta property='og:title' content='Media Kit - ZoroSwap | DeFi on Miden' />
      <meta
        property='og:description'
        content='Media Kit ZoroSwap AMM: Zero MEV, minimal slippage, complete privacy.'
      />
      <meta name='twitter:title' content='Media Kit - ZoroSwap | DeFi on Miden' />
      <meta
        name='twitter:description'
        content='Media Kit ZoroSwap AMM: Zero MEV, minimal slippage, complete privacy.'
      />
      <Header />
      <main className='flex-1 flex items-center justify-center p-4 sm:mt-10'>
        <div className='w-full text-left max-w-2xl sm:max-w-2xl space-y-2 sm:space-y-4'>
          <div className='space-y-5 sm:space-y-6'>
            <h1 className='text-2xl sm:text-3xl font-bold'>
              Media Kit
            </h1>
            <p>
              We have compiled a basic media kit on this page. For any inquiries you can
              reach out to{' '}
              <a
                className={'text-primary hover:text-foreground'}
                href={'mailto:support@zoroswap.com'}
              >
                support@zoroswap.com
              </a>.
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              Description
            </h2>
            <p>
              Zoro Swap is a next-generation AMM built for{' '}
              <a
                href={'https://miden.xyz/'}
                target='_blank'
                className='text-primary hover:text-foreground'
              >
                the Miden blockchain
              </a>. We leverage Miden’s unique capabilities:{' '}
              <em>privacy, local execution, low latency, and high throughput</em>{' '}
              to enable a private, high-frequency AMM (hfAMM).
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              Mission Statement
            </h2>
            <p>
              Zoroswap is set to become the central liquidity hub on Miden, combining the
              best of both passive and active market-making paradigms.
            </p>
            <p>
              Our goal is to challenge centralized exchanges on spot trading without
              sacrificing fundamental features like{' '}
              <em>
                self-custody, decentralisation and lack of intermediaries
              </em>.
            </p>

            <h2 className='text-xl sm:text-2xl font-bold'>
              Branding Assets
            </h2>
            <p>
              <div className={'flex items-center gap-5 justify-center'}>
                <div className={'gap-6 flex flex-col items-center justify-center'}>
                  <img
                    src='/zoro-logo-full.svg'
                    alt='Zoro logo'
                    title='ZoroSwap'
                    className='size-24 sm:size-36 p-2'
                  />
                  <p className={'text-center'}>
                    Logo with text<br />
                    <a
                      href={'/zoro-logo-full.svg'}
                      target='_blank'
                      className='text-primary hover:text-foreground'
                    >
                      Download
                    </a>
                  </p>
                </div>
                <div className='gap-2 flex flex-col items-center justify-center'>
                  <img
                    src='/zoro-logo.svg'
                    alt='Zoro logo'
                    title='ZoroSwap'
                    className='size-24 sm:size-36 p-2'
                  />
                  <p className={'text-center'}>
                    Zoro figure<br />
                    <a
                      href={'/zoro-logo.svg'}
                      target='_blank'
                      className='text-primary hover:text-foreground'
                    >
                      Download
                    </a>
                  </p>
                </div>
              </div>
            </p>
            <h2 className='text-xl sm:text-2xl font-bold'>
              Color Schema
            </h2>
            <p className='flex gap-4 py-4 flex flex-col'>
              Primary Orange
              <span className='bg-primary inline-block text-white font-semibold p-2 rounded'>
                #ff5601
              </span>
              <br />
              Secondary Grey
              <span className='border-2 bg-secondary inline-block text-black font-semibold p-2 rounded'>
                #b8b6c2
              </span>
            </p>
            <h2 className='text-xl sm:text-2xl font-bold'>
              Product Screenshots
            </h2>
            <p>
              <div className={'flex items-center gap-5 justify-center'}>
                <div className={'gap-2 flex flex-col items-center justify-center'}>
                  <img
                    src='/media-kit/zoroswap-screenshot-light.png'
                    alt='Zoro logo'
                    title='ZoroSwap'
                    className='h-64 w-64 sm:h-64 sm:w-64'
                  />
                  <p className={'text-center'}>
                    Light Theme<br />
                    <a
                      href={'/media-kit/zoroswap-screenshot-light.png'}
                      target='_blank'
                      className='text-primary hover:text-foreground'
                    >
                      Download
                    </a>
                  </p>
                </div>
                <div className='gap-2 flex flex-col items-center justify-center'>
                  <img
                    src='/media-kit/zoroswap-screenshot-dark.png'
                    alt='Zoro logo'
                    title='ZoroSwap'
                    className='h-64 w-64 sm:h-64 sm:w-64'
                  />
                  <p className={'text-center'}>
                    Dark Theme<br />
                    <a
                      href={'/media-kit/zoroswap-screenshot-dark.png'}
                      target='_blank'
                      className='text-primary hover:text-foreground'
                    >
                      Download
                    </a>
                  </p>
                </div>
              </div>
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

export default MediaKit;
