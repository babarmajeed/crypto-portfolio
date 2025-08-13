import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { userService } from '../services/user.service';
import { OnboardingProgress } from '../types/user';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  optional?: boolean;
  validation?: (data: any) => Promise<boolean> | boolean;
}

export const useOnboarding = (steps: OnboardingStep[]) => {
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<Record<string, any>>({});

  // Get onboarding progress
  const {
    data: progress,
    isLoading: isLoadingProgress,
    error: progressError,
  } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: userService.getOnboardingProgress,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Update onboarding progress
  const updateProgressMutation = useMutation({
    mutationFn: (data: Partial<OnboardingProgress>) => 
      userService.updateOnboardingProgress(data),
    onSuccess: (updatedProgress) => {
      queryClient.setQueryData(['onboarding-progress'], updatedProgress);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save progress');
    },
  });

  // Complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: userService.completeOnboarding,
    onSuccess: () => {
      queryClient.setQueryData(['onboarding-progress'], (old: OnboardingProgress) => ({
        ...old,
        isCompleted: true,
        currentStep: steps.length,
        completedSteps: steps.map(step => step.id),
      }));
      toast.success('Welcome! Your account setup is complete.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to complete onboarding');
    },
  });

  // Current step management
  const currentStepIndex = progress?.currentStep || 0;
  const currentStep = steps[currentStepIndex];
  const isCompleted = progress?.isCompleted || false;
  const completedSteps = progress?.completedSteps || [];
  const skippedSteps = progress?.skippedSteps || [];

  // Navigation helpers
  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrevious = currentStepIndex > 0;
  const canSkip = currentStep?.optional || false;

  // Step data management
  const getStepData = useCallback((stepId: string) => {
    return {
      ...progress?.data?.[stepId],
      ...localData[stepId],
    };
  }, [progress?.data, localData]);

  const setStepData = useCallback((stepId: string, data: any) => {
    setLocalData(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...data },
    }));
  }, []);

  const getAllData = useCallback(() => {
    return {
      ...progress?.data,
      ...localData,
    };
  }, [progress?.data, localData]);

  // Navigation actions
  const goToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return false;

    const updatedProgress = {
      currentStep: stepIndex,
      data: getAllData(),
    };

    try {
      await updateProgressMutation.mutateAsync(updatedProgress);
      return true;
    } catch (error) {
      return false;
    }
  }, [steps.length, getAllData, updateProgressMutation]);

  const nextStep = useCallback(async () => {
    if (!canGoNext) return false;

    // Validate current step if validation exists
    if (currentStep?.validation) {
      const stepData = getStepData(currentStep.id);
      const isValid = await currentStep.validation(stepData);
      if (!isValid) {
        toast.error('Please complete all required fields');
        return false;
      }
    }

    // Mark current step as completed
    const newCompletedSteps = [...completedSteps];
    if (!newCompletedSteps.includes(currentStep.id)) {
      newCompletedSteps.push(currentStep.id);
    }

    const updatedProgress = {
      currentStep: currentStepIndex + 1,
      completedSteps: newCompletedSteps,
      data: getAllData(),
    };

    try {
      await updateProgressMutation.mutateAsync(updatedProgress);
      return true;
    } catch (error) {
      return false;
    }
  }, [canGoNext, currentStep, currentStepIndex, completedSteps, getStepData, getAllData, updateProgressMutation]);

  const previousStep = useCallback(async () => {
    if (!canGoPrevious) return false;
    return goToStep(currentStepIndex - 1);
  }, [canGoPrevious, currentStepIndex, goToStep]);

  const skipStep = useCallback(async () => {
    if (!canSkip) return false;

    const newSkippedSteps = [...skippedSteps];
    if (!newSkippedSteps.includes(currentStep.id)) {
      newSkippedSteps.push(currentStep.id);
    }

    const updatedProgress = {
      currentStep: Math.min(currentStepIndex + 1, steps.length - 1),
      skippedSteps: newSkippedSteps,
      data: getAllData(),
    };

    try {
      await updateProgressMutation.mutateAsync(updatedProgress);
      return true;
    } catch (error) {
      return false;
    }
  }, [canSkip, currentStep, currentStepIndex, skippedSteps, steps.length, getAllData, updateProgressMutation]);

  const completeOnboarding = useCallback(async () => {
    // Validate all required steps are completed
    const requiredSteps = steps.filter(step => !step.optional);
    const uncompletedRequired = requiredSteps.filter(
      step => !completedSteps.includes(step.id) && !skippedSteps.includes(step.id)
    );

    if (uncompletedRequired.length > 0) {
      toast.error('Please complete all required steps before finishing');
      return false;
    }

    try {
      await completeOnboardingMutation.mutateAsync();
      return true;
    } catch (error) {
      return false;
    }
  }, [steps, completedSteps, skippedSteps, completeOnboardingMutation]);

  // Progress calculation
  const progressPercentage = Math.round(
    ((completedSteps.length + skippedSteps.length) / steps.length) * 100
  );

  const isStepCompleted = useCallback((stepId: string) => {
    return completedSteps.includes(stepId);
  }, [completedSteps]);

  const isStepSkipped = useCallback((stepId: string) => {
    return skippedSteps.includes(stepId);
  }, [skippedSteps]);

  const isStepAccessible = useCallback((stepIndex: number) => {
    // First step is always accessible
    if (stepIndex === 0) return true;
    
    // Current step is accessible
    if (stepIndex === currentStepIndex) return true;
    
    // Previous steps are accessible if they're completed or skipped
    const step = steps[stepIndex];
    return isStepCompleted(step.id) || isStepSkipped(step.id);
  }, [currentStepIndex, steps, isStepCompleted, isStepSkipped]);

  return {
    // Progress data
    progress,
    isCompleted,
    progressPercentage,
    
    // Current step info
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    
    // Step data
    getStepData,
    setStepData,
    getAllData,
    
    // Navigation state
    canGoNext,
    canGoPrevious,
    canSkip,
    
    // Navigation actions
    nextStep,
    previousStep,
    skipStep,
    goToStep,
    completeOnboarding,
    
    // Step state helpers
    isStepCompleted,
    isStepSkipped,
    isStepAccessible,
    
    // Loading states
    isLoadingProgress,
    isSaving: updateProgressMutation.isPending,
    isCompleting: completeOnboardingMutation.isPending,
    
    // Error states
    progressError,
    saveError: updateProgressMutation.error,
    completeError: completeOnboardingMutation.error,
    
    // Reset functions
    resetSaveError: updateProgressMutation.reset,
    resetCompleteError: completeOnboardingMutation.reset,
  };
};