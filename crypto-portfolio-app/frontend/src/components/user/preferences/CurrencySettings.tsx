import React, { useState, useMemo } from 'react';
import { DollarSign, Search, TrendingUp, Globe } from 'lucide-react';
import { usePreferences } from '../../../hooks/usePreferences';
import { UserPreferences } from '../../../types/user';

export const CurrencySettings: React.FC = () => {
  const { 
    preferences, 
    currencies, 
    updatePreferences,
    updateRiskTolerance,
    isLoadingCurrencies, 
    isUpdating,
    isUpdatingRiskTolerance
  } = usePreferences();

  const [searchTerm, setSearchTerm] = useState('');

  const currentBaseCurrency = preferences?.baseCurrency || 'USD';
  const currentRiskTolerance = preferences?.riskTolerance || 'moderate';

  // Filter and sort currencies
  const filteredCurrencies = useMemo(() => {
    if (!currencies) return [];
    
    let filtered = currencies.filter(currency => 
      currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      currency.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by: popular first, then alphabetically
    return filtered.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [currencies, searchTerm]);

  const riskToleranceOptions = [
    {
      value: 'conservative' as const,
      label: 'Conservative',
      description: 'Lower risk, steady returns',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-500',
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      description: 'Balanced risk and returns',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-500',
    },
    {
      value: 'aggressive' as const,
      label: 'Aggressive',
      description: 'Higher risk, potential for higher returns',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-500',
    },
  ];

  const handleCurrencyChange = (currencyCode: string) => {
    updatePreferences({ baseCurrency: currencyCode });
  };

  const handleRiskToleranceChange = (riskTolerance: UserPreferences['riskTolerance']) => {
    updateRiskTolerance(riskTolerance);
  };

  return (
    <div className="space-y-8">
      {/* Base Currency */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Base Currency
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose your primary currency for portfolio valuations and calculations.
        </p>

        {/* Currency Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search currencies..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Currency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
          {isLoadingCurrencies ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              Loading currencies...
            </div>
          ) : filteredCurrencies.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              No currencies found matching "{searchTerm}"
            </div>
          ) : (
            filteredCurrencies.map((currency) => {
              const isSelected = currentBaseCurrency === currency.code;
              
              return (
                <button
                  key={currency.code}
                  onClick={() => handleCurrencyChange(currency.code)}
                  disabled={isUpdating}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                    ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    {currency.flag && (
                      <span className="text-lg">{currency.flag}</span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                          {currency.code}
                        </span>
                        {currency.popular && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {currency.name}
                      </p>
                      <p className={`text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`}>
                        {currency.symbol}
                      </p>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Risk Tolerance */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Risk Tolerance
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Select your investment risk preference to receive personalized recommendations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {riskToleranceOptions.map((option) => {
            const isSelected = currentRiskTolerance === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleRiskToleranceChange(option.value)}
                disabled={isUpdatingRiskTolerance}
                className={`
                  relative p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected
                    ? `${option.borderColor} ${option.bgColor}`
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                  ${isUpdatingRiskTolerance ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="text-center">
                  <TrendingUp className={`h-8 w-8 mx-auto mb-3 ${isSelected ? option.color : 'text-gray-400'}`} />
                  <h4 className={`font-semibold text-lg ${isSelected ? option.color : 'text-gray-900 dark:text-white'}`}>
                    {option.label}
                  </h4>
                  <p className={`text-sm mt-2 ${isSelected ? option.color : 'text-gray-600 dark:text-gray-400'}`}>
                    {option.description}
                  </p>
                </div>
                
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${option.color.includes('green') ? 'bg-green-500' : option.color.includes('yellow') ? 'bg-yellow-500' : 'bg-red-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Risk Tolerance Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                How Risk Tolerance Affects Your Experience
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                <li>• Personalized investment recommendations</li>
                <li>• Risk-adjusted portfolio analysis</li>
                <li>• Customized alert thresholds</li>
                <li>• Tailored educational content</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};