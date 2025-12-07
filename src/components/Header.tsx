import { Link } from 'react-router-dom';

export function Header() {
  return (
    <div className="flex items-start justify-center p-4 sm:p-6 relative">
      {/* Testnet badge - top left */}
      <div className="absolute left-4 top-4">
        <div className="bg-muted/60 text-muted-foreground px-3 py-2 rounded-lg text-xs font-medium border border-border/50">
          testnet v.012
        </div>
      </div>

      {/* Centered logo and title */}
      <Link to="/" className="flex flex-col items-center gap-2">
        <div className="p-3 sm:p-4 rounded-xl">
          <img
            src="/zoro-orange.svg"
            alt="Zoro"
            className="h-8 w-8 sm:h-10 sm:w-10"
          />
        </div>
        <h1 className="font-cal-sans text-2xl sm:text-3xl font-bold text-foreground">
          Zoro Swap
        </h1>
      </Link>
    </div>
  );
}