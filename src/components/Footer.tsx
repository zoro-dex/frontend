import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className={`flex items-center justify-center p-4`}>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <a
          href="https://github.com/zoro-dex"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <img 
            src="/github-mark.svg" 
            alt="GitHub" 
            className="w-4 h-4 dark:hidden"
          />
          <img 
            src="/github-mark-white.svg" 
            alt="GitHub" 
            className="w-4 h-4 hidden dark:block"
          />
        </a>
      </Button>
    </footer>
  );
}