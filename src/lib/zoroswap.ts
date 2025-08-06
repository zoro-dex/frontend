import { 
  WebClient,
  AccountStorageMode,
  AccountId,
  NoteType,
  TransactionProver,
  NoteInputs,
  Note,
  NoteAssets,
  NoteRecipient,
  Word,
  OutputNotesArray,
  NoteExecutionHint,
  NoteTag,
  NoteExecutionMode,
  NoteMetadata,
  FeltArray,
  Felt,
  FungibleAsset,
  TransactionRequestBuilder,
  OutputNote
} from "@demox-labs/miden-sdk";

// @ts-ignore - MASM files are treated as raw text
import ZOROSWAP_SCRIPT from './ZOROSWAP.masm?raw';

export async function sendZoroSwapNote(): Promise<void> {
  // Ensure this runs only in a browser context
  if (typeof window === "undefined") return console.warn("Run in browser");

  const client = await WebClient.createClient("https://rpc.testnet.miden.io:443");

  const prover = TransactionProver.newRemoteProver(
    "https://tx-prover.testnet.miden.io/",
  )

  console.log("Latest block:", (await client.syncState()).blockNum());

  // ── Creating new account ──────────────────────────────────────────────────────
  console.log("Creating account for Alice…");
  const alice = await client.newWallet(AccountStorageMode.public(), true);
  console.log("Alice accout ID:", alice.id().toString());

  // ── Creating new faucet ──────────────────────────────────────────────────────
  const faucet = await client.newFaucet(
    AccountStorageMode.public(),
    false,
    "BTC",
    8,
    BigInt(1_000_000),
  );
  console.log("Faucet ID:", faucet.id().toString());

  // ── mint 10 000 BTC to Alice ──────────────────────────────────────────────────────
  await client.submitTransaction(
    await client.newTransaction(
      faucet.id(),
      client.newMintTransactionRequest(
        alice.id(),
        faucet.id(),
        NoteType.Public,
        BigInt(10_000),
      ),
    ),
    prover,
  );

  console.log("waiting for settlement");
  await new Promise((r) => setTimeout(r, 7_000));
  await client.syncState();

  // ── consume the freshly minted notes ──────────────────────────────────────────────
  const noteIds = (await client.getConsumableNotes(alice.id())).map((rec) =>
    rec.inputNoteRecord().id().toString(),
  );

  await client.submitTransaction(
    await client.newTransaction(
      alice.id(),
      client.newConsumeTransactionRequest(noteIds),
    ),
    prover,
  );
  await client.syncState();

  const script = client.compileNoteScript(ZOROSWAP_SCRIPT);

}
