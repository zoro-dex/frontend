import { useDeposit } from '@/hooks/useDeposit';
import { useLPBalance } from '@/hooks/useLPBalance';
import { useWithdraw } from '@/hooks/useWithdraw';
import { ZoroContext } from '@/providers/ZoroContext';
import { Loader } from 'lucide-react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { parseUnits } from 'viem';
import { useBalance } from '../hooks/useBalance';
import { type PoolInfo } from '../hooks/usePoolsInfo';
import { ModalContext } from '../providers/ModalContext';
import globalStyles from '../styles/GlobalStyles.module.css';
import styles from '../styles/Modal.module.css';
import { formatTokenAmount } from '../utils/format';
import Slippage from './Slippage';
import { Button } from './ui/button';

interface PoolModalProps {
  pool: PoolInfo;
  refetchPoolInfo?: () => void;
}

const validateValue = (val: bigint, max: bigint) => {
  return val > max
    ? 'Amount too large'
    : val <= 0
    ? 'Invalid value'
    : undefined;
};

const PoolModal = ({ pool, refetchPoolInfo }: PoolModalProps) => {
  const modalContext = useContext(ModalContext);
  const { tokens } = useContext(ZoroContext);
  const [mode, setMode] = useState<'Deposit' | 'Withdraw'>('Deposit');
  const [rawValue, setRawValue] = useState(BigInt(0));
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const token = useMemo(
    () => Object.values(tokens).find(t => t.faucetIdBech32 === pool.faucetIdBech32),
    [tokens],
  );
  const { balance: balanceToken, refetch: refetchBalanceToken } = useBalance({
    token,
  });
  const { balance: balanceContractToken, refetch: refetchBalanceWallet } = useLPBalance();
  const balance = useMemo(
    () =>
      mode === 'Deposit'
        ? balanceContractToken ?? BigInt(0)
        : balanceToken ?? BigInt(0),
    [balanceToken, balanceContractToken, mode],
  );
  const decimals = pool.decimals;

  // DEPOSITING
  const { deposit, isLoading: isDepositLoading } = useDeposit({
    pool,
    slippage,
  });
  const writeDeposit = useCallback(async () => {
    await deposit({
      amount: rawValue,
    });
  }, [rawValue, deposit]);

  // WITHDRAWING
  const { withdraw, isLoading: isWithdrawLoading } = useWithdraw(
    { pool, slippage },
  );
  const writeWithdraw = useCallback(() => {
    withdraw({
      amount: rawValue,
    });
  }, [rawValue, withdraw]);

  const clearForm = useCallback(() => {
    setInputValue('');
    setRawValue(BigInt(0));
    refetchBalanceToken().catch(console.error);
    refetchBalanceWallet();
    refetchPoolInfo?.();
  }, [
    refetchBalanceToken,
    refetchBalanceWallet,
    refetchPoolInfo,
  ]);

  const setAmountPercentage = useCallback(
    (percentage: number) => {
      const newValue = (BigInt(percentage) * balance) / BigInt(100);
      setRawValue(newValue);
      setInputError(undefined);
      setInputValue(
        (formatTokenAmount({ value: newValue, expo: decimals }) ?? '').toString(),
      );
    },
    [decimals, balance],
  );
  const onInputChange = useCallback((val: string) => {
    setInputValue(val);
    if (val === '') {
      setInputError(undefined);
      setRawValue(BigInt(0));
      return;
    }
    const parsed = parseUnits(val, decimals);
    const validationError = validateValue(parsed, balance);
    if (validationError) {
      setInputError(validationError);
    } else {
      setInputError(undefined);
      setRawValue(parseUnits(val, decimals));
    }
  }, [decimals, balance]);

  return (
    <div className={styles.modalContainer}>
      <div className={styles.modalTabs}>
        <div
          onClick={() => {
            modalContext.closeModal();
          }}
          className={`${styles.closeBtn} ${globalStyles.hint} ${globalStyles.clickable}`}
        />
        <div
          className={`${styles.modalTab} 
              ${mode === 'Deposit' ? styles.modalTabActive : ''}
          `}
          onClick={() => {
            setMode('Deposit');
            clearForm();
          }}
        >
          Deposit
        </div>
        <div
          className={`${styles.modalTab} 
              ${mode === 'Withdraw' ? styles.modalTabActive : ''}
          `}
          onClick={() => {
            setMode('Withdraw');
            clearForm();
          }}
        >
          Withdraw
        </div>
      </div>{' '}
      <div className={styles.modalInput}>
        <p className={globalStyles.hint}>
          {mode === 'Deposit' ? 'Deposit amount' : 'Withdrawal amount'}
        </p>
        <input
          className={globalStyles.input}
          value={inputValue}
          placeholder='0.0'
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
        />
        {inputError ? <p className={globalStyles.errorHint}>{inputError}</p> : null}
        <div className={styles.modalSmallButtons}>
          <Button
            onClick={() => {
              setAmountPercentage(25);
            }}
          >
            25 %
          </Button>
          <Button
            onClick={() => {
              setAmountPercentage(50);
            }}
          >
            50 %
          </Button>
          <Button
            onClick={() => {
              setAmountPercentage(75);
            }}
          >
            75 %
          </Button>
          <Button
            onClick={() => {
              setAmountPercentage(100);
            }}
          >
            100 %
          </Button>
        </div>
      </div>
      <div className={styles.details}>
        <Slippage slippage={slippage} onSlippageChange={setSlippage} />
        <p>
          <span>Balance</span>
          <span>
            {formatTokenAmount({
              value: balanceContractToken,
              expo: pool.decimals,
            })} {pool.symbol}
          </span>
        </p>
        <p>
          <span>My position</span>
          <span>
            {formatTokenAmount({
              value: balanceToken,
              expo: pool.decimals,
            })} {pool.symbol}
          </span>
        </p>
      </div>
      <div className={styles.modalAction}>
        {mode === 'Deposit'
          ? (
            <Button
              onClick={() => writeDeposit().catch(console.error)}
              disabled={rawValue === BigInt(0)}
            >
              {isDepositLoading && <Loader />}
            </Button>
          )
          : null}
        {mode === 'Withdraw'
          ? (
            <Button
              onClick={writeWithdraw}
              disabled={rawValue === BigInt(0)}
            >
              {isWithdrawLoading && <Loader />}
              Withdraw
            </Button>
          )
          : null}
      </div>
    </div>
  );
};

export default PoolModal;
