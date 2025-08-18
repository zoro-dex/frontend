import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "@/components/ThemeProvider.tsx"
import { WalletContextProvider } from './components/WalletProvider'
import { WebClientProvider } from './components/WebClientContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <WalletContextProvider>
        <WebClientProvider>
          <App />
        </WebClientProvider>
      </WalletContextProvider>
    </ThemeProvider>
  </StrictMode>,
)