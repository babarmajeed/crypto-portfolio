// import { format } from 'date-fns';

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
}

interface SearchFilters {
  priceRange?: { min: number | null; max: number | null };
  marketCapRange?: { min: number | null; max: number | null };
  volumeRange?: { min: number | null; max: number | null };
  changeRange?: { min: number | null; max: number | null };
  categories?: string[];
  exchanges?: string[];
  hasHoldings?: boolean;
  inWatchlist?: boolean;
}

/**
 * Export search results to various formats
 */
export const exportSearchResults = async (
  results: SearchResult[],
  exportFormat: 'csv' | 'json' | 'excel',
  query?: string
): Promise<void> => {
  const timestamp = exportFormat === 'csv' ? new Date().toISOString().slice(0, 19).replace(/:/g, '-') : new Date().toISOString();
  const filename = `search-results-${query || 'all'}-${timestamp}`;

  switch (exportFormat) {
    case 'csv':
      await exportToCSV(results, filename);
      break;
    case 'json':
      await exportToJSON(results, filename, query);
      break;
    case 'excel':
      await exportToExcel(results, filename);
      break;
    default:
      throw new Error(`Unsupported export format: ${exportFormat}`);
  }
};

/**
 * Export search results to CSV
 */
const exportToCSV = async (results: SearchResult[], filename: string): Promise<void> => {
  const headers = [
    'Symbol',
    'Name',
    'Price (USD)',
    '24h Change (%)',
    'Market Cap (USD)',
    'Market Cap Rank',
    '24h Volume (USD)',
    'Image URL'
  ];

  const rows = results.map(result => [
    result.symbol,
    result.name,
    result.currentPrice.toFixed(2),
    result.priceChangePercentage24h.toFixed(2),
    result.marketCap.toFixed(0),
    result.marketCapRank?.toString() || '',
    result.volume24h.toFixed(0),
    result.image
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

/**
 * Export search results to JSON
 */
const exportToJSON = async (
  results: SearchResult[], 
  filename: string,
  query?: string
): Promise<void> => {
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      query: query || null,
      totalResults: results.length,
      exportedBy: 'Crypto Portfolio App'
    },
    results
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

/**
 * Export search results to Excel format (CSV with Excel-friendly formatting)
 */
const exportToExcel = async (results: SearchResult[], filename: string): Promise<void> => {
  const headers = [
    'Symbol',
    'Name',
    'Price',
    '24h Change %',
    'Market Cap',
    'Rank',
    '24h Volume'
  ];

  const rows = results.map(result => [
    result.symbol,
    result.name,
    result.currentPrice,
    result.priceChangePercentage24h,
    result.marketCap,
    result.marketCapRank || 0,
    result.volume24h
  ]);

  // Use tab-separated values for better Excel compatibility
  const tsvContent = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t'))
  ].join('\n');

  downloadFile(tsvContent, `${filename}.xls`, 'application/vnd.ms-excel');
};

/**
 * Download file helper
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Validate search query
 */
export const validateSearchQuery = (query: string): {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
} => {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Basic validation
  if (!query || query.trim().length === 0) {
    errors.push('Search query cannot be empty');
    suggestions.push('Try searching for a cryptocurrency name or symbol');
    return { isValid: false, errors, suggestions };
  }

  const trimmedQuery = query.trim();

  // Length validation
  if (trimmedQuery.length < 2) {
    errors.push('Search query must be at least 2 characters long');
    suggestions.push('Enter more characters for better results');
  }

  if (trimmedQuery.length > 100) {
    errors.push('Search query is too long (maximum 100 characters)');
    suggestions.push('Shorten your search query');
  }

  // Special characters validation
  const specialCharsRegex = /[<>{}[\]\\]/;
  if (specialCharsRegex.test(trimmedQuery)) {
    errors.push('Search query contains invalid characters');
    suggestions.push('Remove special characters like <, >, {, }, [, ], \\');
  }

  // SQL injection prevention
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
    /(\b(UNION|JOIN|WHERE|AND|OR)\b.*\b(SELECT|FROM)\b)/i,
    /(--|\/\*|\*\/)/
  ];

  if (sqlPatterns.some(pattern => pattern.test(trimmedQuery))) {
    errors.push('Search query appears to contain SQL commands');
    suggestions.push('Use only cryptocurrency names and symbols in your search');
  }

  // XSS prevention
  const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  if (scriptPattern.test(trimmedQuery)) {
    errors.push('Search query contains potentially harmful content');
    suggestions.push('Use only cryptocurrency names and symbols in your search');
  }

  // Provide helpful suggestions for common patterns
  if (errors.length === 0) {
    if (/^\d+$/.test(trimmedQuery)) {
      suggestions.push('Searching by number - try adding a symbol like "BTC" or name like "Bitcoin"');
    }
    
    if (trimmedQuery.includes('$')) {
      suggestions.push('Remove currency symbols from your search');
    }
    
    if (trimmedQuery.length === 1) {
      suggestions.push('Try entering more characters for better matching');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
};

/**
 * Parse advanced search operators
 */
export const parseAdvancedSearch = (query: string): {
  cleanQuery: string;
  filters: SearchFilters;
  operators: string[];
} => {
  const filters: SearchFilters = {};
  const operators: string[] = [];
  let cleanQuery = query;

  // Price operators: price:>100, price:<500, price:100-500
  const pricePatterns = [
    { regex: /price:>(\d+(?:\.\d+)?)/gi, type: 'min' },
    { regex: /price:<(\d+(?:\.\d+)?)/gi, type: 'max' },
    { regex: /price:(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/gi, type: 'range' }
  ];

  pricePatterns.forEach(pattern => {
    const matches = Array.from(query.matchAll(pattern.regex));
    matches.forEach(match => {
      if (pattern.type === 'range') {
        const min = parseFloat(match[1]);
        const max = parseFloat(match[2]);
        filters.priceRange = { min: Math.min(min, max), max: Math.max(min, max) };
        operators.push(`price:${min}-${max}`);
      } else {
        if (!filters.priceRange) filters.priceRange = { min: null, max: null };
        const value = parseFloat(match[1]);
        if (pattern.type === 'min') {
          filters.priceRange.min = value;
          operators.push(`price:>${value}`);
        } else {
          filters.priceRange.max = value;
          operators.push(`price:<${value}`);
        }
      }
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    });
  });

  // Market cap operators
  const marketCapPatterns = [
    { regex: /marketcap:>(\d+(?:\.\d+)?[kmbtKMBT]?)/gi, type: 'min' },
    { regex: /marketcap:<(\d+(?:\.\d+)?[kmbtKMBT]?)/gi, type: 'max' }
  ];

  marketCapPatterns.forEach(pattern => {
    const matches = Array.from(query.matchAll(pattern.regex));
    matches.forEach(match => {
      if (!filters.marketCapRange) filters.marketCapRange = { min: null, max: null };
      const value = parseMarketCapValue(match[1]);
      if (pattern.type === 'min') {
        filters.marketCapRange.min = value;
        operators.push(`marketcap:>${match[1]}`);
      } else {
        filters.marketCapRange.max = value;
        operators.push(`marketcap:<${match[1]}`);
      }
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    });
  });

  // Change operators
  const changePatterns = [
    { regex: /change:>(-?\d+(?:\.\d+)?)/gi, type: 'min' },
    { regex: /change:<(-?\d+(?:\.\d+)?)/gi, type: 'max' }
  ];

  changePatterns.forEach(pattern => {
    const matches = Array.from(query.matchAll(pattern.regex));
    matches.forEach(match => {
      if (!filters.changeRange) filters.changeRange = { min: null, max: null };
      const value = parseFloat(match[1]);
      if (pattern.type === 'min') {
        filters.changeRange.min = value;
        operators.push(`change:>${value}%`);
      } else {
        filters.changeRange.max = value;
        operators.push(`change:<${value}%`);
      }
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    });
  });

  // Category operators: category:defi, cat:gaming
  const categoryPattern = /(?:category|cat):(\w+)/gi;
  const categoryMatches = Array.from(query.matchAll(categoryPattern));
  if (categoryMatches.length > 0) {
    filters.categories = categoryMatches.map(match => match[1].toLowerCase());
    operators.push(...categoryMatches.map(match => `category:${match[1]}`));
    categoryMatches.forEach(match => {
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    });
  }

  // Exchange operators: exchange:binance, ex:coinbase
  const exchangePattern = /(?:exchange|ex):(\w+)/gi;
  const exchangeMatches = Array.from(query.matchAll(exchangePattern));
  if (exchangeMatches.length > 0) {
    filters.exchanges = exchangeMatches.map(match => match[1].toLowerCase());
    operators.push(...exchangeMatches.map(match => `exchange:${match[1]}`));
    exchangeMatches.forEach(match => {
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    });
  }

  // Portfolio operators: holdings:true, watchlist:true
  if (/holdings:true/i.test(query)) {
    filters.hasHoldings = true;
    operators.push('holdings:true');
    cleanQuery = cleanQuery.replace(/holdings:true/gi, '').trim();
  }

  if (/watchlist:true/i.test(query)) {
    filters.inWatchlist = true;
    operators.push('watchlist:true');
    cleanQuery = cleanQuery.replace(/watchlist:true/gi, '').trim();
  }

  // Clean up extra whitespace
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

  return {
    cleanQuery,
    filters,
    operators
  };
};

/**
 * Parse market cap value with suffixes (K, M, B, T)
 */
const parseMarketCapValue = (value: string): number => {
  const multipliers: { [key: string]: number } = {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000,
    't': 1000000000000
  };

  const match = value.match(/^(\d+(?:\.\d+)?)([kmbtKMBT])?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const suffix = match[2]?.toLowerCase();
    const multiplier = suffix ? multipliers[suffix] || 1 : 1;
    return num * multiplier;
  }

  return parseFloat(value) || 0;
};

/**
 * Generate search suggestions based on query
 */
export const generateSearchSuggestions = (
  query: string,
  assets: SearchResult[],
  maxSuggestions: number = 10
): string[] => {
  const queryLower = query.toLowerCase();
  const suggestions: string[] = [];

  // Direct matches
  assets.forEach(asset => {
    if (suggestions.length >= maxSuggestions) return;
    
    if (asset.symbol.toLowerCase().startsWith(queryLower)) {
      suggestions.push(asset.symbol);
    } else if (asset.name.toLowerCase().startsWith(queryLower)) {
      suggestions.push(asset.name);
    }
  });

  // Partial matches
  if (suggestions.length < maxSuggestions) {
    assets.forEach(asset => {
      if (suggestions.length >= maxSuggestions) return;
      
      if (asset.symbol.toLowerCase().includes(queryLower) && 
          !suggestions.includes(asset.symbol)) {
        suggestions.push(asset.symbol);
      } else if (asset.name.toLowerCase().includes(queryLower) && 
                 !suggestions.includes(asset.name)) {
        suggestions.push(asset.name);
      }
    });
  }

  return suggestions.slice(0, maxSuggestions);
};

/**
 * Calculate search relevance score
 */
export const calculateRelevanceScore = (
  query: string,
  asset: SearchResult
): number => {
  const queryLower = query.toLowerCase();
  const symbolLower = asset.symbol.toLowerCase();
  const nameLower = asset.name.toLowerCase();

  let score = 0;

  // Exact matches
  if (symbolLower === queryLower || nameLower === queryLower) {
    score += 1000;
  }
  
  // Starts with
  else if (symbolLower.startsWith(queryLower)) {
    score += 800;
  } else if (nameLower.startsWith(queryLower)) {
    score += 700;
  }
  
  // Contains
  else if (symbolLower.includes(queryLower)) {
    score += 600;
  } else if (nameLower.includes(queryLower)) {
    score += 500;
  }

  // Popularity bonus
  if (asset.marketCapRank) {
    if (asset.marketCapRank <= 10) score += 100;
    else if (asset.marketCapRank <= 50) score += 50;
    else if (asset.marketCapRank <= 100) score += 25;
  }

  // Volume bonus
  if (asset.volume24h > 100000000) score += 20; // > $100M
  else if (asset.volume24h > 10000000) score += 10; // > $10M

  return score;
};

/**
 * Highlight search terms in text
 */
export const highlightSearchTerms = (
  text: string,
  query: string,
  className: string = 'search-highlight'
): string => {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, `<span class="${className}">$1</span>`);
};

/**
 * Get search query suggestions based on context
 */
export const getContextualSuggestions = (query: string): string[] => {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();

  // Common search patterns
  const patterns = [
    { pattern: /defi|yield|farm/i, suggestions: ['DeFi tokens', 'Yield farming', 'Liquidity mining'] },
    { pattern: /nft|gaming|play/i, suggestions: ['Gaming tokens', 'NFT projects', 'Play-to-earn'] },
    { pattern: /layer|l2|scaling/i, suggestions: ['Layer 2', 'Scaling solutions', 'Ethereum Layer 2'] },
    { pattern: /stable|usd|peg/i, suggestions: ['Stablecoins', 'USD pegged', 'Algorithmic stable'] },
    { pattern: /meme|dog|moon/i, suggestions: ['Meme coins', 'Community tokens', 'Viral projects'] },
    { pattern: /privacy|anon|private/i, suggestions: ['Privacy coins', 'Anonymous transactions', 'Zero knowledge'] }
  ];

  patterns.forEach(({ pattern, suggestions: patternSuggestions }) => {
    if (pattern.test(queryLower)) {
      suggestions.push(...patternSuggestions);
    }
  });

  // Add general suggestions if no patterns match
  if (suggestions.length === 0) {
    suggestions.push(
      'Try "DeFi" for decentralized finance',
      'Search "Layer 1" for blockchain platforms',
      'Look for "Gaming" tokens',
      'Find "Stablecoins"',
      'Explore "NFT" projects'
    );
  }

  return suggestions.slice(0, 3);
};