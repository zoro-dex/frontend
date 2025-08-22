import { API, NETWORK, TOKENS, type TokenSymbol } from '@/lib/config';
import {
  AccountId,
  Felt,
  FeltArray,
  FungibleAsset,
  Note,
  NoteAssets,
  NoteExecutionHint,
  NoteExecutionMode,
  NoteInputs,
  NoteMetadata,
  NoteRecipient,
  NoteTag,
  NoteType,
  OutputNote,
  OutputNotesArray,
  TransactionProver,
  TransactionRequestBuilder,
  WebClient,
  Word,
} from '@demox-labs/miden-sdk';
import {
  CustomTransaction,
  type MidenTransaction,
  TransactionType,
  type Wallet,
} from '@demox-labs/miden-wallet-adapter';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

// @ts-ignore - MASM files are treated as raw text
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

export interface SwapParams {
  readonly sellToken: TokenSymbol;
  readonly buyToken: TokenSymbol;
  readonly sellAmount: string;
  readonly buyAmount: string; // min_amount_out
  readonly userAccountId: string;
  readonly wallet: Wallet | null;
  readonly requestTransaction: (tx: MidenTransaction) => Promise<string>;
}

export interface SwapResult {
  readonly txId: string;
  readonly noteId: string;
  readonly serializedNote: string;
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
  requestedFaucetId: AccountId,
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

export async function compileZoroSwapNote(swapParams: SwapParams): Promise<SwapResult> {
  // Validate tokens exist in configuration
  const sellTokenConfig = TOKENS[swapParams.sellToken];
  const buyTokenConfig = TOKENS[swapParams.buyToken];
  
  if (!sellTokenConfig || !buyTokenConfig) {
    throw new Error(`Token configuration not found for ${swapParams.sellToken} or ${swapParams.buyToken}`);
  }

  // Create fresh client for this operation - don't reuse clients!
  const client = await WebClient.createClient(NETWORK.rpcEndpoint);
  const prover = TransactionProver.newRemoteProver(NETWORK.txProverEndpoint);

  try {
    // ── Initial sync to ensure client is connected to blockchain ──────────────────
    console.log('🔄 Initial sync to blockchain...');
    await client.syncState();
    console.log('✅ Initial sync complete');

    // Use the faucet IDs from the token configuration
    const sellFaucetId = AccountId.fromBech32(sellTokenConfig.faucetId);
    const buyFaucetId = AccountId.fromBech32(buyTokenConfig.faucetId);

    // Convert amounts to BigInt using token-specific decimals
    const sellAmountNum = parseFloat(swapParams.sellAmount);
    const buyAmountNum = parseFloat(swapParams.buyAmount);
    
    if (isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0 || buyAmountNum <= 0) {
      throw new Error(`Invalid swap amounts: sell=${swapParams.sellAmount}, buy=${swapParams.buyAmount}`);
    }

    const sellAmountBigInt = BigInt(Math.floor(sellAmountNum * Math.pow(10, sellTokenConfig.decimals)));
    const buyAmountBigInt = BigInt(Math.floor(buyAmountNum * Math.pow(10, buyTokenConfig.decimals)));

    const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
    const noteType = NoteType.Public;

    // Create assets using the faucet IDs from token configuration
    const offeredAsset = new FungibleAsset(sellFaucetId, sellAmountBigInt);

    // Build swap tag using the faucet IDs
    const swapTag = buildSwapTag(noteType, sellFaucetId, buyFaucetId);
    console.log('🏷️ Created swapTag:', swapTag);

    // Note should only contain the offered asset
    const noteAssets = new NoteAssets([offeredAsset]);

    const userAddress = AccountId.fromBech32(swapParams.userAccountId);

    const metadata = new NoteMetadata(
      userAddress,
      noteType,
      swapTag,
      NoteExecutionHint.always(),
      new Felt(BigInt(0)), // aux
    );

    const deadline = 0;

    // Use the AccountId for p2id tag
    const p2idTag = NoteTag.fromAccountId(userAddress).asU32();

    // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
    const requestedAssetFelts: Felt[] = [
      buyFaucetId.prefix(), // Felt 0: Asset ID prefix
      buyFaucetId.suffix(), // Felt 1: Asset ID suffix
      new Felt(BigInt(0)), // Felt 2: Always 0
      new Felt(buyAmountBigInt), // Felt 3: Min amount out
    ];

    const inputs = new NoteInputs(
      new FeltArray([
        ...requestedAssetFelts, // Felts 0-3: requested asset word
        new Felt(BigInt(0)), // zoroswap_tag use case id
        new Felt(BigInt(p2idTag)), // p2id_tag
        new Felt(BigInt(0)), // empty_input_6
        new Felt(BigInt(0)), // empty_input_7
        new Felt(BigInt(0)), // swap_count
        new Felt(BigInt(deadline)), // deadline
        new Felt(BigInt(0)), // empty_input_10
        new Felt(BigInt(0)), // empty_input_11
        userAddress.prefix(), // creator_prefix - using AccountId directly
        userAddress.suffix(), // creator_suffix - using AccountId directly
      ]),
    );

    const note = new Note(
      noteAssets,
      metadata,
      new NoteRecipient(generateRandomSerialNumber(), script, inputs),
    );

    const noteId = note.id().toString();
    console.log('📝 Created note:', note);
    console.log('💱 Swap details:', {
      sellToken: swapParams.sellToken,
      buyToken: swapParams.buyToken,
      sellAmount: swapParams.sellAmount,
      buyAmount: swapParams.buyAmount,
      sellFaucetId: sellTokenConfig.faucetId,
      buyFaucetId: buyTokenConfig.faucetId,
      sellDecimals: sellTokenConfig.decimals,
      buyDecimals: buyTokenConfig.decimals,
      sellAmountBigInt: sellAmountBigInt.toString(),
      buyAmountBigInt: buyAmountBigInt.toString(),
      noteId,
    });

    let transactionRequest = new TransactionRequestBuilder()
      .withOwnOutputNotes(new OutputNotesArray([OutputNote.full(note)]))
      .build();

    console.log('📄 TransactionRequest:', transactionRequest);

    const tx = new CustomTransaction(
      swapParams.wallet?.adapter.accountId ?? '', //creatorID
      transactionRequest,
      [],
      [],
    );

    console.log('💳 Tx:', tx);

    // Submit transaction and get transaction ID
    const txId = await swapParams.requestTransaction({
      type: TransactionType.Custom,
      payload: tx,
    });

    console.log('🚀 Transaction submitted with ID:', txId);

    console.log('⏳ Syncing state after transaction submission...');
    await client.syncState();
    
    // Wait for approximately one block time
    console.log('⏰ Waiting for block confirmation...');
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Export note with full details including inclusion proof
    console.log('📤 Exporting note with inclusion proof...');
    const noteExport = await client.exportNote(noteId, 'Full');
    console.log('✅ Note export result:', noteExport);

    // noteExport should be bytes
    let noteBytes: Uint8Array;

    if (noteExport instanceof Uint8Array) {
      noteBytes = noteExport;
    } else if (Array.isArray(noteExport)) {
      noteBytes = new Uint8Array(noteExport);
    } else {
      throw new Error('Invalid note export type');
    }

    // convert to base 64 string
    const base64String = btoa(String.fromCharCode(...noteBytes));
    console.log('🔐 Base64 string length:', base64String.length);

    // Submit the note to the server
    await submitNoteToServer(base64String);

    return {
      txId,
      noteId,
      serializedNote: base64String,
    };
  } catch (error) {
    console.error('❌ ZoroSwap note creation failed:', error);
    throw error;
  }

  async function submitNoteToServer(serializedNote: string): Promise<void> {
    try {
      console.log('📡 Submitting note to server...');
      const response = await fetch(`${API.endpoint}/orders/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note_data: serializedNote,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log('✅ Note submitted to server:', result);
    } catch (error) {
      console.error('❌ Failed to submit note to server:', error);
      throw error;
    }
  }
}