import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter-reactui';
import { useTheme } from "@/components/theme-provider";

export function Header() {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-between p-3 sm:p-4">
      {/* Left */}
      <div className="flex items-center gap-1">
        <img 
          src="/blackhatmini.png" 
          alt="Zoro Hat" 
          className={`h-12 w-auto mirror-x ${theme === 'light' ? 'invert' : ''}`}
        />
        <img 
          src="/logotype.png" 
          alt="Zoro Logotype" 
          className={`h-4 w-auto hidden lg:block ${theme === 'light' ? 'invert' : ''}`}
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
          <WalletMultiButton className="z-10 !py-3 sm:!py-4 !rounded-xl !font-medium !text-sm sm:!text-lg !bg-transparent !border-none !text-muted-foreground hover:!text-foreground hover:!bg-gray-500/10" />
      </div>
    </div>
  );
}