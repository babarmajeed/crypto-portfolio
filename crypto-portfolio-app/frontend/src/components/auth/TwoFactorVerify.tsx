import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';

const twoFactorSchema = z.object({
  token: z.string().min(6, 'Please enter the 6-digit code').max(6, 'Code must be 6 digits'),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

interface TwoFactorVerifyProps {
  tempToken: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const TwoFactorVerify: React.FC<TwoFactorVerifyProps> = ({
  tempToken,
  onSuccess,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
  });

  const token = watch('token', '');

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error('Two-factor code expired. Please try again.');
          onBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onBack]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle digit input
  const handleDigitChange = (index: number, value: string) => {
    const digits = token.padEnd(6, ' ').split('');
    
    if (value.length === 1 && /^\d$/.test(value)) {
      digits[index] = value;
      setValue('token', digits.join('').trim());
      
      // Move to next input
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (value === '') {
      digits[index] = ' ';
      setValue('token', digits.join('').trim());
      
      // Move to previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\s/g, '');
    
    if (/^\d{6}$/.test(pastedData)) {
      setValue('token', pastedData);
      inputRefs.current[5]?.focus();
    }
  };

  const onSubmit = async (data: TwoFactorFormData) => {
    try {
      setIsLoading(true);
      await authService.verifyTwoFactor({
        tempToken,
        token: data.token,
      });
      
      toast.success('Two-factor authentication successful!');
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid two-factor code. Please try again.';
      toast.error(message);
      
      // Clear the form
      setValue('token', '');
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const digits = token.padEnd(6, ' ').split('');

  return (
    <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg p-8">
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
          <svg
            className="h-6 w-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
        <p className="text-gray-600 mt-2">
          Enter the 6-digit code from your authenticator app
        </p>
        <div className="mt-4 text-sm text-gray-500">
          Code expires in: <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Authentication Code
          </label>
          <div className="flex space-x-2 justify-center" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit === ' ' ? '' : digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
                    inputRefs.current[index - 1]?.focus();
                  }
                }}
                className="w-12 h-12 text-center text-2xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="off"
              />
            ))}
          </div>
          {errors.token && (
            <p className="mt-2 text-sm text-red-600 text-center">{errors.token.message}</p>
          )}
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading || token.length !== 6}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            Verify
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Having trouble? Contact support for assistance
        </p>
      </div>
    </div>
  );
};

export default TwoFactorVerify;