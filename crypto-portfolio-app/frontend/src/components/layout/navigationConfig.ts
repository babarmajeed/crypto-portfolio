import { 
  BarChart3, 
  Briefcase, 
  History, 
  Settings,
  TrendingUp,
  Wallet,
  Search,
  Bell,
  User,
  Shield,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  FileText,
  Download,
  Upload,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Globe,
  Lock
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavigationItem[];
  badge?: string | number;
  description?: string;
}

export const navigation: NavigationItem[] = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: BarChart3,
    description: 'Overview of your portfolio'
  },
  { 
    name: 'Portfolio', 
    href: '/portfolio', 
    icon: Briefcase,
    description: 'Manage your crypto assets',
    children: [
      { name: 'Overview', href: '/portfolio', icon: BarChart3 },
      { name: 'Holdings', href: '/portfolio/holdings', icon: Wallet },
      { name: 'Performance', href: '/portfolio/performance', icon: TrendingUp },
      { name: 'Allocation', href: '/portfolio/allocation', icon: BarChart3 }
    ]
  },
  { 
    name: 'Transactions', 
    href: '/transactions', 
    icon: History,
    description: 'View transaction history',
    children: [
      { name: 'All Transactions', href: '/transactions', icon: History },
      { name: 'Deposits', href: '/transactions/deposits', icon: Download },
      { name: 'Withdrawals', href: '/transactions/withdrawals', icon: Upload },
      { name: 'Trades', href: '/transactions/trades', icon: TrendingUp }
    ]
  },
  { 
    name: 'Market', 
    href: '/market', 
    icon: TrendingUp,
    description: 'Explore crypto markets',
    children: [
      { name: 'Market Overview', href: '/market', icon: TrendingUp },
      { name: 'Search Assets', href: '/market/search', icon: Search },
      { name: 'Watchlist', href: '/market/watchlist', icon: Bell },
      { name: 'Price Alerts', href: '/market/alerts', icon: AlertTriangle }
    ]
  },
  { 
    name: 'Wallet', 
    href: '/wallet', 
    icon: Wallet,
    description: 'Manage your wallets',
    children: [
      { name: 'Wallets', href: '/wallet', icon: Wallet },
      { name: 'Connect Wallet', href: '/wallet/connect', icon: CreditCard },
      { name: 'Security', href: '/wallet/security', icon: Shield }
    ]
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings,
    description: 'App preferences and account',
    children: [
      { 
        name: 'Account', 
        href: '/settings/account', 
        icon: User,
        children: [
          { name: 'Profile', href: '/settings/account/profile', icon: User },
          { name: 'Security', href: '/settings/account/security', icon: Shield },
          { name: 'Privacy', href: '/settings/account/privacy', icon: Lock }
        ]
      },
      { 
        name: 'Preferences', 
        href: '/settings/preferences', 
        icon: Settings,
        children: [
          { name: 'Display', href: '/settings/preferences/display', icon: Monitor },
          { name: 'Theme', href: '/settings/preferences/theme', icon: Moon },
          { name: 'Language', href: '/settings/preferences/language', icon: Globe },
          { name: 'Mobile', href: '/settings/preferences/mobile', icon: Smartphone }
        ]
      },
      { 
        name: 'Notifications', 
        href: '/settings/notifications', 
        icon: Bell,
        children: [
          { name: 'Push Notifications', href: '/settings/notifications/push', icon: Bell },
          { name: 'Email Alerts', href: '/settings/notifications/email', icon: Bell },
          { name: 'Price Alerts', href: '/settings/notifications/price', icon: AlertTriangle }
        ]
      },
      { name: 'Data & Privacy', href: '/settings/data', icon: FileText },
      { name: 'Help & Support', href: '/settings/help', icon: HelpCircle }
    ]
  }
];

// Mobile-optimized navigation with touch-friendly sizes
export const mobileNavigation: NavigationItem[] = navigation.map(item => ({
  ...item,
  children: item.children?.map(child => ({
    ...child,
    children: child.children?.slice(0, 4) // Limit nested items on mobile
  }))
}));

// Quick actions for mobile
export const quickActions: NavigationItem[] = [
  { name: 'Search', href: '/search', icon: Search, description: 'Find assets quickly' },
  { name: 'Notifications', href: '/notifications', icon: Bell, badge: '3', description: 'Recent alerts' },
  { name: 'Profile', href: '/profile', icon: User, description: 'Account settings' },
  { name: 'Help', href: '/help', icon: HelpCircle, description: 'Get support' }
];