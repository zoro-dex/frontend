import { AccountStorageMode, WebClient, NoteType, AccountId, Account } from "@demox-labs/miden-sdk";

export type NoteTypeString = 'public' | 'private';

export interface MidenSendTransaction {
  senderAccountId: string;
  recipientAccountId: string;
  faucetId: string;
  noteType: NoteTypeString;
  amount: number;
  recallBlocks?: number;
}

export class SendTransaction implements MidenSendTransaction {
  senderAccountId: string;
  recipientAccountId: string;
  faucetId: string;
  noteType: NoteTypeString;
  amount: number;
  recallBlocks?: number;

  constructor(
    sender: string,
    recipient: string,
    faucetId: string,
    noteType: NoteTypeString,
    amount: number,
    recallBlocks?: number
  ) {
    this.senderAccountId = sender;
    this.recipientAccountId = recipient;
    this.faucetId = faucetId;
    this.noteType = noteType;
    this.amount = amount;
    this.recallBlocks = recallBlocks;
  }
}

export async function createSwap(
  connectedAccountId?: string,
  sellAmount?: string,
  sellToken?: string
): Promise<void> {
    console.log("Starting simple send transaction:");
    console.log("Parameters:", { connectedAccountId, sellAmount, sellToken });
    
    if (typeof window === "undefined") {
        console.warn("webClient() can only run in the browser");
        return;
    }

    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);

    // 1. Sync and log block
    const state = await client.syncState();
    console.log("🔗 Latest block number:", state.blockNum());    

    let targetAccountId: AccountId;
    let btcPool: Account;
    
    if (connectedAccountId) {
        console.log("Using connected wallet account:", connectedAccountId);
        try {
            targetAccountId = AccountId.fromBech32(connectedAccountId);
        } catch (error) {
            console.error("⚠️  Could not parse connected account:", error);
            return;
        }
    } else {
        console.log("🆕 Creating new account for testing…");
        const testAccount = await client.newWallet(AccountStorageMode.public(), true);
        targetAccountId = testAccount.id();
    }
    
    console.log("👛 Sender (Connected Wallet):", targetAccountId.toBech32());

    // Parse and validate amounts
    if (!sellAmount) {
        console.error("❌ Missing sellAmount");
        return;
    }
    
    const sellAmountNum = parseFloat(sellAmount);
    
    if (isNaN(sellAmountNum) || sellAmountNum <= 0) {
        console.error("❌ Invalid amount");
        return;
    }
    
    const sellAmountBaseUnits = Math.floor(sellAmountNum * 1_000_000);
    console.log(`💰 Sending ${sellAmountNum} ${sellToken} (${sellAmountBaseUnits} base units)`);

    // 2. Create BTC Pool
    console.log("\n🏊 Creating BTC Pool…");
    
    btcPool = await client.newFaucet(
        AccountStorageMode.public(),
        false,
        "BTC",
        8,
        BigInt(1_000_000_000),
    );
    console.log("₿ BTC Pool ID:", btcPool.id().toBech32());

    await client.syncState();

    // 3. First, mint tokens to connected wallet (WebClient needs its own version)
    console.log(`\n💰 Step 1: Minting ${sellAmountNum} ${sellToken} to connected wallet via WebClient...`);
    
    const faucetIdForTokens = "mtst1qppen8yngje35gr223jwe6ptjy7gedn9"; // The faucet ID you provided
    
    try {
        // Parse the provided faucet ID
        const tokenFaucetId = AccountId.fromBech32(faucetIdForTokens);
        console.log("🪙 Using token faucet ID:", tokenFaucetId.toBech32());
        
        // Mint tokens to the connected wallet via WebClient
        // This is needed because WebClient can't see notes from external wallets
        const mintRequest = client.newMintTransactionRequest(
            targetAccountId,
            tokenFaucetId,
            NoteType.Public,
            BigInt(sellAmountBaseUnits),
        );

        const mintTx = await client.newTransaction(tokenFaucetId, mintRequest);
        await client.submitTransaction(mintTx);
        console.log(`✅ ${sellToken} mint transaction submitted to connected wallet`);

        console.log(`⏳ Waiting for mint confirmation and sync...`);
        await new Promise((resolve) => setTimeout(resolve, 15000));
        await client.syncState();
        
        // Check for notes with retry logic
        let userNotes = await client.getConsumableNotes(targetAccountId);
        let retries = 0;
        const maxRetries = 3;
        
        while (userNotes.length === 0 && retries < maxRetries) {
            console.log(`⏳ Notes not yet available, retrying in 10 seconds... (${retries + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, 10000));
            await client.syncState();
            userNotes = await client.getConsumableNotes(targetAccountId);
            retries++;
        }
        
        console.log(`📋 Found ${userNotes.length} notes after minting`);
        
        // Debug: Log details about each note
        userNotes.forEach((note, index) => {
            const noteId = note.inputNoteRecord().id().toString();
            console.log(`📝 Note ${index + 1}: ID = ${noteId}`);
        });
        
        if (userNotes.length === 0) {
            console.error(`❌ Failed to mint ${sellToken} tokens to connected wallet after ${maxRetries} retries`);
            return;
        }
        
        console.log(`✅ WebClient now has access to ${userNotes.length} notes for the connected wallet`);

        // 4. Create and execute the send transaction
        console.log(`\n📤 Step 2: Sending tokens from connected wallet to BTC pool...`);
        
        // Create the send transaction using your class structure
        const sendTransaction = new SendTransaction(
            targetAccountId.toBech32(),
            btcPool.id().toBech32(),
            faucetIdForTokens,
            'public',
            sellAmountBaseUnits
        );
        
        console.log("📋 Send transaction created:", {
            sender: sendTransaction.senderAccountId,
            recipient: sendTransaction.recipientAccountId,
            faucetId: sendTransaction.faucetId,
            amount: sendTransaction.amount,
            noteType: sendTransaction.noteType
        });

        // Get note IDs to consume - use all available notes for now
        const noteIds = userNotes.map(note => note.inputNoteRecord().id().toString());
        console.log(`📝 Using note IDs:`, noteIds);

        // Create a P2ID send transaction request
        const sendRequest = client.newSendTransactionRequest(
            targetAccountId,                              // sender_account_id
            AccountId.fromBech32(sendTransaction.recipientAccountId), // target_account_id  
            tokenFaucetId,                               // faucet_id
            NoteType.Public,                             // note_type
            BigInt(sendTransaction.amount)               // amount
        );

        const sendTx = await client.newTransaction(targetAccountId, sendRequest);
        await client.submitTransaction(sendTx);
        console.log(`✅ Send transaction submitted successfully`);

        console.log(`⏳ Waiting for send confirmation...`);
        await new Promise((resolve) => setTimeout(resolve, 15000));
        await client.syncState();

        // 5. Verify the transaction
        console.log(`\n🔍 Verifying transaction results...`);
        
        // Check if BTC pool received any notes
        try {
            const poolNotes = await client.getConsumableNotes(btcPool.id());
            console.log(`✅ BTC Pool now has ${poolNotes.length} consumable notes`);
        } catch (error) {
            console.log("⚠️  Could not verify pool notes:", error);
        }

        // Check sender's remaining notes
        const remainingNotes = await client.getConsumableNotes(targetAccountId);
        console.log(`📋 Sender now has ${remainingNotes.length} remaining notes`);

        console.log("\n📊 Transaction Summary:");
        console.log(`👛 Sender: ${targetAccountId.toBech32()}`);
        console.log(`🎯 Recipient (BTC Pool): ${btcPool.id().toBech32()}`);
        console.log(`🪙 Token Faucet: ${faucetIdForTokens}`);
        console.log(`💰 Amount: ${sellAmountNum} ${sellToken} (${sellAmountBaseUnits} base units)`);
        console.log(`✅ Simple send transaction completed successfully!`);

    } catch (error) {
        console.error("❌ Error during simple send transaction:", error);
        throw error;
    }
}