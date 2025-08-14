import { 
  WebClient,
  AccountStorageMode,
  NoteType,
  TransactionProver,
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
  OutputNote,
  NoteExecutionMode,
  AccountId
} from "@demox-labs/miden-sdk";

// @ts-ignore - MASM files are treated as raw text
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

type TokenSymbol = 'BTC' | 'ETH';

interface SwapParams {
  sellToken: TokenSymbol;
  buyToken: TokenSymbol; 
  sellAmount: string;
  buyAmount: string; // min_amount_out
}

/**

 * 
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

async function submitNoteToServer(outputNote: OutputNote): Promise<void> {
  try {
    // Convert OutputNote to string and encode as base64
    const noteString = outputNote.toString();
    const noteData = btoa(noteString);
    
    const response = await fetch('/orders/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note_data: noteData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Note submitted successfully:', result);
    
  } catch (error) {
    console.error('Failed to submit note to server:', error);
    throw error;
  }
}

export async function compileZoroSwapNote(swapParams: SwapParams): Promise<OutputNote> {
  const client = await WebClient.createClient("https://rpc.testnet.miden.io:443");
  const prover = TransactionProver.newRemoteProver("https://tx-prover.testnet.miden.io");

  // ── Initial sync to ensure client is connected to blockchain ──────────────────
  console.log("Initial sync to blockchain...");
  await client.syncState();
  console.log("Initial sync complete");

  // ── Creating new account ──────────────────────────────────────────────────────
  console.log("Creating account for Alice…");
  const alice = await client.newWallet(AccountStorageMode.public(), true);
  console.log("Alice account ID:", alice.id().toString());

  // ── Sync after account creation ──────────────────────────────────────────────
  console.log("Syncing after account creation...");
  await client.syncState();

  // ── Creating test BTC faucet ──────────────────────────────────────────────────────
  const btcFaucet = await client.newFaucet(
    AccountStorageMode.public(),
    false,
    "BTC",
    8,
    BigInt(1_000_000),
  );
  console.log("BTC Faucet ID:", btcFaucet.id().toString());

  // ── Creating test ETH faucet ──────────────────────────────────────────────────────
  const ethFaucet = await client.newFaucet(
    AccountStorageMode.public(),
    false,
    "ETH",
    8,
    BigInt(1_000_000),
  );
  console.log("ETH Faucet ID:", ethFaucet.id().toString());

  // ── Sync after faucet creation ──────────────────────────────────────────────
  console.log("Syncing after faucet creation...");
  await client.syncState();

  // Determine which faucets to use based on swap params
  const sellFaucet = swapParams.sellToken === 'BTC' ? btcFaucet : ethFaucet;
  const buyFaucet = swapParams.buyToken === 'BTC' ? btcFaucet : ethFaucet;
  
  // Convert amounts to BigInt
  const sellAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.sellAmount)));
  const buyAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.buyAmount)));
  
  // Mint tokens to Alice
  const mintAmount = sellAmountBigInt > BigInt(5000) ? BigInt(10000) : sellAmountBigInt + BigInt(1000);
  
  console.log("Creating mint transaction...");
  await client.submitTransaction(
    await client.newTransaction(
      sellFaucet.id(),
      client.newMintTransactionRequest(
        alice.id(),
        sellFaucet.id(),
        NoteType.Public,
        mintAmount,
      ),
    ),
    prover,
  );

  // Sync state after minting
  console.log("Syncing state after minting...");
  await client.syncState();
  console.log("Post-mint sync complete");

  const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
  const noteType = NoteType.Public;

  // Create assets using the faucet IDs directly
  const offeredAsset = new FungibleAsset(sellFaucet.id(), sellAmountBigInt);
  console.log("Created offeredAsset:", offeredAsset);
  console.log("offeredAsset faucet ID:", sellFaucet.id().toString());
  console.log("offeredAsset amount:", sellAmountBigInt.toString());

  // Build swap tag using the simplified approach that avoids faucetId() calls
  const swapTag = buildSwapTag(noteType, sellFaucet.id(), buyFaucet.id());
  console.log("Created swapTag:", swapTag);

  // Note should only contain the offered asset
  const noteAssets = new NoteAssets([offeredAsset]);
  console.log("Created noteAssets:", noteAssets);

  const metadata = new NoteMetadata(
    alice.id(),
    noteType,
    swapTag,
    NoteExecutionHint.always(),
    new Felt(BigInt(0)) // aux
  );

  const deadline = 0;

  const p2idTag = NoteTag.fromAccountId(alice.id()).asU32();

  // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
  const requestedAssetFelts: Felt[] = [
    buyFaucet.id().prefix(),  // Felt 0: Asset ID prefix
    buyFaucet.id().suffix(),  // Felt 1: Asset ID suffix  
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
    alice.id().prefix(),        // creator_prefix
    alice.id().suffix()         // creator_suffix
  ]));

  const note = new Note(
    noteAssets,
    metadata,
    new NoteRecipient(generateRandomSerialNumber(), script, inputs),
  );
  console.log("Created note:", note);
  console.log("Note assets:", note.assets());

  const outputNote = OutputNote.full(note);
  console.log("Created OutputNote:", outputNote);
  console.log("OutputNote assets:", outputNote.assets());
  
  // Submit the note to the server
  await submitNoteToServer(outputNote);
  
  return outputNote;
}
