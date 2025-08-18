import React from 'react';
import '@demox-labs/miden-wallet-adapter-reactui/styles.css';
import {
  WalletProvider,
  WalletModalProvider,
  MidenWalletAdapter
} from '@demox-labs/miden-wallet-adapter';

interface WalletContextProviderProps {
    children: React.ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
    const wallets = [
             new MidenWalletAdapter({
            appName: "Zoro",
        }),
        ];

    return (
        <WalletProvider wallets={wallets}>
            <WalletModalProvider>
                {children}
            </WalletModalProvider>
        </WalletProvider>
    );
};