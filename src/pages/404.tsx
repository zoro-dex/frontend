import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <Header />
        <main className='flex-1 flex items-center justify-center p-4 mt-10'>
        <div className='text-center space-y-6'>
            <img 
            src="/zorosmoking.png" 
            alt="Zoro taking a break." 
            className="w-64 h-auto mx-auto -mb-4" 
            />
            <div className='space-y-2 font-chancery'>
            <h1 className='text-6xl font-bold'>404</h1>
            <p className='text-xl'>
                <span className="animate-pulse">..</span>.not found
            </p>
            </div>
            <div className='pt-4'>
            <Link to='/'>
                <Button
                variant='secondary'
                size='sm'
                className='text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors'
                >
                ← Get back
                </Button>
            </Link>
            </div>
        </div>
        </main>
      <Footer />
    </div>
  );
}

export default NotFound;