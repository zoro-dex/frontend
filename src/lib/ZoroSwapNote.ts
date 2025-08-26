import { poolAccountId, TOKENS, type TokenSymbol } from '@/lib/config';
import {
  AccountId,
  Felt,
  FeltArray,
  FungibleAsset,
  Note,
  NoteAssets,
  NoteExecutionHint,
  NoteInputs,
  NoteMetadata,
  NoteRecipient,
  NoteTag,
  NoteType,
  OutputNote,
  OutputNotesArray,
  TransactionRequestBuilder,
  Word,
} from '@demox-labs/miden-sdk';
import {
  CustomTransaction,
  type MidenTransaction,
  TransactionType,
  type Wallet,
} from '@demox-labs/miden-wallet-adapter';
import { Buffer } from 'buffer';
import { midenClientService } from '@/lib/client';

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
    throw new Error(
      `Token configuration not found for ${swapParams.sellToken} or ${swapParams.buyToken}`,
    );
  }

  try {
    // ── Use single client service ──────────────
    const client = await midenClientService.getClient();
    await midenClientService.ensureSynced();

    // Use the faucet IDs from the token configuration
    const sellFaucetId = AccountId.fromBech32(sellTokenConfig.faucetId);
    const buyFaucetId = AccountId.fromBech32(buyTokenConfig.faucetId);

    // Convert amounts to BigInt using token-specific decimals
    const sellAmountNum = parseFloat(swapParams.sellAmount);
    const buyAmountNum = parseFloat(swapParams.buyAmount);

    if (
      isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0
      || buyAmountNum <= 0
    ) {
      throw new Error(
        `Invalid swap amounts: sell=${swapParams.sellAmount}, buy=${swapParams.buyAmount}`,
      );
    }

    const sellAmountBigInt = BigInt(
      Math.floor(sellAmountNum * Math.pow(10, sellTokenConfig.decimals)),
    );
    const buyAmountBigInt = BigInt(
      Math.floor(buyAmountNum * Math.pow(10, buyTokenConfig.decimals)),
    );

    const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
    const noteType = NoteType.Public;

    // Create assets using the faucet IDs from token configuration
    const offeredAsset = new FungibleAsset(sellFaucetId, sellAmountBigInt);

    // Note should only contain the offered asset
    const noteAssets = new NoteAssets([offeredAsset]);
    const noteTag = NoteTag.fromAccountId(poolAccountId);

    const userAddress = AccountId.fromBech32(swapParams.userAccountId);

    const metadata = new NoteMetadata(
      userAddress,
      noteType,
      noteTag,
      NoteExecutionHint.always(),
      new Felt(BigInt(0)), // aux
    );

    const deadline = Date.now() + 60_000; // 1 min from now

    // Use the AccountId for p2id tag
    const p2idTag = NoteTag.fromAccountId(userAddress).asU32();

    // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
    const inputs = new NoteInputs(
      new FeltArray([
        new Felt(buyAmountBigInt),
        new Felt(BigInt(0)),
        buyFaucetId.suffix(),
        buyFaucetId.prefix(),
        new Felt(BigInt(deadline)),
        new Felt(BigInt(p2idTag)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        userAddress.suffix(),
        userAddress.prefix(),
      ]),
    );

    const note = new Note(
      noteAssets,
      metadata,
      new NoteRecipient(generateRandomSerialNumber(), script, inputs),
    );

    const noteId = note.id().toString();

    let transactionRequest = new TransactionRequestBuilder()
      .withOwnOutputNotes(new OutputNotesArray([OutputNote.full(note)]))
      .build();

    const tx = new CustomTransaction(
      swapParams.wallet?.adapter.accountId ?? '', // creatorID
      transactionRequest,
      [],
      [],
    );

    // Submit transaction and get transaction ID
    const txId = await swapParams.requestTransaction({
      type: TransactionType.Custom,
      payload: tx,
    });

    console.log('🎉 Swap note created successfully:', {
      txId: txId,
      noteId: noteId,
    });

    // Use client service for post-transaction sync
    await midenClientService.ensureSynced(true); // Force sync after transaction

    return {
      txId,
      noteId,
    };
  } catch (error) {
    throw error;
  }
}