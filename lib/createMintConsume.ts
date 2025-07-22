import { AccountStorageMode, WebClient } from "@demox-labs/miden-sdk";

export async function createMintConsume(): Promise<void> {
  if (typeof window === "undefined") {
    console.warn("webClient() can only run in the browser");
    return;
  }

  const nodeEndpoint = "https://rpc.testnet.miden.io:443";
  const client = await WebClient.createClient(nodeEndpoint);

  // 1. Sync and log block
  const state = await client.syncState();
  console.log("Latest block number:", state.blockNum());

  // 2. Create Alice’s account
  console.log("Creating account for first pool…");
  const firstPool = await client.newWallet(AccountStorageMode.public(), true);
  console.log("First pool ID:", firstPool.id().toString());

 // 3. Deploy faucet
  console.log("Creating faucet…");
  const faucet = await client.newFaucet(
    AccountStorageMode.public(),
    false,
    "MID",
    8,
    BigInt(1_000_000),
  );
  console.log("Faucet ID:", faucet.id().toString());

  await client.syncState();
  console.log("Setup complete.");
}
