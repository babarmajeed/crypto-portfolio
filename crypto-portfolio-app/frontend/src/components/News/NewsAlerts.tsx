import React, { useState, useEffect } from 'react';
import { useNewsAlerts } from '../../hooks/useNewsAlerts';
import { usePortfolio } from '../../hooks/usePortfolio';
import { NewsAlert, NewsCategory } from '../../types/news.types';
import { 
  FiBell, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiPlay, 
  FiPause,
  FiSettings,
  FiMail,
  FiSmartphone,
  FiMonitor,
  FiCheck,
  FiX,
  FiEye,
  FiDownload,
  FiUpload
} from 'react-icons/fi';

interface NewsAlertsProps {
  className?: string;
}

export const NewsAlerts: React.FC<NewsAlertsProps> = ({ className = '' }) => {
  const {
    alerts,
    activeAlerts,
    alertHistory,
    isLoading,
    error,
    createAlert,
    updateAlert,
    removeAlert,
    toggleAlert,
    testAlert,
    exportAlerts,
    importAlerts
  } = useNewsAlerts();

  const { portfolioAssets } = usePortfolio();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<NewsAlert | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');

  const [formData, setFormData] = useState<Partial<NewsAlert>>({
    name: '',
    keywords: [],
    assets: [],
    category: undefined,
    sentiment: undefined,
    minRelevanceScore: undefined,
    isActive: true,
    notificationMethod: ['push']
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  useEffect(() => {
    if (editingAlert) {
      setFormData({
        name: editingAlert.name,
        keywords: editingAlert.keywords,
        assets: editingAlert.assets,
        category: editingAlert.category,
        sentiment: editingAlert.sentiment,
        minRelevanceScore: editingAlert.minRelevanceScore,
        isActive: editingAlert.isActive,
        notificationMethod: editingAlert.notificationMethod
      });
      setSelectedAssets(editingAlert.assets);
    }
  }, [editingAlert]);

  const categories: NewsCategory[] = [
    'market', 'technology', 'regulation', 'adoption', 'security',
    'defi', 'nft', 'mining', 'exchange', 'analysis', 'general'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.keywords.length === 0) {
      return;
    }

    try {
      const alertData = {
        ...formData,
        assets: selectedAssets,
        keywords: formData.keywords || [],
        notificationMethod: formData.notificationMethod || ['push']
      } as Omit<NewsAlert, 'id' | 'createdAt' | 'triggerCount'>;

      if (editingAlert) {
        await updateAlert(editingAlert.id, alertData);
      } else {
        await createAlert(alertData);
      }

      resetForm();
    } catch (err) {
      console.error('Error saving alert:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      keywords: [],
      assets: [],
      category: undefined,
      sentiment: undefined,
      minRelevanceScore: undefined,
      isActive: true,
      notificationMethod: ['push']
    });
    setSelectedAssets([]);
    setNewKeyword('');
    setShowCreateForm(false);
    setEditingAlert(null);
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords?.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords?.filter(k => k !== keyword) || []
    }));
  };

  const toggleAsset = (asset: string) => {
    setSelectedAssets(prev => 
      prev.includes(asset) 
        ? prev.filter(a => a !== asset)
        : [...prev, asset]
    );
  };

  const handleNotificationMethodChange = (method: 'push' | 'email' | 'sms') => {
    setFormData(prev => {
      const currentMethods = prev.notificationMethod || [];
      const newMethods = currentMethods.includes(method)
        ? currentMethods.filter(m => m !== method)
        : [...currentMethods, method];
      
      return { ...prev, notificationMethod: newMethods };
    });
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importAlerts(file);
      event.target.value = '';
    }
  };

  const formatLastTriggered = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than 1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <FiBell className="h-6 w-6 mr-2 text-blue-600" />
            News Alerts
          </h2>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="h-4 w-4" />
              <span>Create Alert</span>
            </button>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={exportAlerts}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                title="Export alerts"
              >
                <FiDownload className="h-4 w-4" />
              </button>
              
              <label className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all cursor-pointer" title="Import alerts">
                <FiUpload className="h-4 w-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FiBell className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Total Alerts
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
              {alerts.length}
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FiPlay className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-900 dark:text-green-300">
                Active Alerts
              </span>
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-300">
              {activeAlerts.length}
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FiEye className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900 dark:text-purple-300">
                Recent Triggers
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
              {alertHistory.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mt-4">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            My Alerts ({alerts.length})
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Alert History ({alertHistory.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Create/Edit Form */}
        {(showCreateForm || editingAlert) && (
          <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingAlert ? 'Edit Alert' : 'Create New Alert'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Alert Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Bitcoin Bull Run Alert"
                  required
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Keywords
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Add keyword..."
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {formData.keywords && formData.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          <FiX className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Portfolio Assets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Portfolio Assets
                </label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {portfolioAssets.map((asset) => (
                    <label
                      key={asset.symbol}
                      className="flex items-center space-x-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(asset.symbol)}
                        onChange={() => toggleAsset(asset.symbol)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {asset.symbol}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as NewsCategory || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Any Category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sentiment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sentiment
                  </label>
                  <select
                    value={formData.sentiment || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sentiment: e.target.value as any || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Any Sentiment</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>

                {/* Relevance Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Min. Relevance: {(formData.minRelevanceScore || 0) * 100}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={(formData.minRelevanceScore || 0) * 100}
                    onChange={(e) => setFormData(prev => ({ ...prev, minRelevanceScore: parseInt(e.target.value) / 100 }))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Notification Methods */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification Methods
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'push' as const, label: 'Browser Push', icon: FiMonitor },
                    { key: 'email' as const, label: 'Email', icon: FiMail },
                    { key: 'sms' as const, label: 'SMS', icon: FiSmartphone }
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.notificationMethod?.includes(key) || false}
                        onChange={() => handleNotificationMethodChange(key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {editingAlert ? 'Update Alert' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Alerts List */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <FiBell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No alerts created yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first news alert to get notified about important updates
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Alert
                </button>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                          {alert.name}
                        </h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          alert.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                        }`}>
                          {alert.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Keywords: </span>
                          {alert.keywords.join(', ')}
                        </div>
                        
                        {alert.assets.length > 0 && (
                          <div>
                            <span className="font-medium">Assets: </span>
                            {alert.assets.join(', ')}
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4">
                          <span>
                            <span className="font-medium">Triggered: </span>
                            {alert.triggerCount} times
                          </span>
                          <span>
                            <span className="font-medium">Last: </span>
                            {formatLastTriggered(alert.lastTriggered)}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {alert.notificationMethod.map((method) => (
                            <span
                              key={method}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                            >
                              {method === 'push' && <FiMonitor className="h-3 w-3 mr-1" />}
                              {method === 'email' && <FiMail className="h-3 w-3 mr-1" />}
                              {method === 'sms' && <FiSmartphone className="h-3 w-3 mr-1" />}
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => testAlert(alert.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Test alert"
                      >
                        <FiPlay className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                        title={alert.isActive ? 'Pause alert' : 'Resume alert'}
                      >
                        {alert.isActive ? <FiPause className="h-4 w-4" /> : <FiPlay className="h-4 w-4" />}
                      </button>
                      
                      <button
                        onClick={() => setEditingAlert(alert)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Edit alert"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => removeAlert(alert.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Delete alert"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Alert History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {alertHistory.length === 0 ? (
              <div className="text-center py-12">
                <FiEye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No alert history
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Alert triggers will appear here when your alerts are activated
                </p>
              </div>
            ) : (
              alertHistory.map((article) => (
                <div
                  key={`${article.id}-${article.triggeredAt}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.open(article.url, '_blank')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">
                        {article.title}
                      </h4>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {article.summary}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {article.alertName}
                        </span>
                        <span>{article.source}</span>
                        <span>{new Date(article.triggeredAt!).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {article.sentiment && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          article.sentiment.label === 'positive'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : article.sentiment.label === 'negative'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                        }`}>
                          {article.sentiment.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsAlerts;