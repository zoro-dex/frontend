import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className={`flex items-center justify-center p-4`}>
      <div className="flex items-center gap-2">
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

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <a
            href="https://twitter.com/zoroswap"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <svg 
              className="w-4 h-4" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              aria-label="X (Twitter)"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
            </svg>
          </a>
        </Button>
      </div>
    </footer>
  );
}