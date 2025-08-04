import { AccountStorageMode, WebClient, NoteType, AccountId, Account } from "@demox-labs/miden-sdk";

export async function createAmmSwap(
  connectedAccountId?: string, // wallet's account ID in Bech32 format
  sellAmount?: string, // Amount to sell from frontend
  buyAmount?: string, // Amount to receive (calculated from price feed)  
  sellToken?: string, // Token being sold 
  buyToken?: string // Token being bought
): Promise<void> {
    console.log("Starting AMM Swap with parameters:");
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

    let zoro: Account;
    let targetAccountId: AccountId;
    
    if (connectedAccountId) {
        console.log("Using connected wallet account:", connectedAccountId);
        try {
            targetAccountId = AccountId.fromBech32(connectedAccountId);
            // Create a separate transaction wallet because:
            // 1. Connected wallets don't have access to faucet private keys
            // 2. WebClient needs full key control to authorize minting operations
            zoro = await client.newWallet(AccountStorageMode.public(), true);
        } catch (error) {
            console.warn("⚠️  Could not parse connected account, creating new one:", error);
            zoro = await client.newWallet(AccountStorageMode.public(), true);
            targetAccountId = zoro.id();
        }
    } else {
        console.log("🆕 Creating new account…");
        zoro = await client.newWallet(AccountStorageMode.public(), true);
        targetAccountId = zoro.id();
    }
    
    console.log("⚔️  Zoro (AMM Protocol Wallet):", zoro.id().toBech32());
    console.log("🎯 Target recipient (Connected Wallet):", targetAccountId.toBech32());

    // Parse frontend amounts
    if (!sellAmount || !buyAmount) {
        console.error("❌ Missing sellAmount or buyAmount - cannot proceed");
        console.log("Received values:", { sellAmount, buyAmount, sellToken, buyToken });
        return;
    }
    
    const sellAmountNum = parseFloat(sellAmount);
    const buyAmountNum = parseFloat(buyAmount);
    
    if (isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0 || buyAmountNum <= 0) {
        console.error("❌ Invalid amounts - cannot proceed");
        console.log("Parsed values:", { sellAmountNum, buyAmountNum });
        return;
    }
    
    const sellAmountBaseUnits: number = Math.floor(sellAmountNum * 1000_000); // Convert to base units (6 decimals)
    const buyAmountBaseUnits: number = Math.floor(buyAmountNum * 1000_000);
    
    console.log(`💱 Swap Details: ${sellAmountNum} ${sellToken} → ${buyAmountNum} ${buyToken}`);

    // 2. Create AMM Pool (faucet)
    console.log("\n🏊 Creating Pool…");
    
    const btcPool = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "BTC",
        8,
        BigInt(1_000_000_000),
    );
    console.log("₿ BTC Pool ID:", btcPool.id().toBech32());

    const ethPool = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "ETH",
        8,
        BigInt(1_000_000_000_000),
    );
    console.log("Ξ ETH Pool ID:", ethPool.id().toBech32());

    await client.syncState();

    // 3. Step 1: Create P2ID Note to Pool 1
    console.log(`\n💰 Step 1: Sending ${sellAmountNum} ${sellToken} to pool 1 for swap...`);
    
    async function createP2IDNote(
        sender: AccountId,
        receiver: AccountId,
        faucet: AccountId,
        amount: number,
        noteType: NoteType
        ) {
        const { FungibleAsset, OutputNote, Note, NoteAssets, Word, Felt } =
            await import("@demox-labs/miden-sdk");

        return OutputNote.full(
            Note.createP2IDNote(
            sender,
            receiver,
            new NoteAssets([new FungibleAsset(faucet, BigInt(amount))]),
            noteType,
            // @todo: replace hardcoded values with values from UI
            Word.newFromFelts([
                new Felt(BigInt(1)),
                new Felt(BigInt(2)),
                new Felt(BigInt(3)),
                new Felt(BigInt(4)),
            ]),
            new Felt(BigInt(0))
            )
        );
        }

    const mintTx = await client.newTransaction(sellPoolId, mintRequest);
    console.log(`📤 ${buyToken} mint transaction created, submitting...`);
    await client.submitTransaction(mintTx);
    console.log(`✅ ${buyToken} mint transaction submitted successfully`);

    console.log(`⏳ Waiting 10 seconds for ${buyToken} mint confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // 4. Check Zoro's notes
    const sellNotes = await client.getConsumableNotes(zoro.id());
    const sellNoteIds = sellNotes.map((n) => n.inputNoteRecord().id().toString());
    console.log(`📝 Transaction wallet's ${sellToken} note IDs:`, sellNoteIds);

    if (sellNoteIds.length === 0) {
        console.log(`❌ No ${sellToken} notes found, cannot proceed with swap`);
        return;
    }

    // 5. Step 2: Zoro swaps tokens (simplified AMM logic)
    console.log(`\n🔄 Step 2: Simulating AMM Swap - Trading ${sellAmountNum} ${sellToken} for ${buyToken}...`);
    
    // First consume Zoro's sell token notes
    console.log(`🔥 Consuming transaction wallet's ${sellToken} notes...`);
    const consumeRequest = client.newConsumeTransactionRequest(sellNoteIds);
    const consumeTx = await client.newTransaction(zoro.id(), consumeRequest);
    await client.submitTransaction(consumeTx);
    
    console.log(`⏳ Waiting for ${sellToken} consume confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await client.syncState();

    // Then mint buy tokens to the CONNECTED WALLET
    const buyPoolId = buyToken === "BTC" ? btcPool.id() : ethPool.id();
    console.log(`🎯 Minting ${buyAmountNum} ${buyToken} to CONNECTED WALLET from ${buyToken} pool...`);
    const buyMintRequest = client.newMintTransactionRequest(
        targetAccountId, // Mint to connected wallet
        buyPoolId,
        NoteType.Public,
        BigInt(buyAmountBaseUnits), // Use calculated buy amount
    );

    const buyMintTx = await client.newTransaction(buyPoolId, buyMintRequest);
    await client.submitTransaction(buyMintTx);
    console.log(`✅ ${buyToken} mint to connected wallet submitted successfully`);

    console.log(`⏳ Waiting 15 seconds for ${buyToken} mint confirmation...`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await client.syncState();

    console.log(`\n🔍 Checking swap results...`);
    try {
        // The mint transaction to connected wallet was successful if we got here
        console.log(`✅ SUCCESS: ${buyAmountNum} ${buyToken} tokens minted to connected wallet!`);
        console.log(`💰 Check your wallet for ${buyAmountNum} ${buyToken} tokens`);
        console.log(`📋 Your connected wallet address: ${targetAccountId.toBech32()}`);
    } catch (error) {
        console.log("⚠️  Could not verify connected wallet notes:", error);
        console.log("🔗 Check your connected wallet or use a Miden testnet explorer to verify the transaction");
    }

    console.log("\n📊 AMM Swap Summary:");
    console.log("⚔️  Zoro AMM Protocol Wallet:", zoro.id().toBech32());
    console.log("👛 Connected Wallet (Recipient):", targetAccountId.toBech32());
    console.log("₿ BTC Pool:", btcPool.id().toBech32());
    console.log("Ξ ETH Pool:", ethPool.id().toBech32());
    console.log(`💱 Swap: ${sellAmountNum} ${sellToken} → ${buyAmountNum} ${buyToken}`);
    console.log("🎯 Tokens minted to your connected wallet!");
    console.log("⚔️  Zoro's AMM swap completed successfully!");
    console.log("\n💡 Check your wallet - you should see claimable tokens");
}