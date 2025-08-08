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
  OutputNote
} from "@demox-labs/miden-sdk";

// @ts-ignore - MASM files are treated as raw text
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

type TokenSymbol = 'BTC' | 'ETH';

interface Asset {
  symbol: TokenSymbol;
}

interface SwapParams {
  sellToken: TokenSymbol;
  buyToken: TokenSymbol; 
  sellAmount: string;
  buyAmount: string; // min_amount_out
}

/**
 * Builds a NoteTag for Zoro swap operations
 * 
 * Tag interpretation:
 * - use_case_id: 1337 (identifies this as a Zoro swap)
 * - payload bits:
 *   - bit 0: note_type (0=Public, reserved for future note types)
 *   - bits 1-2: offered_asset (0=BTC, 1=ETH) 
 *   - bits 3-4: requested_asset (0=BTC, 1=ETH)
 *   - bits 5-31: reserved for future use
 * 
 * Example: BTC->ETH swap = payload 0b01000 = 8
 *          ETH->BTC swap = payload 0b10001 = 17
 */
function buildSwapTag(
  noteType: NoteType,
  offeredAsset: Asset,
  requestedAsset: Asset
): NoteTag {
  const ZORO_SWAP_USE_CASE = 1337;
  
  // Map note type (only Public supported for now)
  const noteTypeBit = noteType === NoteType.Public ? 0 : 0;
  
  // Map token symbols to bits
  const getTokenBits = (symbol: TokenSymbol): number => {
    switch (symbol) {
      case 'BTC': return 0;
      case 'ETH': return 1;
      default: throw new Error(`Unsupported token: ${symbol}`);
    }
  };
  
  const offeredBits = getTokenBits(offeredAsset.symbol);
  const requestedBits = getTokenBits(requestedAsset.symbol);
  
  // Build payload: note_type | offered_asset << 1 | requested_asset << 3
  const payload = noteTypeBit | (offeredBits << 1) | (requestedBits << 3);
  
  return NoteTag.forLocalUseCase(ZORO_SWAP_USE_CASE, payload);
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

  // ── Creating new account ──────────────────────────────────────────────────────
  console.log("Creating account for Alice…");
  const alice = await client.newWallet(AccountStorageMode.public(), true);
  console.log("Alice account ID:", alice.id().toString());

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

  // ── mint tokens to Alice based on sell token ──────────────────────────────────────
  const sellFaucet = swapParams.sellToken === 'BTC' ? btcFaucet : ethFaucet;
  const buyFaucet = swapParams.buyToken === 'BTC' ? btcFaucet : ethFaucet;
  
  // Convert sell amount to BigInt (no decimals - Miden uses base units)
  const sellAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.sellAmount)));
  
  // Mint a reasonable amount (max 10,000 base units to stay under faucet limit)
  const mintAmount = sellAmountBigInt > BigInt(5000) ? BigInt(10000) : sellAmountBigInt + BigInt(1000);
  
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

  console.log("Syncing state:", (await client.syncState()));

  const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
  const noteType = NoteType.Public;

  // Create offered asset from actual swap parameters
  const fungibleAsset = new FungibleAsset(sellFaucet.id(), sellAmountBigInt);
  const offeredAsset = new NoteAssets([fungibleAsset]);
  
  console.log("Created swap note:", {
    sellToken: swapParams.sellToken,
    buyToken: swapParams.buyToken,
    sellAmount: sellAmountBigInt.toString(),
    minBuyAmount: minBuyAmountBigInt.toString(),
    assetsInNote: offeredAsset.assets().length
  });
  
  const swapTag = buildSwapTag(
    noteType, 
    { symbol: swapParams.sellToken }, 
    { symbol: swapParams.buyToken }
  );

  const metadata = new NoteMetadata(
    alice.id(),
    noteType,
    swapTag,
    NoteExecutionHint.always(),
    new Felt(BigInt(0)) // aux
  );

  const deadline = 0;

  // Convert min buy amount to BigInt (no decimals - use base units)
  const minBuyAmountBigInt = BigInt(Math.floor(parseFloat(swapParams.buyAmount)));

  // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
  const requestedAssetFelts: Felt[] = [
    buyFaucet.id().prefix(),  // Felt 0: Asset ID prefix
    buyFaucet.id().suffix(),  // Felt 1: Asset ID suffix  
    new Felt(BigInt(0)),      // Felt 2: Always 0
    new Felt(minBuyAmountBigInt) // Felt 3: Min amount out from swap params
  ];

  const inputs = new NoteInputs(new FeltArray([
    ...requestedAssetFelts,     // Felts 0-3: requested asset word
    new Felt(BigInt(1337)),     // zoroswap_tag (use case id)
    new Felt(BigInt(0)),        // p2id_tag 0 SINCE IT IS ALREADY IN METADATA
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
    offeredAsset,
    metadata,
    new NoteRecipient(generateRandomSerialNumber(), script, inputs),
  );

  console.log("Note created successfully with 1 asset");
  const outputNote = OutputNote.full(note);
  
  // Submit the note to the server
  await submitNoteToServer(outputNote);
  
  return outputNote;
}