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
  NoteScript,
  NoteTag,
  NoteType,
  OutputNote,
  OutputNotesArray,
  TransactionRequest,
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

import { accountIdToBech32, bech32ToAccountId } from './utils';
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';
import { clientTracker } from '@/lib/clientTracker';

interface TokenConfig {
  readonly symbol: string;
  readonly name: string;
  readonly priceId: string;
  readonly icon: string;
  readonly iconClass?: string;
  readonly decimals: number;
  readonly faucetId: string;
}

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

export interface TracePoint {
  readonly step: string;
  readonly success: boolean;
  readonly error?: string;
  readonly data?: Record<string, unknown>;
}

function traceStep<T>(step: string, fn: () => T): T {
  console.log(`🔄 [${step}] Starting...`);
  try {
    const result = fn();
    console.log(`✅ [${step}] Success`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [${step}] Failed:`, errorMessage);
    throw new Error(`[${step}] ${errorMessage}`);
  }
}

async function traceAsyncStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
  console.log(`🔄 [${step}] Starting async...`);
  try {
    const result = await fn();
    console.log(`✅ [${step}] Async success`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [${step}] Async failed:`, errorMessage);
    throw new Error(`[${step}] ${errorMessage}`);
  }
}

function generateRandomSerialNumber(): Word {
  return traceStep('generateRandomSerialNumber', () => {
    return Word.newFromFelts([
      new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
      new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
      new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
      new Felt(BigInt(Math.floor(Math.random() * 0x1_0000_0000))),
    ]);
  });
}

export async function compileZoroSwapNote(
  swapParams: SwapParams,
  client: WebClient,
): Promise<SwapResult> {
  console.log('📋 Received swapParams:', swapParams);
  console.log('🔌 Received client:', !!client);
  
  const swapStartId = clientTracker.trackAccess('swap-start');
  
  const trace: TracePoint[] = [];

  try { 
    // Step 1: Validate tokens
    const sellTokenConfig = traceStep('validateSellToken', (): TokenConfig => {
      const config = TOKENS[swapParams.sellToken];
      if (!config) {
        throw new Error(`Sell token configuration not found: ${swapParams.sellToken}`);
      }
      return config;
    });

    const buyTokenConfig = traceStep('validateBuyToken', (): TokenConfig => {
      const config = TOKENS[swapParams.buyToken];
      if (!config) {
        throw new Error(`Buy token configuration not found: ${swapParams.buyToken}`);
      }
      return config;
    });

    if (!swapParams.userAccountId) {
      throw new Error('[validateUserAccount] No userAccountId provided');
    }

    trace.push({ step: 'tokenValidation', success: true });

    // Step 2: Client sync (potential error source #1)
    const syncOpId = clientTracker.trackAccess('swap-syncState');
    
    await traceAsyncStep('clientSync', async (): Promise<void> => {
      await client.syncState();
    });
    
    clientTracker.trackComplete(syncOpId);
    trace.push({ step: 'clientSync', success: true });

    // Step 3: Account ID conversions (potential error source #2)
    const sellFaucetId = traceStep('convertSellFaucetId', (): AccountId => {
      return bech32ToAccountId(sellTokenConfig.faucetId);
    });

    const buyFaucetId = traceStep('convertBuyFaucetId', (): AccountId => {
      return bech32ToAccountId(buyTokenConfig.faucetId);
    });

    trace.push({ step: 'accountIdConversion', success: true });

    // Step 4: Amount validation and conversion
    const { sellAmountBigInt, minAmountOutBigInt } = traceStep('amountConversion', (): { 
      sellAmountBigInt: bigint; 
      minAmountOutBigInt: bigint; 
    } => {
      const sellAmountNum = parseFloat(swapParams.sellAmount);
      const minAmountOutNum = parseFloat(swapParams.minAmountOut);

      if (isNaN(sellAmountNum) || isNaN(minAmountOutNum) || sellAmountNum <= 0 || minAmountOutNum <= 0) {
        throw new Error(`Invalid amounts: sell=${swapParams.sellAmount}, minOut=${swapParams.minAmountOut}`);
      }

      return {
        sellAmountBigInt: BigInt(Math.floor(sellAmountNum * Math.pow(10, sellTokenConfig.decimals))),
        minAmountOutBigInt: BigInt(Math.floor(minAmountOutNum * Math.pow(10, buyTokenConfig.decimals))),
      };
    });

    trace.push({ step: 'amountConversion', success: true });

    // Step 5: Script compilation (potential error source #3)
    const compileOpId = clientTracker.trackAccess('swap-compileScript');
    
    const script = traceStep('compileScript', (): NoteScript => {
      return client.compileNoteScript(ZOROSWAP_SCRIPT);
    });
    
    clientTracker.trackComplete(compileOpId);
    trace.push({ step: 'scriptCompilation', success: true });

    // Step 6: Asset creation (potential error source #4)
    const offeredAsset = traceStep('createOfferedAsset', (): FungibleAsset => {
      return new FungibleAsset(sellFaucetId, sellAmountBigInt);
    });

    const noteAssets = traceStep('createNoteAssets', (): NoteAssets => {
      return new NoteAssets([offeredAsset]);
    });

    trace.push({ step: 'assetCreation', success: true });

    // Step 7: Note metadata creation (potential error source #5)
    const noteTag = traceStep('createNoteTag', (): NoteTag => {
      return NoteTag.fromAccountId(poolAccountId);
    });

    const metadata = traceStep('createMetadata', (): NoteMetadata => {
      return new NoteMetadata(
        swapParams.userAccountId as AccountId,
        NoteType.Public,
        noteTag,
        NoteExecutionHint.always(),
        new Felt(BigInt(0)),
      );
    });

    trace.push({ step: 'metadataCreation', success: true });

    // Step 8: Input creation (potential error source #6)
    const deadline = Date.now() + 120_000;
    const p2idTag = traceStep('createP2idTag', (): number => {
      return NoteTag.fromAccountId(swapParams.userAccountId as AccountId).asU32();
    });

    const inputs = traceStep('createInputs', (): NoteInputs => {
      return new NoteInputs(
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
          (swapParams.userAccountId as AccountId).suffix(),
          (swapParams.userAccountId as AccountId).prefix(),
        ]),
      );
    });

    trace.push({ step: 'inputCreation', success: true });

    // Step 9: Note creation (potential error source #7)
    const note = traceStep('createNote', (): Note => {
      const recipient = new NoteRecipient(generateRandomSerialNumber(), script, inputs);
      return new Note(noteAssets, metadata, recipient);
    });

    const noteId = traceStep('getNoteId', (): string => {
      return note.id().toString();
    });

    trace.push({ step: 'noteCreation', success: true });

    // Step 10: Transaction creation (potential error source #8)
    const transactionRequest = traceStep('createTransactionRequest', (): TransactionRequest => {
      return new TransactionRequestBuilder()
        .withOwnOutputNotes(new OutputNotesArray([OutputNote.full(note)]))
        .build();
    });

    const tx = traceStep('createCustomTransaction', (): CustomTransaction => {
      return new CustomTransaction(
        accountIdToBech32(swapParams.userAccountId as AccountId),
        transactionRequest,
        [],
        [],
      );
    });

    trace.push({ step: 'transactionCreation', success: true });

    // Step 11: Transaction submission (potential error source #9)
    const submitOpId = clientTracker.trackAccess('swap-submitTransaction');
    
    const txId = await traceAsyncStep('submitTransaction', async (): Promise<string> => {
      return await swapParams.requestTransaction({
        type: TransactionType.Custom,
        payload: tx,
      });
    });
    
    clientTracker.trackComplete(submitOpId);
    trace.push({ step: 'transactionSubmission', success: true });

    clientTracker.trackComplete(swapStartId);

    console.log('🎯 compileZoroSwapNote COMPLETED - returning result');
    
    return { txId, noteId };

  } catch (error) {
    console.error('💥 compileZoroSwapNote FAILED:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lastSuccessfulStep = trace.filter(t => t.success).pop()?.step || 'none';
    
    throw new Error(`Swap failed after step '${lastSuccessfulStep}': ${errorMessage}`);
  }
}