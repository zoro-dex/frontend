import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <div className='flex items-start justify-center p-4 relative'>
      {/* Testnet badge - top left */}
      <div className='absolute left-4 top-4'>
        <div className='bg-muted/60 text-muted-foreground px-3 py-2 rounded-lg text-xs font-medium border border-border/50'>
          testnet 0.12.5
        </div>
      </div>

      {/* Centered logo and title */}
      <Link to='/' className='flex flex-col items-center gap-1'>
        <h1 className='font-cal-sans text-2xl sm:text-3xl font-bold text-foreground'>
          <img
            src='/zoro-logo-full.svg'
            alt='Zoro logo'
            title='ZoroSwap'
            className='h-16 w-16 sm:h-20 sm:w-20'
          />
        </h1>
      </Link>

      <div className='absolute right-4 top-4'>
        <WalletMultiButton className='!p-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-md !text-muted-foreground !border-none hover:!text-foreground hover:!bg-gray-500/10' />
      </div>
    </div>
  );
}
