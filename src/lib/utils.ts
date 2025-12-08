import {
  type AccountId,
  AccountInterface,
  Address,
  type WebClient,
} from '@demox-labs/miden-sdk';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NETWORK, NETWORK_ID } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const instantiateClient = async (
  { accountsToImport }: { accountsToImport: AccountId[] },
) => {
  const { WebClient } = await import(
    '@demox-labs/miden-sdk'
  );
  const client = await WebClient.createClient(NETWORK.rpcEndpoint);
  for (const acc of accountsToImport) {
    try {
      console.log("importing " + acc);
      await safeAccountImport(client, acc);
    } catch (e) {
      console.error(e);
    }
  }
  await client.syncState();
  return client;
};

export const safeAccountImport = async (client: WebClient, accountId: AccountId) => {
  const existingAccount = await client.getAccount(accountId);
  if (existingAccount == null) {
    try {
      await client.importAccountById(accountId);
    } catch (e) {
      console.warn(e);
    }
  }
};

export const accountIdToBech32 = (
  accountId: AccountId,
) => {
  return accountId.toBech32(NETWORK_ID, AccountInterface.BasicWallet).split('_')[0];
};

export const bech32ToAccountId = (bech32str?: string) => {
  if (bech32str == null) return undefined;
  return Address.fromBech32(bech32str).accountId();
};
