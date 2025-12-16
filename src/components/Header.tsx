import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { Link } from 'react-router-dom';
import { ModeToggle } from './ModeToggle';

export function Header() {
  return (
    <div className='flex flex-col gap-2 sm:gap-1 sm:flex-row items-start items-center justify-center p-4 relative'>
      {/* Centered logo and title */}
      <Link to='/' className='flex flex-col items-center gap-1'>
        <h1 className='font-cal-sans text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-0'>
          <img
            src='/zoro-logo-full.svg'
            alt='Zoro logo'
            title='ZoroSwap'
            className='h-16 w-16 sm:h-20 sm:w-20'
          />
        </h1>
      </Link>
      {/* Testnet badge - top left */}
      <div className='sm:absolute left-4 top-4 flex gap-2'>
        <div className='bg-muted/60 text-muted-foreground px-3 py-2 rounded-lg text-xs border border-border/50'>
          testnet 0.12
        </div>
        <ModeToggle />
      </div>
      <div className='sm:absolute right-4 top-4'>
        <WalletMultiButton className='!p-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-md !text-muted-foreground !border-none hover:!text-foreground hover:!bg-gray-500/10' />
      </div>
    </div>
  );
}
