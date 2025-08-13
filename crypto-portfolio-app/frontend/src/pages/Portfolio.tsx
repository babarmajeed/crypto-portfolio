export function Portfolio() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your cryptocurrency holdings</p>
        </div>
        <button className="btn-primary">
          Add Asset
        </button>
      </div>

      <div className="card">
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No assets in your portfolio yet</p>
            <button className="btn-primary mt-4">
              Add Your First Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}