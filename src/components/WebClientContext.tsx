import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { WebClient } from '@demox-labs/miden-sdk';

interface WebClientContextType {
  client: WebClient | null;
  isReady: boolean;
}

const WebClientContext = createContext<WebClientContextType>({
  client: null,
  isReady: false,
});

interface WebClientProviderProps {
  children: ReactNode;
}

export const WebClientProvider = ({ children }: WebClientProviderProps) => {
  const [client, setClient] = useState<WebClient | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const initClient = async (): Promise<void> => {
      try {
        const webClient = await WebClient.createClient('https://rpc.testnet.miden.io:443');
        setClient(webClient);
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize WebClient:', error);
      }
    };

    initClient();
  }, []);

  return (
    <WebClientContext.Provider value={{ client, isReady }}>
      {children}
    </WebClientContext.Provider>
  );
};

export const useWebClient = (): WebClientContextType => {
  const context = useContext(WebClientContext);
  if (context === undefined) {
    throw new Error('useWebClient must be used within a WebClientProvider');
  }
  return context;
};