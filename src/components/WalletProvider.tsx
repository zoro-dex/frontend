import React, { useMemo } from 'react';
import { WalletProvider } from '@demox-labs/miden-wallet-adapter';
import { WalletModalProvider } from '@demox-labs/miden-wallet-adapter';
import { WalletError } from '@demox-labs/miden-wallet-adapter';
import '@demox-labs/miden-wallet-adapter-reactui/styles.css';
import { MidenWalletAdapter } from '@demox-labs/miden-wallet-adapter';

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
        switch (error.error?.name) {
            case "NotGrantedMidenWalletError":
                break;
            case "WalletNotConnectedError":
                break;
            default:
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