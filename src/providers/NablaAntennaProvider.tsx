import { emptyFn } from '@/utils/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const MAX_AGE = 3000;

export interface PriceData {
  value: number;
  publish_time: number;
}

interface NablaAntennaResponse {
  binary: {
    data: `0x${string}`[];
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
  getBinary: (ids?: string[]) => Promise<string[]>;
}

export const NablaAntennaContext = createContext({
  refreshPrices: emptyFn,
  prices: {},
  getBinary: () => Promise.resolve([]),
} as NablaAntennaContextProps);

export const useNablaAntennaPrices = (ids: string[]) => {
  const { prices } = useContext(NablaAntennaContext);
  const res = useMemo(() => {
    const r: Record<string, PriceData> = {};
    for (const id of ids) {
      if (prices[id]) {
        r[id] = prices[id].priceFeed;
      }
    }
    return r;
  }, [prices, ids]);
  return res;
};

export const NablaAntennaProvider = ({ children }: { children: ReactNode }) => {
  const [prices, setPrices] = useState<
    Record<string, { age: number; priceFeed: PriceData } | undefined>
  >({});
  const [binary, setBinary] = useState<`0x${string}`[] | undefined>(undefined);
  const isFetching = useRef(false);

  const pricesRef = useRef(prices);
  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  const refreshPrices = useCallback(
    async (ids: string | string[], force?: boolean) => {
      if (isFetching.current) return;
      isFetching.current = true;

      const now = Date.now();
      const want = (Array.isArray(ids) ? ids : [ids])
        .filter(id =>
          force
          || !pricesRef.current[id]
          || (pricesRef.current[id].age < (now / 1000) - MAX_AGE)
        );

      if (want.length === 0) {
        isFetching.current = false;
        return;
      }

      const resp = await fetchNablaAntennaPrices(
        want,
      );

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

const fetchNablaAntennaPrices = async (
  assetIds: string[],
): Promise<{
  priceFeeds: Record<string, PriceData>;
  binary: `0x${string}`[];
}> => {
  const params = new URLSearchParams();
  for (const assetId of assetIds) {
    params.append('id[]', assetId);
  }
  try {
    const prices: NablaAntennaResponse = await fetch(
      `https://antenna.nabla.fi/v1/updates/price/latest?${params}`,
    ).then((res) => res.json());
    return {
      priceFeeds: prices.parsed.reduce((allFeeds, feed) => ({
        ...allFeeds,
        [feed.id]: {
          value: (feed.price.price / 1e8),
          publish_time: feed.price.publish_time,
        },
      }), {} as Record<string, PriceData>),
      binary: prices.binary.data.map(d => `0x${d}`) as `0x${string}`[],
    };
  } catch (e) {
    console.error(e);
    return {
      priceFeeds: {},
      binary: ['0x'],
    };
  }
};
