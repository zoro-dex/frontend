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

  const script = client.compileNoteScript(ZOROSWAP_SCRIPT);

  console.log("Compiled script:", script);
}
