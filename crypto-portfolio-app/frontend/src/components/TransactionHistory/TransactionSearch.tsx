import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface TransactionSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TransactionSearch: React.FC<TransactionSearchProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search transactions..." 
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
        setIsTyping(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setIsTyping(true);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    setIsTyping(false);
  };

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isTyping && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500">
          Searching...
        </div>
      )}
    </div>
  );
};

export default TransactionSearch;