import {
  type AccountId,
  Address,
  NetworkId,
  type WebClient,
} from '@demox-labs/miden-sdk';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const instantiateClient = async (
  { accountsToImport }: { accountsToImport: AccountId[] },
) => {
  const { WebClient } = await import(
    '@demox-labs/miden-sdk'
  );
  const nodeEndpoint = 'https://rpc.testnet.miden.io:443';
  const client = await WebClient.createClient(nodeEndpoint);
  for (const acc of accountsToImport) {
    try {
      await safeAccountImport(client, acc);
    } catch {}
  }
  await client.syncState();
  return client;
};

export const safeAccountImport = async (client: WebClient, accountId: AccountId) => {
  if (await client.getAccount(accountId) == null) {
    try {
      client.importAccountById(accountId);
    } catch (e) {
      console.warn(e);
    }
  }
};

export const accountIdToBech32 = (
  accountId: AccountId,
  networkId: NetworkId = NetworkId.Testnet,
) => {
  return Address.fromAccountId(accountId, 'Unspecified').toBech32(networkId);
};

export const bech32ToAccountId = (bech32str: string) => {
  return Address.fromBech32(bech32str).accountId();
};
