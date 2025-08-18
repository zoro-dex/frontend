import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';

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

function Faucet(): JSX.Element {
  const [addresses, setAddresses] = useState<Record<TokenType, string>>({
    BTC: '',
    ETH: ''
  });

  const handleAddressChange = (token: TokenType, value: string): void => {
    setAddresses(prev => ({
      ...prev,
      [token]: value
    }));
  };

  const requestTokens = (token: TokenType): void => {
    // Placeholder - backend integration pending
    console.log(`Requesting ${token} for address: ${addresses[token]}`);
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
                      className={`w-full ${token.color} text-white font-medium transition-colors`}
                      variant="ghost"
                    >
                      Request {token.symbol}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Back to App */}
          <div className="text-center">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Zoro AMM
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Faucet;