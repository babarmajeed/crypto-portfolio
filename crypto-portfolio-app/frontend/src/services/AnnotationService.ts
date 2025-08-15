import {
  Annotation,
  AnnotationLayer,
  AnnotationSnapshot,
  AnnotationExportOptions,
  AnnotationShareSettings,
  AnnotationTemplate,
  AnnotationExportData,
  AnnotationImportResult,
  AnnotationValidationResult,
  AnnotationAlert,
  AnnotationAnalytics,
  DrawingMetrics,
  AnnotationType,
  AnnotationFilter
} from '../types/annotation.types';

export class AnnotationService {
  private annotations = new Map<string, Annotation>();
  private layers = new Map<string, AnnotationLayer>();
  private snapshots = new Map<string, AnnotationSnapshot>();
  private templates = new Map<string, AnnotationTemplate>();
  private sharedAnnotations = new Map<string, AnnotationSnapshot>();
  private analytics = new Map<string, AnnotationAnalytics>();
  private readonly storagePrefix = 'chart-annotations';
  private readonly cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.loadFromStorage();
    this.initializeDefaultLayer();
  }

  // Annotation CRUD operations
  async saveAnnotations(chartId: string, annotations: Annotation[], layers?: AnnotationLayer[]): Promise<boolean> {
    try {
      const snapshot: AnnotationSnapshot = {
        id: this.generateSnapshotId(),
        chartId,
        annotations,
        layers: layers || Array.from(this.layers.values()),
        timestamp: new Date().toISOString(),
        description: `Auto-save for chart ${chartId}`
      };

      // Validate annotations before saving
      const validation = this.validateAnnotations(annotations);
      if (!validation.isValid) {
        console.warn('Annotation validation warnings:', validation.warnings);
      }

      // Save to memory cache
      this.snapshots.set(chartId, snapshot);
      
      // Save to localStorage
      this.saveSnapshotToStorage(chartId, snapshot);
      
      // Update analytics
      annotations.forEach(annotation => {
        this.updateAnalytics(annotation.id, { lastAccessed: new Date().toISOString() });
      });
      
      return true;
    } catch (error) {
      console.error('Error saving annotations:', error);
      throw new Error(`Failed to save annotations: ${error}`);
    }
  }

  async loadAnnotations(chartId: string): Promise<{ annotations: Annotation[], layers: AnnotationLayer[] }> {
    try {
      // Try memory cache first
      if (this.snapshots.has(chartId)) {
        const snapshot = this.snapshots.get(chartId)!;
        this.updateAnalytics(chartId, { views: this.getAnalytics(chartId)?.views || 0 + 1 });
        return { annotations: snapshot.annotations, layers: snapshot.layers };
      }

      // Try localStorage
      const stored = this.loadSnapshotFromStorage(chartId);
      if (stored) {
        this.snapshots.set(chartId, stored);
        this.updateAnalytics(chartId, { views: this.getAnalytics(chartId)?.views || 0 + 1 });
        return { annotations: stored.annotations, layers: stored.layers };
      }

      // Return defaults
      return { 
        annotations: [], 
        layers: [this.getDefaultLayer()] 
      };
    } catch (error) {
      console.error('Error loading annotations:', error);
      throw new Error(`Failed to load annotations: ${error}`);
    }
  }

  async deleteAnnotations(chartId: string): Promise<boolean> {
    try {
      // Remove from memory
      this.snapshots.delete(chartId);
      
      // Remove from localStorage
      localStorage.removeItem(`${this.storagePrefix}-${chartId}`);
      
      // Remove analytics
      this.analytics.delete(chartId);
      localStorage.removeItem(`${this.storagePrefix}-analytics-${chartId}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting annotations:', error);
      throw error;
    }
  }

  // Individual annotation operations
  async saveAnnotation(annotation: Annotation): Promise<string> {
    try {
      const now = new Date().toISOString();
      const annotationToSave = {
        ...annotation,
        updatedAt: now
      };

      this.annotations.set(annotation.id, annotationToSave);
      
      // Update analytics
      this.updateAnalytics(annotation.id, {
        interactions: (this.getAnalytics(annotation.id)?.interactions || 0) + 1
      });

      return annotation.id;
    } catch (error) {
      console.error('Error saving annotation:', error);
      throw error;
    }
  }

  async getAnnotation(annotationId: string): Promise<Annotation | null> {
    return this.annotations.get(annotationId) || null;
  }

  async deleteAnnotation(annotationId: string): Promise<boolean> {
    try {
      const deleted = this.annotations.delete(annotationId);
      if (deleted) {
        this.analytics.delete(annotationId);
      }
      return deleted;
    } catch (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
  }

  // Layer management
  async createLayer(layer: Omit<AnnotationLayer, 'id'>): Promise<string> {
    const layerId = this.generateLayerId();
    const newLayer: AnnotationLayer = {
      ...layer,
      id: layerId
    };
    
    this.layers.set(layerId, newLayer);
    return layerId;
  }

  async getLayer(layerId: string): Promise<AnnotationLayer | null> {
    return this.layers.get(layerId) || null;
  }

  async updateLayer(layerId: string, updates: Partial<AnnotationLayer>): Promise<boolean> {
    try {
      const layer = this.layers.get(layerId);
      if (!layer) return false;

      const updatedLayer = { ...layer, ...updates };
      this.layers.set(layerId, updatedLayer);
      return true;
    } catch (error) {
      console.error('Error updating layer:', error);
      return false;
    }
  }

  async deleteLayer(layerId: string): Promise<boolean> {
    try {
      return this.layers.delete(layerId);
    } catch (error) {
      console.error('Error deleting layer:', error);
      return false;
    }
  }

  async getLayers(): Promise<AnnotationLayer[]> {
    return Array.from(this.layers.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  // Sharing functionality
  async shareAnnotations(
    chartId: string, 
    shareSettings: AnnotationShareSettings
  ): Promise<{ shareId: string; shareUrl: string }> {
    try {
      const snapshot = this.snapshots.get(chartId);
      if (!snapshot) {
        throw new Error('No annotations found for chart');
      }

      const shareId = this.generateShareId();
      const sharedSnapshot: AnnotationSnapshot = {
        ...snapshot,
        id: shareId,
        description: `Shared annotations for chart ${chartId}`,
        tags: ['shared']
      };

      this.sharedAnnotations.set(shareId, sharedSnapshot);
      localStorage.setItem(
        `${this.storagePrefix}-shared-${shareId}`,
        JSON.stringify({
          snapshot: sharedSnapshot,
          shareSettings,
          sharedAt: new Date().toISOString()
        })
      );

      const baseUrl = window.location.origin;
      return {
        shareId,
        shareUrl: `${baseUrl}/shared-annotations/${shareId}`
      };
    } catch (error) {
      console.error('Error sharing annotations:', error);
      throw error;
    }
  }

  async getSharedAnnotations(shareId: string): Promise<{
    snapshot: AnnotationSnapshot;
    shareSettings: AnnotationShareSettings;
  }> {
    try {
      // Check memory cache first
      if (this.sharedAnnotations.has(shareId)) {
        const snapshot = this.sharedAnnotations.get(shareId)!;
        const stored = localStorage.getItem(`${this.storagePrefix}-shared-${shareId}`);
        const shareData = stored ? JSON.parse(stored) : { shareSettings: {} };
        return { snapshot, shareSettings: shareData.shareSettings };
      }

      // Check localStorage
      const stored = localStorage.getItem(`${this.storagePrefix}-shared-${shareId}`);
      if (stored) {
        const shareData = JSON.parse(stored);
        
        // Check if share has expired
        if (shareData.shareSettings?.expiresAt) {
          const expiryDate = new Date(shareData.shareSettings.expiresAt);
          if (expiryDate < new Date()) {
            throw new Error('Shared annotations have expired');
          }
        }
        
        this.sharedAnnotations.set(shareId, shareData.snapshot);
        return shareData;
      }

      throw new Error('Shared annotations not found');
    } catch (error) {
      console.error('Error getting shared annotations:', error);
      throw error;
    }
  }

  // Export functionality
  async exportAnnotations(
    chartId: string,
    options: AnnotationExportOptions
  ): Promise<string | Blob> {
    try {
      const snapshot = this.snapshots.get(chartId) || await this.loadAnnotations(chartId);
      
      switch (options.format) {
        case 'json':
          return this.exportAsJSON(snapshot, options);
        case 'csv':
          return this.exportAsCSV(snapshot.annotations, options);
        case 'png':
        case 'svg':
          return this.exportAsImage(snapshot, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      console.error('Error exporting annotations:', error);
      throw error;
    }
  }

  private exportAsJSON(
    data: { annotations: Annotation[], layers: AnnotationLayer[] },
    options: AnnotationExportOptions
  ): string {
    const exportData: AnnotationExportData = {
      version: '1.0',
      chartId: 'exported',
      exportDate: new Date().toISOString(),
      annotations: options.includeStyle ? data.annotations : data.annotations.map(a => ({ ...a, style: {} as any })),
      layers: data.layers,
      metadata: {
        totalCount: data.annotations.length,
        typeCounts: this.countAnnotationsByType(data.annotations)
      }
    };

    if (!options.includeMetadata) {
      delete (exportData as any).metadata;
    }

    const jsonString = JSON.stringify(exportData, null, options.compression ? 0 : 2);
    return jsonString;
  }

  private exportAsCSV(annotations: Annotation[], options: AnnotationExportOptions): string {
    const headers = [
      'ID', 'Type', 'Layer', 'Text', 'Points', 'Style', 'Created At', 'Updated At'
    ];
    
    const rows = annotations.map(annotation => [
      annotation.id,
      annotation.type,
      annotation.layer || 'default',
      this.getAnnotationText(annotation),
      this.getAnnotationPoints(annotation),
      options.includeStyle ? JSON.stringify(annotation.style) : '',
      annotation.createdAt,
      annotation.updatedAt || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  private async exportAsImage(
    data: { annotations: Annotation[], layers: AnnotationLayer[] },
    options: AnnotationExportOptions
  ): Promise<Blob> {
    // This would require canvas rendering - simplified implementation
    const canvas = document.createElement('canvas');
    canvas.width = options.resolution || 1920;
    canvas.height = options.resolution || 1080;
    
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render annotations (simplified)
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText(`${data.annotations.length} annotations exported`, 50, 50);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, options.format === 'png' ? 'image/png' : 'image/svg+xml');
    });
  }

  // Import functionality
  async importAnnotations(file: File, chartId: string): Promise<AnnotationImportResult> {
    try {
      const text = await file.text();
      let data: AnnotationExportData;

      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error('Invalid JSON format');
      }

      if (!data.annotations || !Array.isArray(data.annotations)) {
        throw new Error('Invalid annotation file format');
      }

      const result: AnnotationImportResult = {
        imported: 0,
        skipped: 0,
        errors: [],
        warnings: [],
        duplicates: []
      };

      // Validate and import annotations
      for (const annotation of data.annotations) {
        try {
          const validation = this.validateAnnotation(annotation);
          if (!validation.isValid) {
            result.errors.push(`Annotation ${annotation.id}: ${validation.errors.join(', ')}`);
            result.skipped++;
            continue;
          }

          // Check for duplicates
          if (this.annotations.has(annotation.id)) {
            result.duplicates.push(annotation.id);
            annotation.id = this.generateAnnotationId();
          }

          await this.saveAnnotation(annotation);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import annotation ${annotation.id}: ${error}`);
          result.skipped++;
        }
      }

      // Import layers if present
      if (data.layers) {
        for (const layer of data.layers) {
          if (!this.layers.has(layer.id)) {
            this.layers.set(layer.id, layer);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing annotations:', error);
      throw error;
    }
  }

  // Templates
  async getTemplates(category?: string): Promise<AnnotationTemplate[]> {
    const templates = Array.from(this.templates.values());
    return category ? templates.filter(t => t.category === category) : templates;
  }

  async getTemplate(templateId: string): Promise<AnnotationTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async saveTemplate(template: Omit<AnnotationTemplate, 'id'>): Promise<string> {
    const templateId = this.generateTemplateId();
    const newTemplate: AnnotationTemplate = {
      ...template,
      id: templateId
    };
    
    this.templates.set(templateId, newTemplate);
    localStorage.setItem(`${this.storagePrefix}-template-${templateId}`, JSON.stringify(newTemplate));
    
    return templateId;
  }

  // Filtering and search
  filterAnnotations(annotations: Annotation[], filter: AnnotationFilter): Annotation[] {
    return annotations.filter(annotation => {
      if (filter.types && !filter.types.includes(annotation.type)) return false;
      if (filter.layers && !filter.layers.includes(annotation.layer || 'default')) return false;
      if (filter.createdBy && annotation.createdBy !== filter.createdBy) return false;
      if (filter.visible !== undefined && annotation.visible !== filter.visible) return false;
      if (filter.locked !== undefined && annotation.locked !== filter.locked) return false;
      
      if (filter.tags && annotation.tags) {
        const hasMatchingTag = filter.tags.some(tag => annotation.tags!.includes(tag));
        if (!hasMatchingTag) return false;
      }
      
      if (filter.dateRange) {
        const createdDate = new Date(annotation.createdAt);
        const start = new Date(filter.dateRange.start);
        const end = new Date(filter.dateRange.end);
        if (createdDate < start || createdDate > end) return false;
      }
      
      return true;
    });
  }

  searchAnnotations(annotations: Annotation[], query: string): Annotation[] {
    const lowercaseQuery = query.toLowerCase();
    return annotations.filter(annotation => {
      // Search in text content
      const text = this.getAnnotationText(annotation).toLowerCase();
      if (text.includes(lowercaseQuery)) return true;
      
      // Search in description
      if (annotation.description?.toLowerCase().includes(lowercaseQuery)) return true;
      
      // Search in tags
      if (annotation.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))) return true;
      
      return false;
    });
  }

  // Validation
  validateAnnotation(annotation: Annotation): AnnotationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!annotation.id) {
      errors.push('Annotation must have an ID');
    }

    if (!annotation.type) {
      errors.push('Annotation must have a type');
    }

    if (!annotation.createdAt) {
      errors.push('Annotation must have a creation date');
    }

    // Type-specific validation
    switch (annotation.type) {
      case 'line':
      case 'trend':
      case 'horizontal':
      case 'vertical':
        if (!('points' in annotation) || annotation.points.length !== 2) {
          errors.push('Line annotations must have exactly 2 points');
        }
        break;
      
      case 'text':
      case 'note':
        if (!('text' in annotation) || !annotation.text) {
          errors.push('Text annotations must have text content');
        }
        if (!('position' in annotation)) {
          errors.push('Text annotations must have a position');
        }
        break;
      
      case 'fibonacci':
        if (!('points' in annotation) || annotation.points.length < 2) {
          errors.push('Fibonacci annotations must have at least 2 points');
        }
        if (!('levels' in annotation) || !Array.isArray(annotation.levels)) {
          errors.push('Fibonacci annotations must have levels array');
        }
        break;
    }

    // Style validation
    if (annotation.style) {
      if (annotation.style.lineWidth && annotation.style.lineWidth <= 0) {
        warnings.push('Line width should be positive');
      }
      if (annotation.style.opacity && (annotation.style.opacity < 0 || annotation.style.opacity > 1)) {
        warnings.push('Opacity should be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateAnnotations(annotations: Annotation[]): AnnotationValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    annotations.forEach((annotation, index) => {
      const validation = this.validateAnnotation(annotation);
      validation.errors.forEach(error => allErrors.push(`[${index}] ${error}`));
      validation.warnings.forEach(warning => allWarnings.push(`[${index}] ${warning}`));
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  // Analytics
  async getDrawingMetrics(chartId?: string): Promise<DrawingMetrics> {
    const annotations = chartId 
      ? (this.snapshots.get(chartId)?.annotations || [])
      : Array.from(this.annotations.values());

    const typeCounts = this.countAnnotationsByType(annotations);
    const analytics = Array.from(this.analytics.values());

    return {
      totalAnnotations: annotations.length,
      annotationsByType: typeCounts,
      averageAccuracy: analytics.reduce((sum, a) => sum + (a.accuracy || 0), 0) / analytics.length || 0,
      totalDrawingTime: analytics.reduce((sum, a) => sum + (a.usage.totalTimeSpent || 0), 0),
      mostUsedTools: this.getMostUsedTools(typeCounts),
      performanceMetrics: {
        averageRenderTime: analytics.reduce((sum, a) => sum + (a.performance?.renderTime || 0), 0) / analytics.length || 0,
        peakMemoryUsage: Math.max(...analytics.map(a => a.performance?.memoryUsage || 0)),
        errorRate: 0 // Would be calculated based on actual error tracking
      }
    };
  }

  // Alert management
  async createAlert(annotation: Annotation, alertSettings: any): Promise<AnnotationAlert | null> {
    try {
      if (annotation.type === 'horizontal' && 'points' in annotation) {
        const alert: AnnotationAlert = {
          id: this.generateAlertId(),
          annotationId: annotation.id,
          type: 'price-cross',
          condition: alertSettings.condition || 'cross',
          price: annotation.points[0].price,
          message: alertSettings.message || `Price alert from annotation`,
          enabled: true,
          triggered: false,
          triggerCount: 0
        };
        
        return alert;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating alert:', error);
      return null;
    }
  }

  // Helper methods
  private initializeDefaultLayer(): void {
    const defaultLayer: AnnotationLayer = {
      id: 'default',
      name: 'Default Layer',
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
      annotations: []
    };
    this.layers.set('default', defaultLayer);
  }

  private getDefaultLayer(): AnnotationLayer {
    return this.layers.get('default')!;
  }

  private updateAnalytics(annotationId: string, updates: Partial<AnnotationAnalytics>): void {
    try {
      const existing = this.analytics.get(annotationId) || {
        annotationId,
        views: 0,
        interactions: 0,
        usage: {
          created: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          totalTimeSpent: 0
        }
      };
      
      const updated = { ...existing, ...updates };
      this.analytics.set(annotationId, updated);
      
      localStorage.setItem(
        `${this.storagePrefix}-analytics-${annotationId}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.warn('Failed to update analytics:', error);
    }
  }

  private getAnalytics(annotationId: string): AnnotationAnalytics | null {
    return this.analytics.get(annotationId) || null;
  }

  private countAnnotationsByType(annotations: Annotation[]): { [type in AnnotationType]?: number } {
    return annotations.reduce((counts, annotation) => {
      counts[annotation.type] = (counts[annotation.type] || 0) + 1;
      return counts;
    }, {} as { [type in AnnotationType]?: number });
  }

  private getMostUsedTools(typeCounts: { [type: string]: number }): string[] {
    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);
  }

  private getAnnotationText(annotation: Annotation): string {
    if ('text' in annotation) return annotation.text;
    if (annotation.description) return annotation.description;
    return '';
  }

  private getAnnotationPoints(annotation: Annotation): string {
    if ('points' in annotation) {
      return annotation.points.map(p => `${p.time},${p.price}`).join(';');
    }
    if ('position' in annotation) {
      return `${annotation.position.time},${annotation.position.price}`;
    }
    return '';
  }

  // Storage operations
  private saveSnapshotToStorage(chartId: string, snapshot: AnnotationSnapshot): void {
    try {
      localStorage.setItem(`${this.storagePrefix}-${chartId}`, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw error;
    }
  }

  private loadSnapshotFromStorage(chartId: string): AnnotationSnapshot | null {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}-${chartId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  private loadFromStorage(): void {
    try {
      // Load snapshots
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.storagePrefix}-`) && 
            !key.includes('analytics') && !key.includes('shared') && !key.includes('template')) {
          try {
            const snapshot = JSON.parse(localStorage.getItem(key) || '');
            const chartId = key.replace(`${this.storagePrefix}-`, '');
            this.snapshots.set(chartId, snapshot);
          } catch (error) {
            console.warn(`Failed to load snapshot from ${key}:`, error);
          }
        }
      }

      // Load analytics
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`${this.storagePrefix}-analytics-`)) {
          try {
            const analytics = JSON.parse(localStorage.getItem(key) || '');
            const annotationId = key.replace(`${this.storagePrefix}-analytics-`, '');
            this.analytics.set(annotationId, analytics);
          } catch (error) {
            console.warn(`Failed to load analytics from ${key}:`, error);
          }
        }
      }

      // Load templates
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`${this.storagePrefix}-template-`)) {
          try {
            const template = JSON.parse(localStorage.getItem(key) || '');
            this.templates.set(template.id, template);
          } catch (error) {
            console.warn(`Failed to load template from ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }

  // ID generation
  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAnnotationId(): string {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShareId(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.cacheExpiry);
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            const timestamp = new Date(data.timestamp || data.createdAt || 0);
            
            if (timestamp < cutoffDate && !data.isPinned) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
    }
  }
}

export const annotationService = new AnnotationService();