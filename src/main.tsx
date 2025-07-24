import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "@/components/theme-provider"
import { WalletContextProvider } from './components/WalletProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <WalletContextProvider>
        <App />
      </WalletContextProvider>
    </ThemeProvider>
  </StrictMode>,
)