import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <Header />
      <main className='flex-1 flex items-center justify-center p-4 mt-10'>
        <div className='text-center space-y-6'>
          <img
            src='/zoro_logo_with_outline.svg'
            alt='Zoro logo'
            className='w-64 h-auto mx-auto -mb-4'
          />
          <div className='space-y-2 font-cal-sans'>
            <h1 className='text-6xl font-bold'>404</h1>
            <p className='text-xl'>
              Page not found
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
