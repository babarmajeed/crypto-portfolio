import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { userService } from '../services/user.service';
import { UserProfile, UpdateProfileRequest, AvatarUploadRequest } from '../types/user';
import { useAuth } from '../contexts/AuthContext';

export const useProfile = () => {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();

  // Get profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userService.getProfile,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => userService.updateProfile(data),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['user-profile'], updatedProfile);
      updateUser(updatedProfile as any); // Update auth context
      toast.success('Profile updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });

  // Upload avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: (data: AvatarUploadRequest) => userService.uploadAvatar(data),
    onSuccess: (response) => {
      // Update profile with new avatar URL
      const currentProfile = queryClient.getQueryData<UserProfile>(['user-profile']);
      if (currentProfile) {
        const updatedProfile = { ...currentProfile, avatarUrl: response.avatarUrl };
        queryClient.setQueryData(['user-profile'], updatedProfile);
        updateUser(updatedProfile as any);
      }
      toast.success('Avatar updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
    },
  });

  // Delete avatar
  const deleteAvatarMutation = useMutation({
    mutationFn: userService.deleteAvatar,
    onSuccess: () => {
      const currentProfile = queryClient.getQueryData<UserProfile>(['user-profile']);
      if (currentProfile) {
        const updatedProfile = { ...currentProfile, avatarUrl: undefined };
        queryClient.setQueryData(['user-profile'], updatedProfile);
        updateUser(updatedProfile as any);
      }
      toast.success('Avatar removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove avatar');
    },
  });

  return {
    // Data
    profile: profile || user,
    
    // Loading states
    isLoadingProfile,
    isUpdating: updateProfileMutation.isPending,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    isDeletingAvatar: deleteAvatarMutation.isPending,
    
    // Error states
    profileError,
    updateError: updateProfileMutation.error,
    uploadError: uploadAvatarMutation.error,
    deleteError: deleteAvatarMutation.error,
    
    // Actions
    updateProfile: updateProfileMutation.mutate,
    uploadAvatar: uploadAvatarMutation.mutate,
    deleteAvatar: deleteAvatarMutation.mutate,
    
    // Reset functions
    resetUpdateError: updateProfileMutation.reset,
    resetUploadError: uploadAvatarMutation.reset,
    resetDeleteError: deleteAvatarMutation.reset,
  };
};