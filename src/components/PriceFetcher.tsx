import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext } from 'react';

const MAX_AGE = 3000;

// Define the specific asset IDs we want to support
const SUPPORTED_ASSETS = {
  'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43': 'BTC/USD',
  'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace': 'ETH/USD'
};

export interface PriceData {
  value: number;
  publish_time: number;
}

interface NablaAntennaResponse {
  binary: {
    data: string[];
    encoding: 'hex';
  };
  parsed: {
    id: string;
    price: { price: number; publish_time: number };
  }[];
}

interface NablaAntennaContextProps {
  refreshPrices: (ids: string[], force?: boolean) => void;
  prices: Record<string, { age: number; priceFeed: PriceData } | undefined>;
  getBinary: () => Promise<string[]>;
}

const NablaAntennaContext = createContext<NablaAntennaContextProps>({
  refreshPrices: () => {},
  prices: {},
  getBinary: () => Promise.resolve([]),
});

export { NablaAntennaContext };

export const useNablaAntennaPrices = (ids: string[]) => {
  const { prices } = useContext(NablaAntennaContext);
  const res = useMemo(() => {
    let r: Record<string, PriceData> = {};
    for (const id of ids) {
      // Only return prices for supported assets
      if (prices[id] && SUPPORTED_ASSETS[id as keyof typeof SUPPORTED_ASSETS]) {
        r[id] = prices[id].priceFeed;
      }
    }
    return r;
  }, [prices, ids]);
  return res;
};

const fetchNablaAntennaPrices = async (
  assetIds: string[],
): Promise<{
  priceFeeds: Record<string, PriceData>;
  binary: string[];
}> => {
  // Filter to only request supported assets
  const supportedIds = assetIds.filter(id => SUPPORTED_ASSETS[id as keyof typeof SUPPORTED_ASSETS]);
  
  if (supportedIds.length === 0) {
    return { priceFeeds: {}, binary: ['0x'] };
  }
  
  const params = new URLSearchParams();
  for (const assetId of supportedIds) {
    params.append('ids', assetId);
  }
  
  try {
    const response = await fetch(
      `https://antenna.nabla.fi/v1/updates/price/latest?${params}`,
    );
    
    if (!response.ok) {
      return { priceFeeds: {}, binary: ['0x'] };
    }
    
    const prices: NablaAntennaResponse = await response.json();
    
    return {
      priceFeeds: prices.parsed.reduce((allFeeds, feed) => {
        // Only process supported assets
        const assetName = SUPPORTED_ASSETS[feed.id as keyof typeof SUPPORTED_ASSETS];
        if (!assetName) {
          return allFeeds;
        }
        
        const priceData = {
          value: (feed.price.price / 1e8),
          publish_time: feed.price.publish_time,
        };
        
        // Log price updates to console for monitoring
        console.log(`${assetName}: ${priceData.value.toFixed(2)}`);
        
        return {
          ...allFeeds,
          [feed.id]: priceData,
        };
      }, {} as Record<string, PriceData>),
      binary: prices.binary.data.map(d => `0x${d}`),
    };
  } catch (e) {
    return {
      priceFeeds: {},
      binary: ['0x'],
    };
  }
};

export const NablaAntennaProvider = ({ children }: { children: React.ReactNode }) => {
  const [prices, setPrices] = useState<
    Record<string, { age: number; priceFeed: PriceData } | undefined>
  >({});
  const [binary, setBinary] = useState<string[] | undefined>(undefined);
  const isFetching = useRef(false);
  const pricesRef = useRef(prices);

  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  const refreshPrices = useCallback(
    async (ids: string[], force?: boolean) => {
      if (isFetching.current) return;
      isFetching.current = true;
      
      const now = Date.now();
      const want = ids.filter(id =>
        // Only consider supported assets
        SUPPORTED_ASSETS[id as keyof typeof SUPPORTED_ASSETS] && (
          force
          || !pricesRef.current[id]
          || (pricesRef.current[id].age < (now / 1000) - MAX_AGE)
        )
      );
      
      if (want.length === 0) {
        isFetching.current = false;
        return;
      }
      
      const resp = await fetchNablaAntennaPrices(want);
      
      if (resp) {
        setBinary(resp.binary);
        setPrices(prev => {
          const updates: typeof prev = {};
          for (const feed of Object.keys(resp.priceFeeds)) {
            updates[feed] = {
              age: now,
              priceFeed: resp.priceFeeds[feed],
            };
          }
          return { ...prev, ...updates };
        });
      }
      
      isFetching.current = false;
    },
    [],
  );

  const getBinary = useCallback(() => Promise.resolve(binary ?? []), [binary]);

  const contextValue = useMemo(
    () => ({ prices, refreshPrices, getBinary }),
    [prices, refreshPrices, getBinary],
  );

  return (
    <NablaAntennaContext.Provider value={contextValue}>
      {children}
    </NablaAntennaContext.Provider>
  );
};