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
  WebClient,
  Word,
} from '@demox-labs/miden-sdk';
import {
  CustomTransaction,
  type MidenTransaction,
  TransactionType,
} from '@demox-labs/miden-wallet-adapter';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

export interface SwapParams {
  readonly sellToken: TokenSymbol;
  readonly buyToken: TokenSymbol;
  readonly sellAmount: string;
  readonly buyAmount: string;
  readonly minAmountOut: string;
  readonly userAccountId?: AccountId;
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

export async function compileZoroSwapNote(
  swapParams: SwapParams,
  client: WebClient,
): Promise<SwapResult> {
  // Validate tokens exist in configuration
  const sellTokenConfig = TOKENS[swapParams.sellToken];
  const buyTokenConfig = TOKENS[swapParams.buyToken];

  if (!swapParams.userAccountId) throw new Error(`No userAccount.`);
  if (!sellTokenConfig || !buyTokenConfig) {
    throw new Error(
      `Token configuration not found for ${swapParams.sellToken} or ${swapParams.buyToken}`,
    );
  }

  try {

    await client.syncState();

    const sellFaucetId = AccountId.fromBech32(sellTokenConfig.faucetId);
    const buyFaucetId = AccountId.fromBech32(buyTokenConfig.faucetId);

    const sellAmountNum = parseFloat(swapParams.sellAmount);
    const minAmountOutNum = parseFloat(swapParams.minAmountOut);

   if (
      isNaN(sellAmountNum) || isNaN(minAmountOutNum) || 
      sellAmountNum <= 0 || minAmountOutNum <= 0
    ) {
      throw new Error(
        `Invalid swap amounts: sell=${swapParams.sellAmount}, expectedBuy=${swapParams.minAmountOut}`,
      );
    }

    const sellAmountBigInt = BigInt(
      Math.floor(sellAmountNum * Math.pow(10, sellTokenConfig.decimals)),
    );
    const minAmountOutBigInt = BigInt(
      Math.floor(minAmountOutNum * Math.pow(10, buyTokenConfig.decimals)),
    );

    const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
    const noteType = NoteType.Public;

    const offeredAsset = new FungibleAsset(sellFaucetId, sellAmountBigInt);

    // Note should only contain the offered asset
    const noteAssets = new NoteAssets([offeredAsset]);
    const noteTag = NoteTag.fromAccountId(poolAccountId);

    const metadata = new NoteMetadata(
      swapParams.userAccountId,
      noteType,
      noteTag,
      NoteExecutionHint.always(),
      new Felt(BigInt(0)), // aux
    );

    const deadline = Date.now() + 120_000; // 2 min from now

    // Use the AccountId for p2id tag
    const p2idTag = NoteTag.fromAccountId(swapParams.userAccountId).asU32();

    // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
    const inputs = new NoteInputs(
      new FeltArray([
        new Felt(minAmountOutBigInt),
        new Felt(BigInt(0)),
        buyFaucetId.suffix(),
        buyFaucetId.prefix(),
        new Felt(BigInt(deadline)),
        new Felt(BigInt(p2idTag)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        new Felt(BigInt(0)),
        swapParams.userAccountId.suffix(),
        swapParams.userAccountId.prefix(),
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
      swapParams.userAccountId.toBech32(), // creatorID
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

    await client.syncState();

    return {
      txId,
      noteId,
    };
  } catch (error) {
    throw error;
  }
}
