import { NablaAntennaProvider } from '@/providers/NablaAntennaProvider';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import FaucetPage from './pages/Faucet';
import LandingPage from './pages/Landing';
import SwapPage from './pages/Swap';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<SwapPage />} />
        <Route path='/faucet' element={<FaucetPage />} />
        <Route path='/landing' element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <NablaAntennaProvider>
      <AppRouter />
    </NablaAntennaProvider>
  );
}

export default App;
