import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
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
        </div>
        </Link>

      {/* Right */}
      <div className="flex items-center gap-2">
          <WalletMultiButton className="!p-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-md !text-muted-foreground !border-none hover:!text-foreground hover:!bg-gray-500/10" />
      </div>
    </div>
  );
}