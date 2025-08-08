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

export async function compileZoroSwapNote(): Promise<OutputNote> {
  const client = await WebClient.createClient("https://rpc.testnet.miden.io:443");
  const prover = TransactionProver.newRemoteProver("https://tx-prover.testnet.miden.io");

  console.log("Latest block:", (await client.syncState()).blockNum());

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

  // ── mint 10 000 BTC to Alice ──────────────────────────────────────────────────────
  await client.submitTransaction(
    await client.newTransaction(
      btcFaucet.id(),
      client.newMintTransactionRequest(
        alice.id(),
        btcFaucet.id(),
        NoteType.Public,
        BigInt(10_000),
      ),
    ),
    prover,
  );

  const script = client.compileNoteScript(ZOROSWAP_SCRIPT);
  const noteType = NoteType.Public;

  const offeredAsset = new NoteAssets([new FungibleAsset(btcFaucet.id(), BigInt(100))]);
  const swapTag = buildSwapTag(noteType, { symbol: 'BTC' }, { symbol: 'ETH' });

  const metadata = new NoteMetadata(
    alice.id(),
    noteType,
    swapTag,
    NoteExecutionHint.always(),
    new Felt(BigInt(0)) // aux
  );

  // Following the pattern: [asset_id_prefix, asset_id_suffix, 0, min_amount_out]
  const requestedAssetFelts: Felt[] = [
    ethFaucet.id().prefix(),  // Felt 0: Asset ID prefix
    ethFaucet.id().suffix(),  // Felt 1: Asset ID suffix  
    new Felt(BigInt(0)),      // Felt 2: Always 0
    new Felt(BigInt(100))     // Felt 3: Min amount out
  ];

  const inputs = new NoteInputs(new FeltArray([
    ...requestedAssetFelts,     // Felts 0-3: requested asset word
    new Felt(BigInt(1337)),     // zoroswap_tag (use case id)
    new Felt(BigInt(0)),        // p2id_tag
    new Felt(BigInt(0)),        // empty_input_6
    new Felt(BigInt(0)),        // empty_input_7
    new Felt(BigInt(0)),        // swap_count
    new Felt(BigInt(0)),        // deadline
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

  console.log("Note created:", note);
  return OutputNote.full(note);
}