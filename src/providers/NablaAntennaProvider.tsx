import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext } from 'react';
import { ORACLE, getSupportedAssetIds } from '@/lib/config';

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
  refreshPrices: (ids: readonly string[], force?: boolean) => Promise<void>;
  prices: Record<string, { age: number; priceFeed: PriceData } | undefined>;
  getBinary: () => Promise<string[]>;
}

const NablaAntennaContext = createContext<NablaAntennaContextProps>({
  refreshPrices: () => Promise.resolve(),
  prices: {},
  getBinary: () => Promise.resolve([]),
});

export { NablaAntennaContext };

export const useNablaAntennaPrices = (ids: readonly string[]) => {
  const { prices } = useContext(NablaAntennaContext);
  const res = useMemo(() => {
    let r: Record<string, PriceData> = {};
    const supportedAssetIds = getSupportedAssetIds();
    
    for (const id of ids) {
      // Only return prices for supported assets
      if (prices[id] && supportedAssetIds[id]) {
        r[id] = prices[id].priceFeed;
      }
    }
    return r;
  }, [prices, ids]);
  return res;
};

const fetchNablaAntennaPrices = async (
  assetIds: readonly string[],
): Promise<{
  priceFeeds: Record<string, PriceData>;
  binary: string[];
}> => {
  // Get supported asset IDs dynamically
  const supportedAssetIds = getSupportedAssetIds();
  
  // Filter to only request supported assets
  const supportedIds = assetIds.filter(id => supportedAssetIds[id]);
  
  if (supportedIds.length === 0) {
    return { priceFeeds: {}, binary: ['0x'] };
  }
  
  const params = new URLSearchParams();
  for (const assetId of supportedIds) {
    params.append('ids', assetId);
  }
  
  try {
    const response = await fetch(`${ORACLE.endpoint}?${params}`);
    
    if (!response.ok) {
      return { priceFeeds: {}, binary: ['0x'] };
    }
    
    const prices: NablaAntennaResponse = await response.json();
    
    return {
      priceFeeds: prices.parsed.reduce((allFeeds, feed) => {
        // Only process supported assets
        const assetName = supportedAssetIds[feed.id];
        if (!assetName) {
          return allFeeds;
        }
        
        const priceData = {
          value: (feed.price.price / 1e8),
          publish_time: feed.price.publish_time,
        };
        
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
    async (ids: readonly string[], force?: boolean): Promise<void> => {
      if (isFetching.current) return;
      isFetching.current = true;
      
      const now = Date.now();
      const supportedAssetIds = getSupportedAssetIds();
      
      const want = ids.filter(id =>
        // Only consider supported assets
        supportedAssetIds[id] && (
          force
          || !pricesRef.current[id]
          || (pricesRef.current[id].age < (now / 1000) - ORACLE.cacheTtlSeconds)
        )
      );
      
      if (want.length === 0) {
        isFetching.current = false;
        return;
      }
      
      try {
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
      } finally {
        isFetching.current = false;
      }
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