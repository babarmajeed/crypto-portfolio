import { v4 as uuidv4 } from 'uuid';
import { AnalyticsEvent, BusinessMetric, DashboardMetric, KPIDefinition, TrendData } from '@/types/monitoring.types';
import { redisService } from './redisService';
import { loggingService } from './loggingService';
import { businessKPIs } from '@/config/monitoring.config';

interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: string[];
  events: string[];
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  device?: string;
}

interface CohortData {
  period: string;
  newUsers: number;
  returnedUsers: Map<number, number>; // day -> count
}

class AnalyticsService {
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private sessions = new Map<string, UserSession>();

  constructor() {
    this.flushInterval = setInterval(() => {
      this.flushEvents().catch(console.error);
    }, 10000); // Flush every 10 seconds

    // Clean up old sessions every hour
    setInterval(() => {
      this.cleanupSessions();
    }, 3600000);
  }

  /**
   * Track user event
   */
  public async trackEvent(
    eventType: AnalyticsEvent['eventType'],
    category: string,
    action: string,
    label?: string,
    value?: number,
    userId?: string,
    sessionId?: string,
    properties?: Record<string, any>,
    context?: AnalyticsEvent['context']
  ): Promise<void> {
    const event: AnalyticsEvent = {
      id: uuidv4(),
      eventType,
      category,
      action,
      label,
      value,
      userId,
      sessionId,
      timestamp: new Date(),
      properties,
      context
    };

    this.eventQueue.push(event);

    // Update session if available
    if (sessionId) {
      this.updateSession(sessionId, { 
        userId,
        lastActivity: new Date(),
        events: [event.id],
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        country: context?.country,
        device: context?.device
      });
    }

    // Log the event
    loggingService.logInfo(`Analytics event: ${category}.${action}`, {
      userId,
      sessionId,
      metadata: {
        eventType,
        category,
        action,
        label,
        value,
        properties
      },
      tags: ['analytics', eventType, category]
    });

    // Flush immediately for critical events
    if (eventType === 'security' || (properties?.priority === 'high')) {
      await this.flushEvents();
    }
  }

  /**
   * Track user action
   */
  public async trackUserAction(
    action: string,
    resource: string,
    userId: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackEvent(
      'user_action',
      'user',
      action,
      resource,
      undefined,
      userId,
      sessionId,
      {
        resource,
        ...metadata
      }
    );
  }

  /**
   * Track page view
   */
  public async trackPageView(
    page: string,
    userId?: string,
    sessionId?: string,
    referrer?: string,
    context?: AnalyticsEvent['context']
  ): Promise<void> {
    await this.trackEvent(
      'user_action',
      'navigation',
      'page_view',
      page,
      undefined,
      userId,
      sessionId,
      { page, referrer },
      context
    );

    // Update session
    if (sessionId) {
      this.updateSession(sessionId, {
        userId,
        lastActivity: new Date(),
        pageViews: [page]
      });
    }
  }

  /**
   * Track business metric
   */
  public async trackBusinessMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    description?: string
  ): Promise<void> {
    const metric: BusinessMetric = {
      name,
      value,
      timestamp: new Date(),
      period: 'minute', // Default period
      tags,
      description
    };

    // Store in Redis with multiple time periods
    const periods = ['minute', 'hour', 'day', 'week', 'month'] as const;
    
    for (const period of periods) {
      const key = this.getMetricKey(name, period);
      const timeSlot = this.getTimeSlot(new Date(), period);
      
      await redisService.hincrby(key, timeSlot, value);
      await redisService.expire(key, this.getRetentionSeconds(period));
    }

    // Log the metric
    loggingService.logBusinessMetric(name, value, 'count', {
      metadata: { tags, description, period: 'minute' }
    });

    // Track as analytics event
    await this.trackEvent(
      'business_metric',
      'metric',
      'recorded',
      name,
      value,
      undefined,
      undefined,
      { tags, description }
    );
  }

  /**
   * Calculate and track KPIs
   */
  public async calculateKPIs(): Promise<DashboardMetric[]> {
    const metrics: DashboardMetric[] = [];

    for (const kpi of businessKPIs) {
      try {
        const value = await this.calculateKPI(kpi);
        const previousValue = await this.getPreviousKPIValue(kpi);
        
        const metric: DashboardMetric = {
          name: kpi.id,
          displayName: kpi.name,
          value,
          change: previousValue !== null ? {
            value: value - previousValue,
            percentage: previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0,
            period: kpi.period
          } : undefined,
          format: this.getMetricFormat(kpi.unit),
          category: kpi.category === 'business' ? 'business' : 
                    kpi.category === 'product' ? 'business' :
                    kpi.category === 'financial' ? 'business' : 'performance',
          timestamp: new Date()
        };

        metrics.push(metric);

        // Store the calculated KPI
        await this.storeKPIValue(kpi.id, value, kpi.period);
        
      } catch (error) {
        loggingService.logError(`Failed to calculate KPI ${kpi.id}`, error as Error);
      }
    }

    return metrics;
  }

  /**
   * Get real-time analytics data
   */
  public async getRealTimeAnalytics(): Promise<{
    activeUsers: number;
    pageViews: number;
    events: number;
    errors: number;
    responseTime: number;
  }> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Count active sessions
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => session.lastActivity > fiveMinutesAgo);

    // Get metrics from Redis
    const [pageViews, events, errors] = await Promise.all([
      this.getMetricValue('page_views', 'minute', now),
      this.getMetricValue('events_total', 'minute', now),
      this.getMetricValue('errors_total', 'minute', now)
    ]);

    // Get average response time (simplified)
    const responseTime = await this.getAverageResponseTime();

    return {
      activeUsers: activeSessions.length,
      pageViews: pageViews || 0,
      events: events || 0,
      errors: errors || 0,
      responseTime: responseTime || 0
    };
  }

  /**
   * Get user analytics
   */
  public async getUserAnalytics(userId: string, period = '7d'): Promise<{
    totalSessions: number;
    totalPageViews: number;
    totalEvents: number;
    averageSessionDuration: number;
    lastActivity: Date | null;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    
    // Calculate start date based on period
    const days = period === '24h' ? 1 : parseInt(period.replace('d', ''));
    startDate.setDate(endDate.getDate() - days);

    // Get user events from Redis
    const userEventsKey = `user_analytics:${userId}`;
    const events = await redisService.lrange(userEventsKey, 0, -1);
    
    const userEvents = events
      .map(e => JSON.parse(e))
      .filter(e => new Date(e.timestamp) >= startDate);

    // Calculate metrics
    const sessions = new Set(userEvents.map(e => e.sessionId).filter(Boolean));
    const pageViews = userEvents.filter(e => e.action === 'page_view');
    
    // Get session durations (simplified)
    let totalSessionDuration = 0;
    for (const sessionId of sessions) {
      const sessionEvents = userEvents.filter(e => e.sessionId === sessionId);
      if (sessionEvents.length > 1) {
        const start = new Date(sessionEvents[0].timestamp);
        const end = new Date(sessionEvents[sessionEvents.length - 1].timestamp);
        totalSessionDuration += end.getTime() - start.getTime();
      }
    }

    const lastEvent = userEvents.length > 0 ? 
      new Date(userEvents[userEvents.length - 1].timestamp) : null;

    return {
      totalSessions: sessions.size,
      totalPageViews: pageViews.length,
      totalEvents: userEvents.length,
      averageSessionDuration: sessions.size > 0 ? totalSessionDuration / sessions.size : 0,
      lastActivity: lastEvent
    };
  }

  /**
   * Get trend data for metrics
   */
  public async getTrendData(
    metricName: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    points = 30
  ): Promise<TrendData> {
    const data: Array<{ timestamp: Date; value: number }> = [];
    const now = new Date();

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now);
      
      // Calculate the timestamp for this data point
      switch (period) {
        case 'hour':
          timestamp.setHours(timestamp.getHours() - i);
          break;
        case 'day':
          timestamp.setDate(timestamp.getDate() - i);
          break;
        case 'week':
          timestamp.setDate(timestamp.getDate() - (i * 7));
          break;
        case 'month':
          timestamp.setMonth(timestamp.getMonth() - i);
          break;
      }

      const value = await this.getMetricValue(metricName, period, timestamp) || 0;
      data.push({ timestamp, value });
    }

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let changePercent = 0;

    if (data.length >= 2) {
      const firstValue = data[0].value;
      const lastValue = data[data.length - 1].value;
      
      if (firstValue > 0) {
        changePercent = ((lastValue - firstValue) / firstValue) * 100;
        trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';
      } else if (lastValue > firstValue) {
        trend = 'up';
        changePercent = 100;
      }
    }

    return {
      metric: metricName,
      period,
      data,
      trend,
      changePercent
    };
  }

  /**
   * Perform cohort analysis
   */
  public async performCohortAnalysis(
    startDate: Date,
    endDate: Date,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<CohortData[]> {
    // This would typically query a database for user registration and return data
    // For now, return a simplified implementation
    const cohorts: CohortData[] = [];
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const periodKey = this.formatDateForPeriod(current, period);
      
      // Get new users for this period (simplified)
      const newUsers = await this.getMetricValue(`new_users_${period}`, period, current) || 0;
      
      const cohort: CohortData = {
        period: periodKey,
        newUsers,
        returnedUsers: new Map()
      };

      // Calculate retention for subsequent periods
      for (let week = 1; week <= 12; week++) {
        const retentionDate = new Date(current);
        retentionDate.setDate(retentionDate.getDate() + (week * 7));
        
        if (retentionDate <= new Date()) {
          const returnedUsers = await this.getRetentionCount(current, retentionDate) || 0;
          cohort.returnedUsers.set(week, returnedUsers);
        }
      }

      cohorts.push(cohort);
      
      // Move to next period
      switch (period) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return cohorts;
  }

  /**
   * Create or update user session
   */
  public createSession(
    sessionId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const session: UserSession = {
      sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      pageViews: [],
      events: [],
      ipAddress,
      userAgent,
      country: undefined, // Would be determined by IP geolocation
      device: this.detectDevice(userAgent)
    };

    this.sessions.set(sessionId, session);
  }

  /**
   * Update existing session
   */
  private updateSession(
    sessionId: string,
    updates: Partial<UserSession>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (updates.pageViews) {
        session.pageViews.push(...updates.pageViews);
      }
      if (updates.events) {
        session.events.push(...updates.events);
      }
      Object.assign(session, updates);
    }
  }

  /**
   * End user session
   */
  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const duration = new Date().getTime() - session.startTime.getTime();
      
      // Track session ended event
      this.trackEvent(
        'user_action',
        'session',
        'ended',
        undefined,
        duration,
        session.userId,
        sessionId,
        {
          duration,
          pageViews: session.pageViews.length,
          events: session.events.length
        }
      ).catch(console.error);

      this.sessions.delete(sessionId);
    }
  }

  /**
   * Flush events to storage
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue.length = 0;

    try {
      // Store events in Redis for real-time access
      const pipeline = redisService.pipeline();
      
      for (const event of events) {
        // Store individual event
        const eventKey = `analytics:events:${event.id}`;
        pipeline.setex(eventKey, 86400, JSON.stringify(event)); // 24 hour retention

        // Update counters
        const dateKey = this.formatDateForPeriod(event.timestamp, 'day');
        pipeline.hincrby(`analytics:daily:${dateKey}`, `${event.category}:${event.action}`, 1);
        
        // Store user events
        if (event.userId) {
          const userKey = `user_analytics:${event.userId}`;
          pipeline.lpush(userKey, JSON.stringify(event));
          pipeline.expire(userKey, 86400 * 30); // 30 days retention
        }

        // Update real-time metrics
        pipeline.hincrby('analytics:realtime', event.category, 1);
        pipeline.expire('analytics:realtime', 300); // 5 minutes
      }

      await pipeline.exec();

      loggingService.logInfo(`Flushed ${events.length} analytics events to Redis`);
      
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      loggingService.logError('Failed to flush analytics events', error as Error);
    }
  }

  /**
   * Helper methods
   */
  private getMetricKey(name: string, period: string): string {
    return `metrics:${name}:${period}`;
  }

  private getTimeSlot(date: Date, period: string): string {
    switch (period) {
      case 'minute':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth() + 1}`;
      default:
        return date.toISOString();
    }
  }

  private getRetentionSeconds(period: string): number {
    switch (period) {
      case 'minute': return 3600; // 1 hour
      case 'hour': return 86400; // 1 day
      case 'day': return 86400 * 30; // 30 days
      case 'week': return 86400 * 365; // 1 year
      case 'month': return 86400 * 365 * 2; // 2 years
      default: return 86400;
    }
  }

  private async calculateKPI(kpi: KPIDefinition): Promise<number> {
    // Simplified KPI calculation - would be more complex in reality
    switch (kpi.id) {
      case 'daily-active-users':
        return await this.getMetricValue('active_users', 'day', new Date()) || 0;
      case 'monthly-active-users':
        return await this.getMetricValue('active_users', 'month', new Date()) || 0;
      default:
        return await this.getMetricValue(kpi.metric, kpi.period === 'realtime' ? 'minute' : kpi.period, new Date()) || 0;
    }
  }

  private async getPreviousKPIValue(kpi: KPIDefinition): Promise<number | null> {
    const previousDate = new Date();
    switch (kpi.period) {
      case 'daily':
        previousDate.setDate(previousDate.getDate() - 1);
        break;
      case 'weekly':
        previousDate.setDate(previousDate.getDate() - 7);
        break;
      case 'monthly':
        previousDate.setMonth(previousDate.getMonth() - 1);
        break;
      default:
        return null;
    }

    const key = `kpi:${kpi.id}:${this.formatDateForPeriod(previousDate, kpi.period)}`;
    const value = await redisService.get(key);
    return value ? parseFloat(value) : null;
  }

  private async storeKPIValue(kpiId: string, value: number, period: string): Promise<void> {
    const key = `kpi:${kpiId}:${this.formatDateForPeriod(new Date(), period)}`;
    await redisService.setex(key, 86400 * 365, value.toString()); // 1 year retention
  }

  private async getMetricValue(metric: string, period: string, date: Date): Promise<number | null> {
    const key = this.getMetricKey(metric, period);
    const timeSlot = this.getTimeSlot(date, period);
    const value = await redisService.hget(key, timeSlot);
    return value ? parseInt(value) : null;
  }

  private async getAverageResponseTime(): Promise<number> {
    // Would typically calculate from recent response times
    return 150; // Placeholder
  }

  private async getRetentionCount(cohortDate: Date, retentionDate: Date): Promise<number> {
    // Would typically query database for user retention
    return Math.floor(Math.random() * 100); // Placeholder
  }

  private getMetricFormat(unit: string): DashboardMetric['format'] {
    if (unit.includes('USD') || unit.includes('$')) return 'currency';
    if (unit.includes('%')) return 'percentage';
    if (unit.includes('bytes') || unit.includes('MB') || unit.includes('GB')) return 'bytes';
    if (unit.includes('ms') || unit.includes('seconds')) return 'duration';
    return 'number';
  }

  private formatDateForPeriod(date: Date, period: string): string {
    switch (period) {
      case 'daily':
      case 'day':
        return date.toISOString().split('T')[0];
      case 'weekly':
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString();
    }
  }

  private detectDevice(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
    if (/Tablet|iPad/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private cleanupSessions(): void {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > timeout) {
        this.endSession(sessionId);
      }
    }
  }

  /**
   * Cleanup on service shutdown
   */
  public async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    await this.flushEvents();
  }
}

export const analyticsService = new AnalyticsService();