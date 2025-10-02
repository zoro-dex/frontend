import { NablaAntennaProvider } from '@/providers/NablaAntennaProvider';
import {
  MidenWalletAdapter,
  WalletModalProvider,
  WalletProvider,
} from '@demox-labs/miden-wallet-adapter';
import { useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import FaucetPage from './pages/Faucet';
import SwapPage from './pages/Swap';
import NotFound from './pages/404';
import { ThemeProvider } from './providers/ThemeProvider';
import '@demox-labs/miden-wallet-adapter-reactui/styles.css';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<SwapPage />} />
        <Route path='/faucet' element={<FaucetPage />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </Router>
  );
}

function App() {
  const wallets = useMemo(
    () => [
      new MidenWalletAdapter({
        appName: 'Zoro',
      }),
    ],
    [],
  );
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <NablaAntennaProvider>
          <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
            <AppRouter />
          </ThemeProvider>
        </NablaAntennaProvider>
      </WalletModalProvider>
    </WalletProvider>
  );
}

export default App;
