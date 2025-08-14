import { Bell, Search, Settings, User } from 'lucide-react'
import { useState } from 'react'
import { HamburgerMenu, MobileNavigation, MobileSearchOverlay } from '../mobile'

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <>
      <header className={`h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between ${className}`}>
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu - only visible on mobile */}
          <div className="lg:hidden">
            <HamburgerMenu
              isOpen={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              ariaLabel="Toggle mobile navigation"
            />
          </div>
          
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Crypto Portfolio
          </h1>
        </div>

      {/* Search bar - hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-lg mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Mobile search button */}
        <button 
          onClick={() => setIsMobileSearchOpen(true)}
          className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Open search"
        >
          <Search className="w-5 h-5" />
        </button>
        
        <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        
        {/* Settings button - hidden on mobile if navigation is open */}
        <button className={`p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isMobileNavOpen ? 'lg:block hidden' : ''}`}>
          <Settings className="w-5 h-5" />
        </button>
        
        <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>

    {/* Mobile Navigation */}
    <MobileNavigation
      isOpen={isMobileNavOpen}
      onClose={() => setIsMobileNavOpen(false)}
    />

    {/* Mobile Search Overlay */}
    <MobileSearchOverlay
      isOpen={isMobileSearchOpen}
      onClose={() => setIsMobileSearchOpen(false)}
      onSearch={(query) => {
        console.log('Search query:', query);
        // Handle search logic here
      }}
      recentSearches={['Bitcoin', 'Ethereum']}
    />
  </>
  )
}