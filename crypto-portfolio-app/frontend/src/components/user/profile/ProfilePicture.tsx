import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Loader2, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProfile } from '../../../hooks/useProfile';

interface ProfilePictureProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-32 w-32',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

export const ProfilePicture: React.FC<ProfilePictureProps> = ({ 
  className = '', 
  size = 'lg',
  editable = true 
}) => {
  const { profile, uploadAvatar, deleteAvatar, isUploadingAvatar, isDeletingAvatar } = useProfile();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = isUploadingAvatar || isDeletingAvatar;
  const hasAvatar = (profile as any)?.avatarUrl || preview;

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload avatar
    uploadAvatar({ file });
  }, [uploadAvatar]);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleRemoveAvatar = () => {
    if (window.confirm('Are you sure you want to remove your profile picture?')) {
      setPreview(null);
      deleteAvatar();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const avatarSrc = preview || (profile as any)?.avatarUrl;
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : '';
  const initials = displayName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`relative ${className}`}>
      {/* Avatar Display */}
      <div
        className={`
          ${sizeClasses[size]} relative rounded-full overflow-hidden
          ${editable ? 'cursor-pointer group' : ''}
          ${dragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          ${hasAvatar ? '' : 'bg-gray-100 dark:bg-gray-700'}
        `}
        onDrop={editable ? handleDrop : undefined}
        onDragOver={editable ? handleDragOver : undefined}
        onDragLeave={editable ? handleDragLeave : undefined}
        onClick={editable ? handleUploadClick : undefined}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            {initials ? (
              <span className={`font-semibold text-gray-600 dark:text-gray-300 ${
                size === 'sm' ? 'text-xs' : 
                size === 'md' ? 'text-sm' : 
                size === 'lg' ? 'text-lg' : 'text-2xl'
              }`}>
                {initials}
              </span>
            ) : (
              <User className={`${iconSizeClasses[size]} text-gray-400`} />
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className={`${iconSizeClasses[size]} animate-spin text-white`} />
          </div>
        )}

        {/* Hover Overlay */}
        {editable && !isLoading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className={`${iconSizeClasses[size]} text-white`} />
          </div>
        )}

        {/* Drag Overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
            <Upload className={`${iconSizeClasses[size]} text-blue-500`} />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {editable && size !== 'sm' && (
        <div className="absolute -bottom-2 -right-2 flex gap-1">
          <button
            onClick={handleUploadClick}
            disabled={isLoading}
            className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full shadow-sm transition-colors"
            title="Upload new avatar"
          >
            <Camera className="h-3 w-3" />
          </button>

          {hasAvatar && (
            <button
              onClick={handleRemoveAvatar}
              disabled={isLoading}
              className="p-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-full shadow-sm transition-colors"
              title="Remove avatar"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
};