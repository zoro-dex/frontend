import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter-reactui';

export function Header() {

  return (
    <div className="flex items-center justify-between p-3 sm:p-4">
      {/* Left */}
      <div className="flex items-center">
        <img 
          src="/whitehatmini.png" 
          alt="Zoro Logo" 
          className="h-8 w-auto"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
          <WalletMultiButton className="z-10 !py-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !border-none !text-muted-foreground hover:!text-foreground hover:!bg-gray-500/10" />
      </div>

    </div>
  );
}