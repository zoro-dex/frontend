import React, { useMemo } from 'react';
import { WalletProvider } from '@demox-labs/miden-wallet-adapter-react';
import { MidenWalletAdapter } from '@demox-labs/miden-wallet-adapter-miden';
import { WalletModalProvider } from '@demox-labs/miden-wallet-adapter-reactui';
import { WalletError } from '@demox-labs/miden-wallet-adapter-base';
import '@demox-labs/miden-wallet-adapter-reactui/styles.css';

interface WalletContextProviderProps {
    children: React.ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
    const wallets = useMemo(
        () => [
            new MidenWalletAdapter({
                appName: "Zoro",
            }),
        ],
        []
    );

    const handleError = (error: WalletError) => {
        console.error('Wallet error:', error);
        
        switch (error.error?.name) {
            case "NotGrantedMidenWalletError":
                console.warn("User denied access to their wallet");
                break;
            case "WalletNotConnectedError":
                console.warn("Wallet not connected");
                break;
            default:
                console.error("An error occurred while connecting to wallet:", error.message);
                break;
        }
    };

    return (
        <WalletProvider wallets={wallets} autoConnect onError={handleError}>
            <WalletModalProvider>
                {children}
            </WalletModalProvider>
        </WalletProvider>
    );
};