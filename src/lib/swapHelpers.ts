import { TOKENS, type TokenSymbol } from '@/lib/config';

export interface BalanceValidationState {
  readonly hasInsufficientBalance: boolean;
  readonly isBalanceLoaded: boolean;
}

export interface UsdCalculationData {
  readonly sellUsdValue: string;
  readonly buyUsdValue: string;
  readonly priceFor1: string;
  readonly priceFor1Buy: string;
}

export interface TokenPriceData {
  readonly sellTokenData: any;
  readonly buyTokenData: any;
  readonly sellPrice: { value: number; publish_time: number } | null;
  readonly buyPrice: { value: number; publish_time: number } | null;
}

export interface OriginalInput {
  readonly amount: string;
  readonly token: TokenSymbol;
}

/**
 * Calculate minimum amount out considering slippage
 */
export const calculateMinAmountOut = (
  buyAmount: string,
  slippagePercent: number,
): string => {
  const buyAmountNum = parseFloat(buyAmount);
  if (isNaN(buyAmountNum) || buyAmountNum <= 0) {
    return '';
  }

  const minAmount = buyAmountNum * (1 - slippagePercent / 100);
  return minAmount.toFixed(8);
};

export const getBalanceValidation = (
  sellAmount: string,
  balance: bigint | null,
  tokenSymbol: TokenSymbol,
): BalanceValidationState => {
  const sellAmountNum = parseFloat(sellAmount);

  // If no amount entered, no validation needed
  if (!sellAmount || isNaN(sellAmountNum) || sellAmountNum <= 0) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: balance !== null,
    };
  }

  // If balance not loaded yet, assume it's sufficient (let user try)
  if (balance === null) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: false,
    };
  }

  // Convert sellAmount to BigInt using token-specific decimals
  const token = TOKENS[tokenSymbol];
  if (!token) {
    return {
      hasInsufficientBalance: false,
      isBalanceLoaded: false,
    };
  }

  const sellAmountBigInt = BigInt(
    Math.floor(sellAmountNum * Math.pow(10, token.decimals)),
  );

  return {
    hasInsufficientBalance: sellAmountBigInt > balance,
    isBalanceLoaded: true,
  };
};

/**
 * Format BigInt balance to human-readable string with token-specific decimals
 */
export const formatBalance = (balance: bigint, tokenSymbol: TokenSymbol): string => {
  if (balance === BigInt(0)) {
    return '0';
  }
  const token = TOKENS[tokenSymbol];
  if (!token) return '0';
  const divisor = BigInt(Math.pow(10, token.decimals));
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  // Format with appropriate decimal places
  const fractionalStr = fractionalPart.toString().padStart(token.decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  if (trimmedFractional === '') {
    return wholePart.toString();
  }
  return `${wholePart}.${trimmedFractional}`;
};

/**
 * Calculate and format USD value for a token amount
 */
export const calculateUsdValue = (amount: string, priceUsd: number): string => {
  const amountNum: number = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0 || !priceUsd) {
    return '';
  }
  const usdValue: number = amountNum * priceUsd;
  return usdValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Extract token data and prices from current state
 */
export const extractTokenData = (
  sellToken: TokenSymbol | undefined,
  buyToken: TokenSymbol | undefined,
  tokensLoaded: boolean,
  prices: Record<string, { value: number; publish_time: number }>,
): TokenPriceData => {
  if (!sellToken || !buyToken || !tokensLoaded) {
    return {
      sellTokenData: undefined,
      buyTokenData: undefined,
      sellPrice: null,
      buyPrice: null,
    };
  }

  const sellTokenData = TOKENS[sellToken];
  const buyTokenData = TOKENS[buyToken];

  return {
    sellTokenData,
    buyTokenData,
    sellPrice: sellTokenData ? prices[sellTokenData.priceId] : null,
    buyPrice: buyTokenData ? prices[buyTokenData.priceId] : null,
  };
};

/**
 * Calculate all USD values for display
 */
export const calculateUsdValues = (
  sellAmount: string,
  buyAmount: string,
  tokenData: TokenPriceData,
): UsdCalculationData => {
  const { sellPrice, buyPrice } = tokenData;

  return {
    sellUsdValue: sellPrice ? calculateUsdValue(sellAmount, sellPrice.value) : '',
    buyUsdValue: buyPrice ? calculateUsdValue(buyAmount, buyPrice.value) : '',
    priceFor1: sellPrice ? calculateUsdValue('1', sellPrice.value) : '',
    priceFor1Buy: buyPrice ? calculateUsdValue('1', buyPrice.value) : '',
  };
};

/**
 * Determine if swap can proceed
 */
export const canPerformSwap = (
  sellAmount: string,
  buyAmount: string,
  tokenData: TokenPriceData,
  sellToken: TokenSymbol | undefined,
  buyToken: TokenSymbol | undefined,
  tokensLoaded: boolean,
  balanceValidation: BalanceValidationState,
): boolean => {
  const hasValidAmounts = Boolean(
    sellAmount && buyAmount
      && !isNaN(parseFloat(sellAmount)) && !isNaN(parseFloat(buyAmount))
      && parseFloat(sellAmount) > 0 && parseFloat(buyAmount) > 0,
  );
  const hasValidTokens = Boolean(
    tokenData.sellPrice && tokenData.buyPrice
      && sellToken !== buyToken && sellToken && buyToken && tokensLoaded,
  );
  const hasValidBalance = !balanceValidation.isBalanceLoaded
    || !balanceValidation.hasInsufficientBalance;
  return hasValidAmounts && hasValidTokens && hasValidBalance;
};

/**
 * Calculate price conversion between tokens
 */
export const calculateTokenPrice = (
  sellAmount: string,
  buyAmount: string,
  field: 'sell' | 'buy',
  tokenData: TokenPriceData,
  slippage: number,
  preserveOriginalInput: boolean = false,
): { sellAmount?: string; buyAmount?: string } => {
  const { sellPrice, buyPrice } = tokenData;

  if (!sellPrice || !buyPrice || sellPrice.value <= 0 || buyPrice.value <= 0) {
    return {};
  }

  if (field === 'sell' && sellAmount) {
    const sellAmountNum = parseFloat(sellAmount);
    if (!isNaN(sellAmountNum) && sellAmountNum > 0) {
      const sellValueUsd = sellAmountNum * sellPrice.value;
      const expectedBuyAmount = sellValueUsd / buyPrice.value;
      
      if (preserveOriginalInput) {

        return { buyAmount: expectedBuyAmount.toFixed(8) };
      } else {

        return { buyAmount: expectedBuyAmount.toFixed(8) };
      }
    }
  } else if (field === 'buy' && buyAmount) {
    const buyAmountNum = parseFloat(buyAmount);
    if (!isNaN(buyAmountNum) && buyAmountNum > 0) {
      if (preserveOriginalInput) {
        const buyValueUsd = buyAmountNum * buyPrice.value;
        const sellAmountCalculated = buyValueUsd / sellPrice.value;
        return { sellAmount: sellAmountCalculated.toFixed(8) };
      } else {
        const expectedBuyAmount = buyAmountNum / (1 - slippage / 100);
        const buyValueUsd = expectedBuyAmount * buyPrice.value;
        const sellAmountCalculated = buyValueUsd / sellPrice.value;
        return { sellAmount: sellAmountCalculated.toFixed(8) };
      }
    }
  }

  return {};
};
