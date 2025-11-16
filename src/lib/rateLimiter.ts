import AsyncStorage from '@react-native-async-storage/async-storage';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

interface AttemptRecord {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const defaultConfig: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
};

export class RateLimiter {
  private config: RateLimitConfig;
  private storageKey: string;

  constructor(identifier: string, config: Partial<RateLimitConfig> = {}) {
    this.storageKey = `rateLimit:${identifier}`;
    this.config = { ...defaultConfig, ...config };
  }

  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remainingAttempts: number;
    resetTime?: number;
    blockedUntil?: number;
  }> {
    const now = Date.now();
    const record = await this.getRecord(key);

    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: record.blockedUntil,
      };
    }

    if (record.blockedUntil && record.blockedUntil <= now) {
      await this.resetRecord(key);
      return {
        allowed: true,
        remainingAttempts: this.config.maxAttempts,
      };
    }

    const windowExpired = now - record.firstAttemptTime > this.config.windowMs;

    if (windowExpired) {
      await this.resetRecord(key);
      return {
        allowed: true,
        remainingAttempts: this.config.maxAttempts,
      };
    }

    if (record.attempts >= this.config.maxAttempts) {
      const blockedUntil = now + this.config.blockDurationMs;
      await this.blockRecord(key, blockedUntil);
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - record.attempts,
      resetTime: record.firstAttemptTime + this.config.windowMs,
    };
  }

  async recordAttempt(key: string): Promise<void> {
    const now = Date.now();
    const record = await this.getRecord(key);

    const windowExpired = now - record.firstAttemptTime > this.config.windowMs;

    if (windowExpired || record.attempts === 0) {
      await this.saveRecord(key, {
        attempts: 1,
        firstAttemptTime: now,
      });
    } else {
      await this.saveRecord(key, {
        ...record,
        attempts: record.attempts + 1,
      });
    }
  }

  async resetLimit(key: string): Promise<void> {
    await this.resetRecord(key);
  }

  private async getRecord(key: string): Promise<AttemptRecord> {
    try {
      const storageKey = `${this.storageKey}:${key}`;
      const data = await AsyncStorage.getItem(storageKey);

      if (!data) {
        return {
          attempts: 0,
          firstAttemptTime: Date.now(),
        };
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting rate limit record:', error);
      return {
        attempts: 0,
        firstAttemptTime: Date.now(),
      };
    }
  }

  private async saveRecord(key: string, record: AttemptRecord): Promise<void> {
    try {
      const storageKey = `${this.storageKey}:${key}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(record));
    } catch (error) {
      console.error('Error saving rate limit record:', error);
    }
  }

  private async resetRecord(key: string): Promise<void> {
    try {
      const storageKey = `${this.storageKey}:${key}`;
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error resetting rate limit record:', error);
    }
  }

  private async blockRecord(key: string, blockedUntil: number): Promise<void> {
    const record = await this.getRecord(key);
    await this.saveRecord(key, {
      ...record,
      blockedUntil,
    });
  }

  static formatBlockDuration(ms: number): string {
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
}

export const loginRateLimiter = new RateLimiter('login', {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
});

export const passwordResetRateLimiter = new RateLimiter('passwordReset', {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
});

export const apiRateLimiter = new RateLimiter('api', {
  maxAttempts: 100,
  windowMs: 60 * 1000,
  blockDurationMs: 5 * 60 * 1000,
});
