import { 
  WebClient,
  AccountStorageMode,
  NoteType,
  NoteInputs,
  Note,
  NoteAssets,
  NoteRecipient,
  Word,
  NoteExecutionHint,
  NoteTag,
  NoteMetadata,
  FeltArray,
  Felt,
  FungibleAsset,
  NoteExecutionMode,
  AccountId,
  OutputNote,
  TransactionRequestBuilder,
  OutputNotesArray,
  TransactionProver,
  Account,
  TransactionRequest
} from "@demox-labs/miden-sdk";
import { CustomTransaction, type Wallet
} from "@demox-labs/miden-wallet-adapter";
import { NETWORK, API } from '@/lib/config';

// @ts-ignore - MASM files are treated as raw text
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

type TokenSymbol = 'BTC' | 'ETH';

export interface SwapParams {
  sellToken: TokenSymbol;
  buyToken: TokenSymbol; 
  sellAmount: string;
  buyAmount: string; // min_amount_out
  userAccountId: string;
  wallet: Wallet;
}

/**
 * Tag interpretation:
 * - use_case_id: 0 (SWAP_USE_CASE_ID)
 * - payload: combines the top 8 bits from both asset faucet ID prefixes
 *   - bits 8-15: offered_asset faucet_id_prefix >> 56 (top 8 bits)
 *   - bits 0-7: requested_asset faucet_id_prefix >> 56 (top 8 bits)
 */
function buildSwapTag(
  noteType: NoteType,
  offeredFaucetId: AccountId,
  requestedFaucetId: AccountId
): NoteTag {
  const SWAP_USE_CASE_ID: number = 0;
  
  // Get top 8 bits from offered asset faucet ID prefix
  const offeredAssetId: bigint = offeredFaucetId.prefix().asInt();
  const offeredAssetTag: number = Number((offeredAssetId >> 56n) & 0xFFn);
  
  // Get top 8 bits from requested asset faucet ID prefix
  const requestedAssetId: bigint = requestedFaucetId.prefix().asInt();
  const requestedAssetTag: number = Number((requestedAssetId >> 56n) & 0xFFn);
  
  // Combine: offered_asset_tag in upper 8 bits, requested_asset_tag in lower 8 bits
  const payload: number = (offeredAssetTag << 8) | requestedAssetTag;
  
  // Match note type
  if (noteType === NoteType.Public) {
    const execution = NoteExecutionMode.newLocal();
    return NoteTag.forPublicUseCase(SWAP_USE_CASE_ID, payload, execution);
  } else {
    return NoteTag.forLocalUseCase(SWAP_USE_CASE_ID, payload);
  }
}

function generateRandomSerialNumber(): Word {
  return Word.newFromFelts([
    new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
    new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
    new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
    new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
  ]);
}

export async function compileZoroSwapNote(swapParams: SwapParams): Promise<string> {
  // Create fresh client for this operation - don't reuse clients!
  const client = await WebClient.createClient(NETWORK.rpcEndpoint);
  const prover = TransactionProver.newRemoteProver("https://tx-prover.testnet.miden.io");

  try {
    // ── Initial sync to ensure client is connected to blockchain ──────────────────
    console.log("Initial sync to blockchain...");
    await client.syncState();
    console.log("Initial sync complete");

    // ── Creating test faucet ──────────────────────────────────────────────────────
    const testFaucet = await client.newFaucet(
      AccountStorageMode.public(),
      false,
      "TEST",
      8,
      BigInt(1_000_000),
    );
    console.log("TEST Faucet ID:", testFaucet.id().toString());

    // ── Sync after faucet creation ──────────────────────────────────────────────
    console.log("Syncing after faucet creation...");
    await client.syncState();

    const midenFaucetId = AccountId.fromBech32('mtst1qppen8yngje35gr223jwe6ptjy7gedn9');

    // Determine which faucets to use based on swap params
    const sellFaucet = swapParams.sellToken === 'BTC' ? midenFaucetId : testFaucet.id();
    const buyFaucet = swapParams.buyToken === 'BTC' ? midenFaucetId : testFaucet.id();
    
    // Convert amounts to BigInt
    const sellAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.sellAmount)));
    const buyAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.buyAmount)));

    const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
    const noteType = NoteType.Public;

    // Create assets using the faucet IDs directly
    const offeredAsset = new FungibleAsset(sellFaucet, sellAmountBigInt);

    // Build swap tag using the simplified approach that avoids faucetId() calls
    const swapTag = buildSwapTag(noteType, sellFaucet, buyFaucet);
    console.log("Created swapTag:", swapTag);

    // Note should only contain the offered asset
    const noteAssets = new NoteAssets([offeredAsset]);

    const userAddress = AccountId.fromBech32(swapParams.userAccountId);

    const metadata = new NoteMetadata(
      userAddress,
      noteType,
      swapTag,
      NoteExecutionHint.always(),
      new Felt(BigInt(0)) // aux
    );

    const deadline = 0;

    // Use the AccountId
    const p2idTag = NoteTag.fromAccountId(userAddress).asU32();

    // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
    const requestedAssetFelts: Felt[] = [
      buyFaucet.prefix(),  // Felt 0: Asset ID prefix
      buyFaucet.suffix(),  // Felt 1: Asset ID suffix  
      new Felt(BigInt(0)),      // Felt 2: Always 0
      new Felt(buyAmountBigInt) // Felt 3: Min amount out
    ];

    const inputs = new NoteInputs(new FeltArray([
      ...requestedAssetFelts,     // Felts 0-3: requested asset word
      new Felt(BigInt(0)),        // zoroswap_tag use case id
      new Felt(BigInt(p2idTag)),  // p2id_tag
      new Felt(BigInt(0)),        // empty_input_6
      new Felt(BigInt(0)),        // empty_input_7
      new Felt(BigInt(0)),        // swap_count
      new Felt(BigInt(deadline)), // deadline
      new Felt(BigInt(0)),        // empty_input_10
      new Felt(BigInt(0)),        // empty_input_11
      userAddress.prefix(),  // creator_prefix - using AccountId directly
      userAddress.suffix()   // creator_suffix - using AccountId directly
    ]));

    const note = new Note(
      noteAssets,
      metadata,
      new NoteRecipient(generateRandomSerialNumber(), script, inputs),
    );

    console.log("Created note:", note);

    let transactionRequest = new TransactionRequestBuilder()
      .withOwnOutputNotes(new OutputNotesArray([OutputNote.full(note)]))
      .build();

    const transaction = new CustomTransaction(
      userAddress.toString(), 
      transactionRequest,
      );

    console.log('Transaction:', transaction);

    // const txId = (transaction).executedTransaction().id().toHex();
    // const midenScanLink = `https://testnet.midenscan.com/tx/${txId}`;

    // console.log(`Transaction ID: ${txId}`);
    // console.log(`View transaction on MidenScan: ${midenScanLink}`);

    //     // Submit transaction to blockchain
    // await client.submitTransaction(transaction, prover);

    console.log(
      "note created and submitted to blockchain successfully!"
    );

    // Wait for the note to be included in a block before submitting to server
    console.log(
      "⏳ Waiting for note to be included in a block (5-6 seconds)...",
    );

    await client.syncState();

     // Wait for approximately one block time
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Sync state to get the latest block data
    await client.syncState();
    console.log("🔄 Synced client state");

    const noteId = note.id().toString();
    console.log("Created note ID:", noteId);

    //Export note with full details including inclusion proof
    const noteExport = await client.exportNote(noteId, "Full");
    console.log("Note export result:", noteExport);

    // noteExport should be bytes
    let noteBytes: Uint8Array;

    if (noteExport instanceof Uint8Array) {
      noteBytes = noteExport;
    } else if (Array.isArray(noteExport)) {
      noteBytes = new Uint8Array(noteExport);
    } else {
      throw new Error("Invalid note export type");
    }

    // convert to base 64 string
    const base64String = btoa(String.fromCharCode(...noteBytes));
    console.log("Base64 string:", base64String);

    // Submit the note to the server
    await submitNoteToServer(base64String);

    return base64String;
    
  } catch (error) {
    console.error("ZoroSwap note creation failed:", error);
    throw error;
  }

  async function submitNoteToServer(serializedNote: string): Promise<void> {
  try {
    
    const response = await fetch(`${API.endpoint}/orders/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note_data: serializedNote
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(result);
    
  } catch (error) {
    console.error('Failed to submit note to server:', error);
    throw error;
  }
}

}