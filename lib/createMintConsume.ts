import { AccountStorageMode, WebClient, NoteType, AccountId, Account } from "@demox-labs/miden-sdk";

export async function createMintConsume(
  connectedAccountId?: string // Optional: the connected wallet's account ID in Bech32 format
): Promise<void> {
    if (typeof window === "undefined") {
        console.warn("webClient() can only run in the browser");
        return;
    }

    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);

    // 1. Sync and log block
    const state = await client.syncState();
    console.log("Latest block number:", state.blockNum());

    let alice: Account;
    let targetAccountId: AccountId;
    
    if (connectedAccountId) {
        console.log("Using connected wallet account:", connectedAccountId);
        try {
            targetAccountId = AccountId.fromBech32(connectedAccountId);
            console.log("Parsed connected account ID:", targetAccountId.toString());
            
            // Create a new wallet for transaction purposes, but mint to the connected account
            alice = await client.newWallet(AccountStorageMode.public(), true);
            console.log("Created transaction wallet:", alice.id().toString());
        } catch (error) {
            console.warn("Could not parse connected account, creating new one:", error);
            alice = await client.newWallet(AccountStorageMode.public(), true);
            targetAccountId = alice.id();
        }
    } else {
        console.log("Creating new account…");
        alice = await client.newWallet(AccountStorageMode.public(), true);
        targetAccountId = alice.id();
    }
    
    console.log("Transaction wallet:", alice.id().toString());
    console.log("Target mint recipient:", targetAccountId.toString());

    // Deploy faucet (will be in Bech32 format by default)
    console.log("Creating pool…");
    const faucet = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "MID",
        8,
        BigInt(1_000_000),
    );
    console.log("Pool ID (Faucet):", faucet.id().toString());

    await client.syncState();
    
    // Mint tokens to Alice
    console.log("Minting tokens to Alice...");
    console.log("Alice account:", alice.id().toString());
    console.log("Faucet account:", faucet.id().toString());
    
    let mintTxRequest = client.newMintTransactionRequest(
        alice.id(),
        faucet.id(),
        NoteType.Public,
        BigInt(1000),
    );

    let txResult = await client.newTransaction(faucet.id(), mintTxRequest);
    console.log("Mint transaction created, submitting...");
    await client.submitTransaction(txResult);
    console.log("Mint transaction submitted successfully");

    console.log("Waiting 10 seconds for transaction confirmation...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // 5. Fetch minted notes
    const mintedNotes = await client.getConsumableNotes(alice.id());
    const mintedNoteIds = mintedNotes.map((n) =>
        n.inputNoteRecord().id().toString(),
    );
    console.log("Minted note IDs:", mintedNoteIds);

    // 6. Consume minted notes (only if there are notes to consume)
    if (mintedNoteIds.length > 0) {
        console.log("Consuming minted notes...");
        let consumeTxRequest = client.newConsumeTransactionRequest(mintedNoteIds);
        let txResult_2 = await client.newTransaction(alice.id(), consumeTxRequest);
        await client.submitTransaction(txResult_2);

        await client.syncState();
        console.log("Notes consumed.");
    } else {
        console.log("No notes to consume, skipping consume step.");
    }
}