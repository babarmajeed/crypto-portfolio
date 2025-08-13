import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { userService } from '../services/userService';
import { 
  userPreferencesUpdateSchema,
  dashboardLayoutSchema,
  notificationSettingsSchema,
  privacySettingsSchema
} from '../utils/validation';

export class PreferencesController {
  // Get user preferences
  static getPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      const preferences = await userService.getPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if none exist
        const defaultPreferences = await userService.createPreferences(userId, {});
        res.json({
          success: true,
          data: { preferences: defaultPreferences }
        });
        return;
      }

      res.json({
        success: true,
        data: { preferences }
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  };

  // Update user preferences
  static updatePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate request data
      const validationResult = userPreferencesUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
        return;
      }

      const preferencesData = validationResult.data;
      
      // Update preferences
      const updatedPreferences = await userService.updatePreferences(userId, preferencesData);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: { preferences: updatedPreferences }
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  };

  // Update dashboard layout
  static updateDashboardLayout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate dashboard layout
      const validationResult = dashboardLayoutSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
        return;
      }

      const dashboardLayout = validationResult.data;
      
      // Update only dashboard layout
      const updatedPreferences = await userService.updatePreferences(userId, { 
        dashboardLayout 
      });

      res.json({
        success: true,
        message: 'Dashboard layout updated successfully',
        data: { 
          dashboardLayout: updatedPreferences.dashboardLayout 
        }
      });
    } catch (error) {
      console.error('Update dashboard layout error:', error);
      res.status(500).json({ error: 'Failed to update dashboard layout' });
    }
  };

  // Update notification settings
  static updateNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate notification settings
      const validationResult = notificationSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
        return;
      }

      const notifications = validationResult.data;
      
      // Update only notifications
      const updatedPreferences = await userService.updatePreferences(userId, { 
        notifications 
      });

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
        data: { 
          notifications: updatedPreferences.notifications 
        }
      });
    } catch (error) {
      console.error('Update notifications error:', error);
      res.status(500).json({ error: 'Failed to update notification settings' });
    }
  };

  // Update privacy settings
  static updatePrivacySettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate privacy settings
      const validationResult = privacySettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
        return;
      }

      const privacySettings = validationResult.data;
      
      // Update only privacy settings
      const updatedPreferences = await userService.updatePreferences(userId, { 
        privacySettings 
      });

      res.json({
        success: true,
        message: 'Privacy settings updated successfully',
        data: { 
          privacySettings: updatedPreferences.privacySettings 
        }
      });
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(500).json({ error: 'Failed to update privacy settings' });
    }
  };

  // Update currency preference
  static updateCurrency = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { baseCurrency } = req.body;
      
      // Validate currency
      if (!baseCurrency || typeof baseCurrency !== 'string' || baseCurrency.length > 10) {
        res.status(400).json({ error: 'Invalid currency code' });
        return;
      }

      // Update currency
      const updatedPreferences = await userService.updatePreferences(userId, { 
        baseCurrency: baseCurrency.toUpperCase() 
      });

      res.json({
        success: true,
        message: 'Currency updated successfully',
        data: { 
          baseCurrency: updatedPreferences.baseCurrency 
        }
      });
    } catch (error) {
      console.error('Update currency error:', error);
      res.status(500).json({ error: 'Failed to update currency' });
    }
  };

  // Update theme preference
  static updateTheme = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { theme } = req.body;
      
      // Validate theme
      const validThemes = ['light', 'dark', 'auto'];
      if (!theme || !validThemes.includes(theme)) {
        res.status(400).json({ 
          error: 'Invalid theme. Must be one of: ' + validThemes.join(', ') 
        });
        return;
      }

      // Update theme
      const updatedPreferences = await userService.updatePreferences(userId, { 
        theme 
      });

      res.json({
        success: true,
        message: 'Theme updated successfully',
        data: { 
          theme: updatedPreferences.theme 
        }
      });
    } catch (error) {
      console.error('Update theme error:', error);
      res.status(500).json({ error: 'Failed to update theme' });
    }
  };

  // Update risk tolerance
  static updateRiskTolerance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { riskTolerance } = req.body;
      
      // Validate risk tolerance
      const validRiskLevels = ['conservative', 'moderate', 'aggressive'];
      if (!riskTolerance || !validRiskLevels.includes(riskTolerance)) {
        res.status(400).json({ 
          error: 'Invalid risk tolerance. Must be one of: ' + validRiskLevels.join(', ') 
        });
        return;
      }

      // Update risk tolerance
      const updatedPreferences = await userService.updatePreferences(userId, { 
        riskTolerance 
      });

      res.json({
        success: true,
        message: 'Risk tolerance updated successfully',
        data: { 
          riskTolerance: updatedPreferences.riskTolerance 
        }
      });
    } catch (error) {
      console.error('Update risk tolerance error:', error);
      res.status(500).json({ error: 'Failed to update risk tolerance' });
    }
  };

  // Reset preferences to default
  static resetPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Create new default preferences (will replace existing ones)
      const defaultPreferences = await userService.createPreferences(userId, {});

      res.json({
        success: true,
        message: 'Preferences reset to defaults successfully',
        data: { preferences: defaultPreferences }
      });
    } catch (error) {
      console.error('Reset preferences error:', error);
      res.status(500).json({ error: 'Failed to reset preferences' });
    }
  };

  // Get available options for preferences
  static getPreferenceOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const options = {
        themes: ['light', 'dark', 'auto'],
        currencies: [
          'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 
          'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT'
        ],
        riskTolerances: [
          { value: 'conservative', label: 'Conservative', description: 'Low risk, steady returns' },
          { value: 'moderate', label: 'Moderate', description: 'Balanced risk and return' },
          { value: 'aggressive', label: 'Aggressive', description: 'High risk, high potential returns' }
        ],
        timezones: [
          'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
          'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
          'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney'
        ],
        languages: [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Español' },
          { code: 'fr', name: 'Français' },
          { code: 'de', name: 'Deutsch' },
          { code: 'it', name: 'Italiano' },
          { code: 'pt', name: 'Português' },
          { code: 'ru', name: 'Русский' },
          { code: 'zh', name: '中文' },
          { code: 'ja', name: '日本語' },
          { code: 'ko', name: '한국어' }
        ],
        countries: [
          'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH',
          'AT', 'SE', 'NO', 'DK', 'FI', 'AU', 'NZ', 'JP', 'KR', 'SG',
          'HK', 'IN', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE'
        ]
      };

      res.json({
        success: true,
        data: { options }
      });
    } catch (error) {
      console.error('Get preference options error:', error);
      res.status(500).json({ error: 'Failed to fetch preference options' });
    }
  };

  // Import preferences from file
  static importPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { preferences } = req.body;
      
      if (!preferences || typeof preferences !== 'object') {
        res.status(400).json({ error: 'Invalid preferences data' });
        return;
      }

      // Validate imported preferences
      const validationResult = userPreferencesUpdateSchema.safeParse(preferences);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Invalid preferences format',
          details: validationResult.error.errors 
        });
        return;
      }

      // Update preferences with imported data
      const updatedPreferences = await userService.updatePreferences(userId, validationResult.data);

      res.json({
        success: true,
        message: 'Preferences imported successfully',
        data: { preferences: updatedPreferences }
      });
    } catch (error) {
      console.error('Import preferences error:', error);
      res.status(500).json({ error: 'Failed to import preferences' });
    }
  };

  // Export preferences
  static exportPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      const preferences = await userService.getPreferences(userId);
      
      if (!preferences) {
        res.status(404).json({ error: 'No preferences found' });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="preferences-export.json"');
      
      res.json({
        exportDate: new Date().toISOString(),
        preferences: {
          baseCurrency: preferences.baseCurrency,
          theme: preferences.theme,
          dashboardLayout: preferences.dashboardLayout,
          notifications: preferences.notifications,
          privacySettings: preferences.privacySettings,
          riskTolerance: preferences.riskTolerance
        }
      });
    } catch (error) {
      console.error('Export preferences error:', error);
      res.status(500).json({ error: 'Failed to export preferences' });
    }
  };
}

export const preferencesController = PreferencesController;