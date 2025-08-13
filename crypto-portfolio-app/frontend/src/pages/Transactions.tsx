export function Transactions() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400">View and manage your transaction history</p>
        </div>
        <button className="btn-primary">
          Add Transaction
        </button>
      </div>

      <div className="card">
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No transactions recorded yet</p>
            <button className="btn-primary mt-4">
              Record Your First Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}