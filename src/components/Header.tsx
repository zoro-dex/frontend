import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter-reactui';
import { Link } from 'react-router-dom';

export function Header() {

  return (
    <div className="flex items-center justify-between p-4 z-10">
      {/* Left */}
      <Link to="/">
        <div className="flex items-center gap-1">
        <img 
            src="/Zoro_logo_final3.svg" 
            alt="Zoro Hat" 
            className="h-8 w-auto mirror-x"
          />

          {/* WE NEED A LOGOTYPE WITH A THINNER Z - THIS TOO CLUNKY, NO ELEGANCE */}
          {/* <p className="font-cal-sans text-3xl hidden xl:block">Zoro</p> */}

          {/* THIS IS AN EVEN OLDER LOGOTYPE, MAYBE THIS KIND OF Z IS BETTER? */}
          {/* <img 
            src="/logotype.png" 
            alt="Zoro Logotype" 
            className={`h-6 w-auto hidden xl:block ${theme === 'light' ? 'invert' : ''}`}
          />  */}
        </div>
        </Link>

      {/* Right */}
      <div className="flex items-center gap-2">
          <WalletMultiButton className="!py-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !border-none !text-muted-foreground hover:!text-foreground hover:!bg-gray-500/10" />
      </div>
    </div>
  );
}