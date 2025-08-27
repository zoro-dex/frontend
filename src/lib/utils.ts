import type { AccountId } from '@demox-labs/miden-sdk';
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
      await client.importAccountById(acc);
    } catch {}
  }
  await client.syncState();
  return client;
};
