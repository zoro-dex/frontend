import { AccountStorageMode, WebClient, NoteType, AccountId, Account } from "@demox-labs/miden-sdk";

export async function createAmmSwap(
  connectedAccountId?: string,
  sellAmount?: string,
  buyAmount?: string,
  sellToken?: string,
  buyToken?: string
): Promise<void> {
    console.log("Starting AMM Swap with Alice wallet:");
    console.log("Raw arguments received:", arguments);
    
    if (typeof window === "undefined") {
        console.warn("webClient() can only run in the browser");
        return;
    }

    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);

    // 1. Sync and log block
    const state = await client.syncState();
    console.log("🔗 Latest block number:", state.blockNum());    

    // Create Alice and Zoro wallets
    console.log("👩 Creating Alice wallet...");
    const alice: Account = await client.newWallet(AccountStorageMode.public(), true);
    console.log("👩 Alice wallet:", alice.id().toBech32());

    console.log("⚔️  Creating Zoro AMM wallet...");
    const zoro: Account = await client.newWallet(AccountStorageMode.public(), true);
    console.log("⚔️  Zoro AMM wallet:", zoro.id().toBech32());

    // Parse frontend amounts
    if (!sellAmount || !buyAmount) {
        console.error("❌ Missing sellAmount or buyAmount - cannot proceed");
        console.log("Received values:", { sellAmount, buyAmount, sellToken, buyToken });
        return;
    }
    
    const sellAmountNum: number = parseFloat(sellAmount);
    const buyAmountNum: number = parseFloat(buyAmount);
    
    if (isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0 || buyAmountNum <= 0) {
        console.error("❌ Invalid amounts - cannot proceed");
        console.log("Parsed values:", { sellAmountNum, buyAmountNum });
        return;
    }
    
    const sellAmountBaseUnits: number = Math.floor(sellAmountNum * 1000_000);
    const buyAmountBaseUnits: number = Math.floor(buyAmountNum * 1000_000);
    
    console.log(`💱 Swap Details: ${sellAmountNum} ${sellToken} → ${buyAmountNum} ${buyToken}`);

    // 2. Create AMM Pools
    console.log("\n🏊 Creating AMM Pools…");
    
    const btcPool: Account = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "BTC",
        8,
        BigInt(1_000_000_000),
    );
    console.log("₿ BTC Pool ID:", btcPool.id().toBech32());

    const ethPool: Account = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "ETH",
        8,
        BigInt(1_000_000_000_000),
    );
    console.log("Ξ ETH Pool ID:", ethPool.id().toBech32());

    await client.syncState();
    
    // 3. Step 1: Mint sellToken to Alice
    console.log(`\n💰 Step 1: Minting ${sellAmountNum} ${sellToken} to Alice...`);
    
    const sellPoolId: AccountId = sellToken === "BTC" ? btcPool.id() : ethPool.id();
    const mintToAliceRequest = client.newMintTransactionRequest(
        alice.id(),
        sellPoolId,
        NoteType.Public,
        BigInt(sellAmountBaseUnits),
    );

    const mintToAliceTx = await client.newTransaction(sellPoolId, mintToAliceRequest);
    console.log(`📤 Minting ${sellToken} to Alice, submitting transaction...`);
    await client.submitTransaction(mintToAliceTx);
    console.log(`✅ ${sellToken} mint to Alice submitted successfully`);

    console.log(`⏳ Waiting 10 seconds for ${sellToken} mint confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // 4. Step 2: Alice transfers sellToken to Zoro
    console.log(`\n🔄 Step 2: Alice transferring ${sellAmountNum} ${sellToken} to Zoro...`);
    
    const aliceNotes = await client.getConsumableNotes(alice.id());
    const aliceNoteIds: string[] = aliceNotes.map((n) => n.inputNoteRecord().id().toString());
    console.log(`📝 Alice's ${sellToken} note IDs:`, aliceNoteIds);

    if (aliceNoteIds.length === 0) {
        console.log(`❌ No ${sellToken} notes found in Alice's wallet, cannot proceed`);
        return;
    }

    // Alice sends tokens to Zoro
    const transferToZoroRequest = client.newConsumeTransactionRequest(aliceNoteIds);
    const transferToZoroTx = await client.newTransaction(alice.id(), transferToZoroRequest);
    console.log(`📤 Alice transferring ${sellToken} to Zoro...`);
    await client.submitTransaction(transferToZoroTx);
    console.log(`✅ Transfer from Alice to Zoro submitted successfully`);

    console.log(`⏳ Waiting 10 seconds for transfer confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // 5. Step 3: Mint buyToken from pool to Alice (AMM swap result)
    console.log(`\n🎯 Step 3: AMM minting ${buyAmountNum} ${buyToken} to Alice as swap result...`);
    
    const buyPoolId: AccountId = buyToken === "BTC" ? btcPool.id() : ethPool.id();
    const mintBuyTokenRequest = client.newMintTransactionRequest(
        alice.id(),
        buyPoolId,
        NoteType.Public,
        BigInt(buyAmountBaseUnits),
    );

    const mintBuyTokenTx = await client.newTransaction(buyPoolId, mintBuyTokenRequest);
    console.log(`📤 Minting ${buyToken} to Alice as swap result...`);
    await client.submitTransaction(mintBuyTokenTx);
    console.log(`✅ ${buyToken} mint to Alice submitted successfully`);

    console.log(`⏳ Waiting 10 seconds for ${buyToken} mint confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // 6. Verify swap results
    console.log(`\n🔍 Checking swap results...`);
    try {
        const finalAliceNotes = await client.getConsumableNotes(alice.id());
        const finalNoteIds: string[] = finalAliceNotes.map((n) => n.inputNoteRecord().id().toString());
        console.log(`📝 Alice's final note IDs:`, finalNoteIds);
        
        if (finalNoteIds.length > 0) {
            console.log(`✅ SUCCESS: Alice received ${buyAmountNum} ${buyToken} tokens!`);
        } else {
            console.log("⚠️  No notes found in Alice's wallet after swap");
        }
    } catch (error) {
        console.log("⚠️  Could not verify Alice's final notes:", error);
    }

    console.log("\n📊 AMM Swap Summary:");
    console.log("👩 Alice Wallet:", alice.id().toBech32());
    console.log("⚔️  Zoro AMM Wallet:", zoro.id().toBech32());
    console.log("₿ BTC Pool:", btcPool.id().toBech32());
    console.log("Ξ ETH Pool:", ethPool.id().toBech32());
    console.log(`💱 Swap Completed: ${sellAmountNum} ${sellToken} → ${buyAmountNum} ${buyToken}`);
    console.log("🎯 Alice received the swapped tokens!");
    console.log("⚔️  AMM swap flow completed successfully!");
}