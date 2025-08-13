import React, { useState } from 'react';
import { Smartphone, Monitor, Tablet, Clock, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { userService } from '../../../services/user.service';
import { TrustedDevice } from '../../../types/user';
import { format, formatDistanceToNow } from 'date-fns';

const getDeviceIcon = (deviceType?: string) => {
  switch (deviceType) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    case 'desktop':
    default:
      return Monitor;
  }
};

const getDeviceTypeColor = (deviceType?: string) => {
  switch (deviceType) {
    case 'mobile':
      return 'text-green-600 dark:text-green-400';
    case 'tablet':
      return 'text-blue-600 dark:text-blue-400';
    case 'desktop':
    default:
      return 'text-purple-600 dark:text-purple-400';
  }
};

export const TrustedDevices: React.FC = () => {
  const queryClient = useQueryClient();
  const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);

  // Fetch trusted devices
  const { 
    data: trustedDevices = [], 
    isLoading 
  } = useQuery({
    queryKey: ['trusted-devices'],
    queryFn: userService.getTrustedDevices,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Untrust device mutation
  const untrustDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => userService.untrustDevice(deviceId),
    onSuccess: (_, deviceId) => {
      // Remove device from cache
      queryClient.setQueryData(['trusted-devices'], (old: TrustedDevice[] = []) => 
        old.filter(device => device.id !== deviceId)
      );
      toast.success('Device removed successfully');
      setDeviceToRemove(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove device');
    },
  });

  const handleRemoveDevice = (deviceId: string) => {
    setDeviceToRemove(deviceId);
  };

  const confirmRemoveDevice = () => {
    if (deviceToRemove) {
      untrustDeviceMutation.mutate(deviceToRemove);
    }
  };

  const cancelRemoveDevice = () => {
    setDeviceToRemove(null);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            Trusted Devices
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Devices you've marked as trusted won't require additional verification
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {trustedDevices.length} device{trustedDevices.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Information Alert */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              About Trusted Devices
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Trusted devices skip additional security checks when logging in. Remove devices you no longer use or trust.
            </p>
          </div>
        </div>
      </div>

      {/* Devices List */}
      {trustedDevices.length === 0 ? (
        <div className="text-center py-12">
          <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No Trusted Devices
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            You haven't marked any devices as trusted yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trustedDevices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.deviceType);
            const deviceColor = getDeviceTypeColor(device.deviceType);
            const isRemoving = deviceToRemove === device.id;
            
            return (
              <div
                key={device.id}
                className={`
                  bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all
                  ${isRemoving ? 'ring-2 ring-red-500 border-red-500' : ''}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <DeviceIcon className={`h-8 w-8 ${deviceColor}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {device.deviceName || 'Unknown Device'}
                        </h4>
                        <span className={`
                          px-2 py-1 text-xs font-medium rounded-full
                          ${device.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }
                        `}>
                          {device.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {device.browser && (
                          <p className="flex items-center gap-2">
                            <Monitor className="h-3 w-3" />
                            {device.browser}
                            {device.os && ` on ${device.os}`}
                          </p>
                        )}
                        
                        <p className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Last seen {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                        </p>
                        
                        <p className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          Trusted since {format(new Date(device.trustedAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!isRemoving ? (
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelRemoveDevice}
                          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmRemoveDevice}
                          disabled={untrustDeviceMutation.isPending}
                          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                        >
                          {untrustDeviceMutation.isPending ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isRemoving && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Remove this trusted device?
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          This device will need to complete additional verification steps on next login.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security Notice */}
      {trustedDevices.length > 5 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                Many Trusted Devices
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You have many trusted devices. Consider removing devices you no longer use to improve security.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};