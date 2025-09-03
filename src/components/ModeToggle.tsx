import { Button } from '@/components/ui/button';
import { ThemeProviderContext } from '@/providers/ThemeProvider';
import { Moon, Sun } from 'lucide-react';
import { useContext } from 'react';

export function ModeToggle() {
  const { theme, setTheme } = useContext(ThemeProviderContext);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <Button variant='ghost' size='icon' onClick={toggleTheme} className="z-20">
      <Sun className='h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
      <Moon className='absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
}
