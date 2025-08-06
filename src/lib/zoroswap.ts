import { WebClient, AccountId, Account, AccountStorageMode } from "@demox-labs/miden-sdk";

// Types for swap parameters
interface SwapParams {
  sellToken: 'BTC' | 'ETH';
  buyToken: 'BTC' | 'ETH';
  sellAmount: string;
  buyAmount: string;
  connectedAccountId?: string;
}

interface SwapNoteInputs {
  requestedAssetPrefix: string;
  requestedAssetSuffix: string;
  requestedAmount: string;
  swappTag: string;
  p2idTag: string;
  swappCount: string;
  creatorPrefix: string;
  creatorSuffix: string;
}

interface MockServerResponse {
  success: boolean;
  noteId?: string;
  error?: string;
}

// Constants for token IDs (these would be the actual Miden token IDs)
const TOKEN_IDS = {
  BTC: {
    prefix: "0xe62df6c8b4a85fe1",
    suffix: "0xa67db44dc12de5db"
  },
  ETH: {
    prefix: "0xff61491a931112dd",
    suffix: "0xf1bd8147cd1b6413"
  }
} as const;

// SWAPP script compiled to base64 (this would be the actual compiled script)
const SWAPP_SCRIPT_BASE64 = "U1dBUFBfc2NyaXB0X2NvbXBpbGVkX3RvX2Jhc2U2NA==";

// P2ID script hash for the note (from the Miden Assembly script)
const P2ID_SCRIPT_HASH = [
  "14355791738953101471",
  "16880376862595469307", 
  "4399717636953729920",
  "18023939233288492685"
];

/**
 * Creates swap note inputs based on swap parameters
 */
function createSwapNoteInputs(params: SwapParams, creatorAccountId: AccountId): SwapNoteInputs {
  const requestedToken = TOKEN_IDS[params.buyToken];
  const sellAmountBaseUnits = Math.floor(parseFloat(params.sellAmount) * 1_000_000);
  const buyAmountBaseUnits = Math.floor(parseFloat(params.buyAmount) * 1_000_000);
  
  // Convert account ID to hex components
  const accountHex = creatorAccountId.toString();
  const creatorPrefix = accountHex.slice(0, 16);
  const creatorSuffix = accountHex.slice(16, 32);
  
  return {
    requestedAssetPrefix: requestedToken.prefix,
    requestedAssetSuffix: requestedToken.suffix,
    requestedAmount: buyAmountBaseUnits.toString(),
    swappTag: "0x53574150", // "SWAP" in hex
    p2idTag: "0x50324944", // "P2ID" in hex  
    swappCount: "1",
    creatorPrefix,
    creatorSuffix
  };
}

/**
 * Compiles the SWAPP note script with inputs
 */
async function compileSwappNote(
  client: WebClient, 
  inputs: SwapNoteInputs
): Promise<string> {
  try {
    // In a real implementation, this would compile the Miden Assembly script
    // with the specific inputs. For now, we'll create a mock compiled note.
    const noteData = {
      script: SWAPP_SCRIPT_BASE64,
      inputs: inputs,
      p2idScriptHash: P2ID_SCRIPT_HASH,
      timestamp: Date.now()
    };
    
    // Convert to base64
    const noteJson = JSON.stringify(noteData);
    const noteBase64 = btoa(noteJson);
    
    console.log("Compiled SWAPP note:", noteData);
    return noteBase64;
    
  } catch (error) {
    console.error("Failed to compile SWAPP note:", error);
    throw new Error("Failed to compile swap note");
  }
}

/**
 * Sends the compiled note to mock server for delegation
 */
async function delegateToMockServer(noteBase64: string): Promise<MockServerResponse> {
  try {
    // Mock server endpoint (replace with actual delegation server)
    const response = await fetch('/api/delegate-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note: noteBase64,
        type: 'SWAPP',
        version: '1.0'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const result: MockServerResponse = await response.json();
    return result;
    
  } catch (error) {
    console.error("Failed to delegate to server:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown server error"
    };
  }
}

/**
 * Main function to create and delegate a Zoro swap note
 */
export async function createZoroSwapNote(params: SwapParams): Promise<void> {
  console.log("Creating Zoro swap note with params:", params);
  
  if (typeof window === "undefined") {
    console.warn("createZoroSwapNote() can only run in the browser");
    return;
  }

  try {
    // Initialize Miden client
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);
    
    // Sync state
    console.log("Syncing client state...");
    const state = await client.syncState();
    console.log("Latest block number:", state.blockNum());
    
    // Get or create creator account
    let creatorAccount: Account;
    if (params.connectedAccountId) {
      console.log("Using connected account:", params.connectedAccountId);
      // In a real implementation, you'd load the existing account
      creatorAccount = await client.newWallet(AccountStorageMode.public(), true);
    } else {
      console.log("Creating new account for swap...");
      creatorAccount = await client.newWallet(AccountStorageMode.public(), true);
    }
    
    console.log("Creator account ID:", creatorAccount.id().toBech32());
    
    // Validate swap parameters
    const sellAmountNum = parseFloat(params.sellAmount);
    const buyAmountNum = parseFloat(params.buyAmount);
    
    if (isNaN(sellAmountNum) || isNaN(buyAmountNum) || sellAmountNum <= 0 || buyAmountNum <= 0) {
      throw new Error("Invalid swap amounts");
    }
    
    if (params.sellToken === params.buyToken) {
      throw new Error("Cannot swap the same token");
    }
    
    console.log(`Creating swap: ${sellAmountNum} ${params.sellToken} → ${buyAmountNum} ${params.buyToken}`);
    
    // Create swap note inputs
    const swapInputs = createSwapNoteInputs(params, creatorAccount.id());
    console.log("Swap note inputs:", swapInputs);
    
    // Compile the SWAPP note
    console.log("Compiling SWAPP note...");
    const compiledNote = await compileSwappNote(client, swapInputs);
    console.log("Note compiled successfully, length:", compiledNote.length);
    
    // Delegate to mock server
    console.log("Delegating note to server...");
    const serverResponse = await delegateToMockServer(compiledNote);
    
    if (serverResponse.success) {
      console.log("✅ Swap note successfully delegated!");
      console.log("Note ID:", serverResponse.noteId);
      
      // You could emit an event here or update UI state
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('swapNoteCreated', {
          detail: {
            noteId: serverResponse.noteId,
            params: params
          }
        }));
      }
      
    } else {
      console.error("❌ Failed to delegate swap note:", serverResponse.error);
      throw new Error(serverResponse.error || "Server delegation failed");
    }
    
  } catch (error) {
    console.error("Failed to create Zoro swap note:", error);
    throw error;
  }
}

// Types for external use
export type { SwapParams, SwapNoteInputs, MockServerResponse };