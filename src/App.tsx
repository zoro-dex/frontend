import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NablaAntennaProvider } from './components/PriceFetcher';
import SwapPage from './pages/Swap';
import FaucetPage from './pages/Faucet';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SwapPage />} />
        <Route path="/faucet" element={<FaucetPage />} />
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