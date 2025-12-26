import { OracleContext } from '@/providers/OracleContext';
import { formalNumberFormat } from '@/utils/format';
import { useContext } from 'react';

const Price = ({ oracleId }: { oracleId: string }) => {
  const { prices } = useContext(OracleContext);
  const price = prices[oracleId]?.priceFeed;
  const formattedPrice = formalNumberFormat(price?.value);
  return <>{formattedPrice}</>;
};

export default Price;
