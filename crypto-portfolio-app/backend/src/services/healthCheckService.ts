import { HealthCheckResult, SystemHealthStatus } from '@/types/monitoring.types';
import { monitoringConfig } from '@/config/monitoring.config';
import { loggingService } from './loggingService';
import { redisService } from './redisService';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as os from 'os';

interface HealthChecker {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

class HealthCheckService {
  private checkers: HealthChecker[] = [];
  private lastResults = new Map<string, HealthCheckResult>();
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeCheckers();
    this.startPeriodicChecks();
  }

  private initializeCheckers(): void {
    // Database health check
    this.checkers.push({
      name: 'database',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'database',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          const prisma = new PrismaClient();
          
          // Simple query to check database connectivity
          await prisma.$queryRaw`SELECT 1`;
          await prisma.$disconnect();

          result.duration = Date.now() - startTime;
          result.message = 'Database connection successful';
          result.details = {
            responseTime: result.duration,
            type: 'postgresql'
          };

          if (result.duration > 1000) {
            result.status = 'degraded';
            result.message = 'Database responding slowly';
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `Database connection failed: ${(error as Error).message}`;
          result.error = error as Error;
          result.details = {
            error: (error as Error).message,
            type: 'postgresql'
          };
        }

        return result;
      }
    });

    // Redis health check
    this.checkers.push({
      name: 'redis',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'redis',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          // Test Redis connectivity
          const testKey = `health_check_${Date.now()}`;
          await redisService.set(testKey, 'test', 'EX', 10);
          const value = await redisService.get(testKey);
          await redisService.del(testKey);

          if (value !== 'test') {
            throw new Error('Redis read/write test failed');
          }

          result.duration = Date.now() - startTime;
          result.message = 'Redis connection successful';
          result.details = {
            responseTime: result.duration,
            connected: true
          };

          if (result.duration > 500) {
            result.status = 'degraded';
            result.message = 'Redis responding slowly';
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `Redis connection failed: ${(error as Error).message}`;
          result.error = error as Error;
          result.details = {
            error: (error as Error).message,
            connected: false
          };
        }

        return result;
      }
    });

    // External APIs health check
    this.checkers.push({
      name: 'external_apis',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'external_apis',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        const apiChecks = [
          { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/ping' },
          { name: 'Binance', url: 'https://api.binance.com/api/v3/ping' }
        ];

        const results: any[] = [];
        let failedCount = 0;

        try {
          for (const api of apiChecks) {
            try {
              const apiStartTime = Date.now();
              const response = await axios.get(api.url, { timeout: 5000 });
              const apiDuration = Date.now() - apiStartTime;

              results.push({
                name: api.name,
                status: response.status === 200 ? 'healthy' : 'degraded',
                responseTime: apiDuration,
                statusCode: response.status
              });

            } catch (error) {
              failedCount++;
              results.push({
                name: api.name,
                status: 'unhealthy',
                error: (error as Error).message
              });
            }
          }

          result.duration = Date.now() - startTime;
          result.details = { apis: results };

          if (failedCount === 0) {
            result.status = 'healthy';
            result.message = 'All external APIs responding';
          } else if (failedCount < apiChecks.length) {
            result.status = 'degraded';
            result.message = `${failedCount}/${apiChecks.length} external APIs failing`;
          } else {
            result.status = 'unhealthy';
            result.message = 'All external APIs failing';
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `External API check failed: ${(error as Error).message}`;
          result.error = error as Error;
        }

        return result;
      }
    });

    // Disk space health check
    this.checkers.push({
      name: 'disk_space',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'disk_space',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          const stats = await fs.statvfs(process.cwd());
          const total = stats.bavail * stats.frsize;
          const free = stats.bavail * stats.frsize;
          const used = total - free;
          const usagePercent = (used / total) * 100;

          result.duration = Date.now() - startTime;
          result.details = {
            total: total,
            used: used,
            free: free,
            usagePercent: Math.round(usagePercent * 100) / 100
          };

          if (usagePercent > 90) {
            result.status = 'unhealthy';
            result.message = `Disk usage critical: ${usagePercent.toFixed(1)}%`;
          } else if (usagePercent > 80) {
            result.status = 'degraded';
            result.message = `Disk usage high: ${usagePercent.toFixed(1)}%`;
          } else {
            result.status = 'healthy';
            result.message = `Disk usage normal: ${usagePercent.toFixed(1)}%`;
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `Disk space check failed: ${(error as Error).message}`;
          result.error = error as Error;
        }

        return result;
      }
    });

    // Memory health check
    this.checkers.push({
      name: 'memory',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'memory',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          const memUsage = process.memoryUsage();
          const systemMem = {
            total: os.totalmem(),
            free: os.freemem()
          };
          
          const processMemUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
          const systemMemUsage = ((systemMem.total - systemMem.free) / systemMem.total) * 100;

          result.duration = Date.now() - startTime;
          result.details = {
            process: {
              heapUsed: memUsage.heapUsed,
              heapTotal: memUsage.heapTotal,
              usagePercent: Math.round(processMemUsage * 100) / 100
            },
            system: {
              total: systemMem.total,
              free: systemMem.free,
              used: systemMem.total - systemMem.free,
              usagePercent: Math.round(systemMemUsage * 100) / 100
            }
          };

          if (systemMemUsage > 90 || processMemUsage > 90) {
            result.status = 'unhealthy';
            result.message = `Memory usage critical: System ${systemMemUsage.toFixed(1)}%, Process ${processMemUsage.toFixed(1)}%`;
          } else if (systemMemUsage > 80 || processMemUsage > 80) {
            result.status = 'degraded';
            result.message = `Memory usage high: System ${systemMemUsage.toFixed(1)}%, Process ${processMemUsage.toFixed(1)}%`;
          } else {
            result.status = 'healthy';
            result.message = `Memory usage normal: System ${systemMemUsage.toFixed(1)}%, Process ${processMemUsage.toFixed(1)}%`;
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `Memory check failed: ${(error as Error).message}`;
          result.error = error as Error;
        }

        return result;
      }
    });

    // CPU health check
    this.checkers.push({
      name: 'cpu',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'cpu',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          const cpus = os.cpus();
          const loadAvg = os.loadavg();
          
          // Calculate CPU usage (simplified)
          const numCpus = cpus.length;
          const load1min = loadAvg[0];
          const load5min = loadAvg[1];
          const load15min = loadAvg[2];
          
          const cpuUsagePercent = (load1min / numCpus) * 100;

          result.duration = Date.now() - startTime;
          result.details = {
            cores: numCpus,
            loadAverage: {
              '1min': load1min,
              '5min': load5min,
              '15min': load15min
            },
            usagePercent: Math.round(cpuUsagePercent * 100) / 100
          };

          if (cpuUsagePercent > 90) {
            result.status = 'unhealthy';
            result.message = `CPU usage critical: ${cpuUsagePercent.toFixed(1)}%`;
          } else if (cpuUsagePercent > 80) {
            result.status = 'degraded';
            result.message = `CPU usage high: ${cpuUsagePercent.toFixed(1)}%`;
          } else {
            result.status = 'healthy';
            result.message = `CPU usage normal: ${cpuUsagePercent.toFixed(1)}%`;
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `CPU check failed: ${(error as Error).message}`;
          result.error = error as Error;
        }

        return result;
      }
    });

    // Application dependencies check
    this.checkers.push({
      name: 'application',
      check: async () => {
        const startTime = Date.now();
        const result: HealthCheckResult = {
          name: 'application',
          status: 'healthy',
          timestamp: new Date(),
          duration: 0
        };

        try {
          // Check critical application components
          const checks = {
            environment: process.env.NODE_ENV ? 'configured' : 'missing',
            port: process.env.PORT ? 'configured' : 'missing',
            database_url: process.env.DATABASE_URL ? 'configured' : 'missing',
            redis_url: process.env.REDIS_URL ? 'configured' : 'missing',
            jwt_secret: process.env.JWT_SECRET ? 'configured' : 'missing'
          };

          const missingConfigs = Object.entries(checks)
            .filter(([_, status]) => status === 'missing')
            .map(([key, _]) => key);

          result.duration = Date.now() - startTime;
          result.details = {
            configuration: checks,
            uptime: process.uptime(),
            version: process.version,
            platform: process.platform
          };

          if (missingConfigs.length > 0) {
            result.status = 'degraded';
            result.message = `Missing configurations: ${missingConfigs.join(', ')}`;
          } else {
            result.status = 'healthy';
            result.message = 'Application configuration valid';
          }

        } catch (error) {
          result.status = 'unhealthy';
          result.duration = Date.now() - startTime;
          result.message = `Application check failed: ${(error as Error).message}`;
          result.error = error as Error;
        }

        return result;
      }
    });

    loggingService.logInfo(`Initialized ${this.checkers.length} health checkers`);
  }

  /**
   * Run all health checks
   */
  public async runAllChecks(): Promise<SystemHealthStatus> {
    const enabledCheckers = this.checkers.filter(checker => 
      monitoringConfig.healthChecks.enabled.includes(checker.name)
    );

    const results: HealthCheckResult[] = [];
    
    // Run checks with timeout and retries
    for (const checker of enabledCheckers) {
      let result: HealthCheckResult;
      let attempts = 0;
      const maxRetries = monitoringConfig.healthChecks.retries;

      do {
        attempts++;
        try {
          // Run check with timeout
          result = await Promise.race([
            checker.check(),
            this.createTimeoutPromise(checker.name, monitoringConfig.healthChecks.timeout)
          ]);
          
          // Store last result
          this.lastResults.set(checker.name, result);
          
          // Log the result
          const level = result.status === 'unhealthy' ? 'error' : 
                       result.status === 'degraded' ? 'warn' : 'debug';
          
          loggingService.getLogger().log(level, `Health check ${checker.name}: ${result.status}`, {
            metadata: {
              healthCheck: checker.name,
              status: result.status,
              duration: result.duration,
              message: result.message,
              details: result.details
            },
            tags: ['health_check', checker.name, result.status]
          });

          break; // Success, exit retry loop

        } catch (error) {
          result = {
            name: checker.name,
            status: 'unhealthy',
            timestamp: new Date(),
            duration: monitoringConfig.healthChecks.timeout,
            message: `Health check failed: ${(error as Error).message}`,
            error: error as Error
          };

          if (attempts >= maxRetries) {
            this.lastResults.set(checker.name, result);
            loggingService.logError(`Health check ${checker.name} failed after ${attempts} attempts`, error as Error);
            break;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } while (attempts < maxRetries);

      results.push(result!);
    }

    // Determine overall system health
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;

    let overallStatus: SystemHealthStatus['overall'] = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const systemHealth: SystemHealthStatus = {
      overall: overallStatus,
      timestamp: new Date(),
      checks: results,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };

    // Log overall health status
    const level = overallStatus === 'unhealthy' ? 'error' : 
                 overallStatus === 'degraded' ? 'warn' : 'info';
    
    loggingService.getLogger().log(level, `System health check completed: ${overallStatus}`, {
      metadata: {
        overallStatus,
        checksRun: results.length,
        unhealthyCount,
        degradedCount,
        uptime: systemHealth.uptime
      },
      tags: ['health_check', 'system', overallStatus]
    });

    return systemHealth;
  }

  /**
   * Run a specific health check
   */
  public async runCheck(name: string): Promise<HealthCheckResult | null> {
    const checker = this.checkers.find(c => c.name === name);
    if (!checker) {
      return null;
    }

    try {
      const result = await Promise.race([
        checker.check(),
        this.createTimeoutPromise(name, monitoringConfig.healthChecks.timeout)
      ]);

      this.lastResults.set(name, result);
      return result;
      
    } catch (error) {
      const result: HealthCheckResult = {
        name,
        status: 'unhealthy',
        timestamp: new Date(),
        duration: monitoringConfig.healthChecks.timeout,
        message: `Health check failed: ${(error as Error).message}`,
        error: error as Error
      };

      this.lastResults.set(name, result);
      return result;
    }
  }

  /**
   * Get the last results for all checks
   */
  public getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  /**
   * Get available health checkers
   */
  public getAvailableCheckers(): string[] {
    return this.checkers.map(c => c.name);
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        loggingService.logError('Periodic health check failed', error as Error);
      }
    }, monitoringConfig.healthChecks.interval);

    loggingService.logInfo(`Started periodic health checks every ${monitoringConfig.healthChecks.interval}ms`);
  }

  /**
   * Stop periodic health checks
   */
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      loggingService.logInfo('Stopped periodic health checks');
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(checkerName: string, timeout: number): Promise<HealthCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check ${checkerName} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Register a custom health checker
   */
  public registerChecker(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    // Remove existing checker with same name
    this.checkers = this.checkers.filter(c => c.name !== name);
    
    // Add new checker
    this.checkers.push({
      name,
      check: checkFunction
    });

    loggingService.logInfo(`Registered custom health checker: ${name}`);
  }

  /**
   * Unregister a health checker
   */
  public unregisterChecker(name: string): void {
    this.checkers = this.checkers.filter(c => c.name !== name);
    this.lastResults.delete(name);
    
    loggingService.logInfo(`Unregistered health checker: ${name}`);
  }

  /**
   * Get health check summary for monitoring dashboards
   */
  public getHealthSummary(): {
    status: 'healthy' | 'unhealthy' | 'degraded';
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
    lastCheckTime: Date | null;
  } {
    const results = Array.from(this.lastResults.values());
    
    if (results.length === 0) {
      return {
        status: 'unhealthy',
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        unhealthyChecks: 0,
        lastCheckTime: null
      };
    }

    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const lastCheckTime = results.length > 0 ? 
      new Date(Math.max(...results.map(r => r.timestamp.getTime()))) : null;

    return {
      status: overallStatus,
      totalChecks: results.length,
      healthyChecks: healthyCount,
      degradedChecks: degradedCount,
      unhealthyChecks: unhealthyCount,
      lastCheckTime
    };
  }

  /**
   * Cleanup on service shutdown
   */
  public cleanup(): void {
    this.stopPeriodicChecks();
    this.lastResults.clear();
    this.checkers.length = 0;
  }
}

export const healthCheckService = new HealthCheckService();