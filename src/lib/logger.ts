type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = __DEV__;
  private isEnabled = true;

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment && this.isEnabled) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.isEnabled) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.isEnabled) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (this.isEnabled) {
      const errorContext = error instanceof Error
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

export const logger = new Logger();
