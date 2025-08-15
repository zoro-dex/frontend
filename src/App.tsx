import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NablaAntennaProvider } from './components/PriceFetcher';
// import SwapPage from './pages/Swap';
// import FaucetPage from './pages/Faucet';
import LandingPage from './pages/Landing';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={/*<SwapPage />*/<LandingPage />} />
        {/*<Route path="/faucet" element={<FaucetPage />} />
        <Route path="/landing" element={<LandingPage />} />*/}
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
