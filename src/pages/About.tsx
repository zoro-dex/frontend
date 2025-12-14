import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {Helmet} from "react-helmet-async";

function About() {
  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col dotted-bg'>
      <Helmet>
          <title>About Zoro DEX: Next-Gen AMM on Miden</title>
          <meta name="description" content="About the Zoro Swap AMM: Zero MEV, minimal slippage, complete privacy." />
          <meta property="og:title" content="Zoro Swap – DeFi on Miden" />
          <meta property="og:description" content="About the Zoro Swap AMM: Zero MEV, minimal slippage, complete privacy." />
          <meta name="twitter:title" content="Zoro Swap – DeFi on Miden" />
          <meta name="twitter:description" content="About the Zoro Swap AMM: Zero MEV, minimal slippage, complete privacy." />
      </Helmet>
      <Header />
      <main className='flex-1 flex items-center justify-center p-4 mt-10'>
        <div className='w-full text-left max-w-2xl sm:max-w-2xl space-y-2 sm:space-y-4'>
          <div className='space-y-4 font-cal-sans'>
              <h2 className='text-3xl font-bold'>
                  About Us
              </h2>
              <p className='text-xl'>
                  Zoro Swap is a next-generation AMM built for <a href={"https://miden.xyz/"} target="_blank" className="text-primary hover:text-foreground">the Miden blockchain</a>.
                  We combine both passive and actively priced liquidity pools under one unified platform.
              </p>
              <p className='text-xl'>
                  While most blockchains rely on traditional passive AMMs, these models suffer from inefficiencies that require large liquidity incentives and complex liquidity management.
              </p>
              <p className='text-xl'>
                  Actively priced AMMs are emerging as the more efficient alternative, especially for high-volume asset pairs. Zoro brings both approaches to Miden, delivering deep liquidity, ease of integration, and advanced pricing in one place.
              </p>

              <h2 className='text-3xl font-bold'>
                  High-Performance & Private
              </h2>
              <p className='text-xl'>
                  Zoro leverages Miden’s unique capabilities: <em>privacy, local execution, low latency, and high throughput</em>.
                  Using these we enable a private, high-frequency AMM (hfAMM).
              </p>
              <p className='text-xl'>
                  Orders are matched and aggregated off-chain in a secure private environment, enabling minimized slippage, MEV protection, boosted capital efficiency, and faster execution than traditional on-chain DEXes.
              </p>

              <h2 className='text-3xl font-bold'>
                  Efficient Liquidity
              </h2>
              <p className='text-xl'>
                Actively priced pools require far less TVL than traditional AMMs while generating strong fee APRs.
                  This reduces reliance on incentives and improving long-term sustainability.
              </p>

              <h2 className='text-3xl font-bold'>
                  Built for Miden’s DeFi Ecosystem
              </h2>
              <p className='text-xl'>
                By providing both robust passive pools and advanced high-frequency private pools, Zoro serves everyone from everyday traders to institutions, helping drive the growth of the broader Miden ecosystem.
              </p>
          </div>
          <div className='pt-4'>
            <Link to='/'>
              <Button
                variant='secondary'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors'
              >
                ← Get back
              </Button>
            </Link>
          </div>
            {/* Powered by MIDEN */}
            <div className="flex items-center justify-center">
                <a href={"https://miden.xyz/"} target="_blank">
                    <img alt={"Miden blockchain"} title={"Powered by Miden blockchain"} width="118" height="16" src={"/powered-by-miden-blockchain.svg"} />
                </a>
            </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default About;
