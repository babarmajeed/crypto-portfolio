import React from 'react';
import { ChevronLeft, ChevronRight, Check, ArrowRight } from 'lucide-react';
import { useOnboarding, OnboardingStep } from '../../../hooks/useOnboarding';

interface OnboardingWizardProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  className?: string;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  steps,
  onComplete,
  className = '',
}) => {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    progressPercentage,
    canGoNext,
    canGoPrevious,
    canSkip,
    nextStep,
    previousStep,
    skipStep,
    completeOnboarding,
    getStepData,
    setStepData,
    isStepCompleted,
    isStepSkipped,
    isStepAccessible,
    isSaving,
    isCompleting,
  } = useOnboarding(steps);

  const handleNext = async () => {
    const success = await nextStep();
    if (success && currentStepIndex === totalSteps - 1) {
      // Completed all steps
      const completed = await completeOnboarding();
      if (completed) {
        onComplete?.();
      }
    }
  };

  const handlePrevious = async () => {
    await previousStep();
  };

  const handleSkip = async () => {
    const success = await skipStep();
    if (success && currentStepIndex === totalSteps - 1) {
      // Skipped the last step
      const completed = await completeOnboarding();
      if (completed) {
        onComplete?.();
      }
    }
  };

  const handleComplete = async () => {
    const success = await completeOnboarding();
    if (success) {
      onComplete?.();
    }
  };

  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Crypto Portfolio
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Let's get your account set up in a few simple steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {progressPercentage}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Steps Navigation */}
        <div className="flex items-center justify-center mb-8 overflow-x-auto">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => {
              const isCompleted = isStepCompleted(step.id);
              const isSkipped = isStepSkipped(step.id);
              const isCurrent = index === currentStepIndex;
              const isAccessible = isStepAccessible(index);

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`
                      flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all
                      ${isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-600 border-green-600 text-white'
                        : isSkipped
                        ? 'bg-yellow-600 border-yellow-600 text-white'
                        : isAccessible
                        ? 'border-blue-300 text-blue-600 hover:border-blue-600'
                        : 'border-gray-300 text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : isSkipped ? (
                      <ArrowRight className="w-4 h-4" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className={`ml-2 ${isCurrent ? 'block' : 'hidden sm:block'}`}>
                    <p className={`text-sm font-medium ${
                      isCurrent ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {step.title}
                    </p>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 ml-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-[400px]">
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                {currentStep.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {currentStep.description}
              </p>
              {currentStep.optional && (
                <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded">
                  Optional
                </span>
              )}
            </div>

            {/* Render Step Component */}
            <div className="mb-8">
              <currentStep.component
                data={getStepData(currentStep.id)}
                onDataChange={(data: any) => setStepData(currentStep.id, data)}
                onNext={handleNext}
                onSkip={canSkip ? handleSkip : undefined}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-8 pt-0">
            <button
              onClick={handlePrevious}
              disabled={!canGoPrevious || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              {canSkip && (
                <button
                  onClick={handleSkip}
                  disabled={isSaving}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Skip
                </button>
              )}

              {isLastStep ? (
                <button
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {isCompleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isCompleting ? 'Finishing...' : 'Complete Setup'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext || isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help? Contact us at{' '}
            <a href="mailto:support@cryptoportfolio.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              support@cryptoportfolio.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};