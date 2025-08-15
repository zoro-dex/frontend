import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ZoroLandingPage() {
  const [currentPhrase, setCurrentPhrase] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(true);
  
  const phrases: string[] = [
    "Compiling Notes...",
    "Sharpening the Frontend...", 
    "Weaving the Backend...",
    "Having fun with MASM...",
    "Cooking the greatest AMM the world has ever seen..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % phrases.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [phrases.length]);

  // Apply theme to document root
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = (): void => {
    setIsDark(!isDark);
  };

  const logo = isDark ? '/zoro_for_black_bg.svg' : '/zoro_for_white_bg.svg';

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden transition-colors duration-300">
      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 p-2 sm:p-3 rounded-full bg-card hover:bg-accent transition-colors border shadow-lg"
      >
        <Sun className="h-4 w-4 sm:h-5 sm:w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute top-2 left-2 sm:top-3 sm:left-3 h-4 w-4 sm:h-5 sm:w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </button>


      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 text-center">
        {/* Logo/Brand */}
        <div className="mb-6 sm:mb-8 font-cal-sans">
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <img 
              src={logo}
              alt="Zoro Hat" 
              className={`h-12 sm:h-16 lg:h-20 w-auto`}
            />
          </div> 
          <br />
          <div className="text-3xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Zoro Swap
          </div>
          <div className="text-sm sm:text-lg lg:text-xl text-muted-foreground mt-2 font-medium">
            The Edge DEX on Miden.
          </div>
        </div>

        {/* Main message */}
        <div className="max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 leading-tight px-2">
            Getting ready for truly private trading.
          </h1>
          
          {/* Animated status text */}
          <div className="h-6 sm:h-8 mb-6 sm:mb-8">
            <p className="text-sm sm:text-base lg:text-lg text-accent animate-pulse transition-all duration-500">
              {phrases[currentPhrase]}
            </p>
          </div>

          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg leading-relaxed px-2">
            Zoro is mastering the art of decentralized token trading. 
            Soon, swaps will cut through the market with precision and <i>silence</i>.
          </p>
        </div>

        {/* Call to action */}
        <div className="space-y-3 sm:space-y-4">
          <p className="bg-primary hover:bg-primary/90 text-primary-foreground py-3 sm:py-4 px-6 sm:px-8 text-sm sm:text-base rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
            help@zoroswap.com
          </p>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-24 lg:h-32 bg-gradient-to-t from-background/50 to-transparent" />
    </div>
  );
}