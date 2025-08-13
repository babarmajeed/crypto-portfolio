export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome to your crypto portfolio overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Portfolio Value</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
          <span className="text-sm text-gray-500 dark:text-gray-400">0.00% (24h)</span>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assets</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">24h Change</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Performer</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">-</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Portfolio Allocation</h3>
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            Chart will be displayed here
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No transactions yet
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}