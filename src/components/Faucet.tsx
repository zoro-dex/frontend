import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Loader2, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface FaucetRequest {
  success: boolean;
  txHash?: string;
  amount?: string;
  error?: string;
}

interface RateLimitData {
  [key: string]: number;
}

type TokenType = 'BTC' | 'ETH';

const TOKENS = {
  BTC: {
    symbol: 'BTC',
    name: 'Test Bitcoin',
    amount: '0.1',
    color: 'bg-orange-500 hover:bg-orange-600',
    icon: '/BTC.svg',
    iconClass: ''
  },
  ETH: {
    symbol: 'ETH', 
    name: 'Test Ethereum',
    amount: '1.0',
    color: 'bg-blue-500 hover:bg-blue-600',
    icon: '/ETH.svg',
    iconClass: 'dark:invert'
  }
} as const;

const RATE_LIMIT_STORAGE_KEY = 'zoro_faucet_requests';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function Faucet() {
  const [addresses, setAddresses] = useState<Record<TokenType, string>>({
    BTC: '',
    ETH: ''
  });
  const [loading, setLoading] = useState<Record<TokenType, boolean>>({
    BTC: false,
    ETH: false
  });
  const [statuses, setStatuses] = useState<Record<TokenType, {
    message: string;
    type: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  }>>({
    BTC: { message: '', type: 'idle' },
    ETH: { message: '', type: 'idle' }
  });

  // Check for address in URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get('address');
    if (address && isValidMidenAddress(address)) {
      setAddresses({
        BTC: address,
        ETH: address
      });
    }
  }, []);

  const isValidMidenAddress = (address: string): boolean => {
    return Boolean(address && address.length >= 16 && /^[a-fA-F0-9]+$/.test(address));
  };

  const getRateLimitData = (): RateLimitData => {
    try {
      const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const setRateLimitData = (address: string, token: TokenType): void => {
    try {
      const data = getRateLimitData();
      const key = `${address}_${token}`;
      data[key] = Date.now();
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save rate limit data:', error);
    }
  };

  const isRateLimited = (address: string, token: TokenType): boolean => {
    const data = getRateLimitData();
    const key = `${address}_${token}`;
    const lastRequest = data[key];
    
    if (!lastRequest) return false;
    
    return (Date.now() - lastRequest) < TWENTY_FOUR_HOURS;
  };

  const getTimeUntilNextRequest = (address: string, token: TokenType): number => {
    const data = getRateLimitData();
    const key = `${address}_${token}`;
    const lastRequest = data[key];
    
    if (!lastRequest) return 0;
    
    const timeLeft = TWENTY_FOUR_HOURS - (Date.now() - lastRequest);
    return Math.max(0, timeLeft);
  };

  const formatTimeLeft = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const mockFaucetRequest = async (token: TokenType, address: string): Promise<FaucetRequest> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate success for demo purposes
    return {
      success: true,
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      amount: TOKENS[token].amount
    };
  };

  const updateStatus = (token: TokenType, message: string, type: 'idle' | 'loading' | 'success' | 'error' | 'warning'): void => {
    setStatuses(prev => ({
      ...prev,
      [token]: { message, type }
    }));
  };

  const handleAddressChange = (token: TokenType, value: string): void => {
    setAddresses(prev => ({
      ...prev,
      [token]: value
    }));
    
    // Clear status when address changes
    if (statuses[token].message) {
      updateStatus(token, '', 'idle');
    }
  };

  const requestTokens = async (token: TokenType): Promise<void> => {
    const address = addresses[token].trim();
    
    if (!address) {
      updateStatus(token, 'Please enter your account address', 'warning');
      return;
    }

    if (!isValidMidenAddress(address)) {
      updateStatus(token, 'Invalid Miden account address format', 'error');
      return;
    }

    if (isRateLimited(address, token)) {
      const timeLeft = getTimeUntilNextRequest(address, token);
      updateStatus(token, `Rate limited. Try again in ${formatTimeLeft(timeLeft)}`, 'warning');
      return;
    }

    setLoading(prev => ({ ...prev, [token]: true }));
    updateStatus(token, `Sending ${token} to your account...`, 'loading');

    try {
      const result = await mockFaucetRequest(token, address);
      
      if (result.success) {
        setRateLimitData(address, token);
        updateStatus(token, `Success! Sent ${result.amount} ${token} to your account`, 'success');
        setAddresses(prev => ({ ...prev, [token]: '' }));
      } else {
        throw new Error(result.error || 'Faucet request failed');
      }
    } catch (error) {
      console.error(`${token} faucet error:`, error);
      updateStatus(token, 'Request failed. Please try again later.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, [token]: false }));
    }
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusTextColor = (type: string): string => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'loading':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6">

          {/* Faucet Cards */}
          <div className="space-y-4">
            {(Object.entries(TOKENS) as [TokenType, typeof TOKENS[TokenType]][]).map(([tokenKey, token]) => (
              <Card key={tokenKey} className="rounded-xl hover:shadow-lg transition-all duration-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img 
                      src={token.icon} 
                      alt={token.name} 
                      className={`w-10 h-10 sm:w-12 sm:h-12 ${token.iconClass}`}
                    />
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold">{token.name}</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        Get {token.amount} {token.symbol} every 24 hours
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={addresses[tokenKey]}
                      onChange={(e) => handleAddressChange(tokenKey, e.target.value)}
                      placeholder="Enter your Miden account address"
                      className="text-sm"
                    />
                    
                    <Button 
                      onClick={() => requestTokens(tokenKey)}
                      disabled={loading[tokenKey]}
                      className={`w-full ${token.color} text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading[tokenKey] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        `Request ${token.symbol}`
                      )}
                    </Button>
                    
                    {statuses[tokenKey].message && (
                      <div className={`flex items-center justify-center gap-2 text-xs sm:text-sm ${getStatusTextColor(statuses[tokenKey].type)} min-h-5`}>
                        {getStatusIcon(statuses[tokenKey].type)}
                        <span>{statuses[tokenKey].message}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Back to App */}
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Zoro AMM
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Faucet;