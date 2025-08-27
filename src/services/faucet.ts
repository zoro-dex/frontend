/**
 * Faucet service for minting test tokens from Zoro backend
 * Handles rate limiting and queue management on the server side
 */

export interface FaucetMintRequest {
  readonly account_id: string;
  readonly faucet_id: string;
}

export interface FaucetMintResponse {
  readonly success: boolean;
  readonly message?: string;
  readonly transaction_id?: string;
  readonly error?: string;
}

export interface FaucetMintResult {
  readonly success: boolean;
  readonly message: string;
  readonly transactionId?: string;
}

/**
 * Mint tokens from a specific faucet to the user's account
 * The server handles rate limiting (5 second guard) and queuing (up to 100 requests)
 */
export async function mintFromFaucet(
  accountId: string, 
  faucetId: string
): Promise<FaucetMintResult> {
  const request: FaucetMintRequest = {
    account_id: accountId,
    faucet_id: faucetId,
  };

  try {
    const response = await fetch('https://api.zoroswap.com/faucets/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: FaucetMintResponse = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        message: result.error || result.message || 'Mint request failed',
      };
    }

    return {
      success: true,
      message: result.message || "Ka-ching! Claim the tokens in your wallet in a sec.",
      transactionId: result.transaction_id,
    };

  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: "Not so fast! Wait 5 secs and try again.",
      };
    }

    return {
      success: false,
      message: 'Unknown error occurred during mint request',
    };
  }
}