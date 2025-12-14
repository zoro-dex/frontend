import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { Link } from 'react-router-dom';

export function Header() {
  return (
      <div className="flex items-start justify-center p-4 relative">
          {/* Testnet badge - top left */}
          <div className="absolute left-4 top-4">
              <div
                  className="bg-muted/60 text-muted-foreground px-3 py-2 rounded-lg text-xs font-medium border border-border/50">
                  testnet v.012
              </div>
          </div>

          {/* Centered logo and title */}
          <Link to="/" className="flex flex-col items-center gap-1">
              <div className="p-1 sm:p-2 rounded-xl">
                  <img
                      src="/zoro-dex-logo.svg"
                      alt="Zoro DeFi"
                      className="h-12 w-12 sm:h-16 sm:w-16"
                  />
              </div>
              <h1 className="font-cal-sans text-2xl sm:text-3xl font-bold text-foreground">
                  Zoro Swap
              </h1>
          </Link>

          <div className="absolute right-4 top-4">
              <WalletMultiButton
                  className="!p-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-md !text-muted-foreground !border-none hover:!text-foreground hover:!bg-gray-500/10"/>
          </div>
      </div>
  );
}