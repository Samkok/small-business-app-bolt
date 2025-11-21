/**
 * Data Cleanup Registry
 *
 * Centralized service for managing data cleanup when business changes.
 * Components and contexts register cleanup callbacks that are triggered
 * when the user switches businesses or is removed from a business.
 */

type CleanupCallback = (removedBusinessId?: string) => void | Promise<void>;

class DataCleanupRegistry {
  private callbacks: Map<string, CleanupCallback> = new Map();
  private isCleaningUp = false;

  /**
   * Register a cleanup callback for a component/context
   */
  register(key: string, callback: CleanupCallback): void {
    this.callbacks.set(key, callback);
    console.log(`[DataCleanupRegistry] Registered cleanup callback: ${key}`);
  }

  /**
   * Unregister a cleanup callback
   */
  unregister(key: string): void {
    this.callbacks.delete(key);
    console.log(`[DataCleanupRegistry] Unregistered cleanup callback: ${key}`);
  }

  /**
   * Trigger all registered cleanup callbacks
   */
  async cleanup(removedBusinessId?: string): Promise<void> {
    if (this.isCleaningUp) {
      console.log('[DataCleanupRegistry] Cleanup already in progress, skipping...');
      return;
    }

    this.isCleaningUp = true;

    console.log(
      `[DataCleanupRegistry] Starting cleanup for ${this.callbacks.size} registered callbacks`,
      removedBusinessId ? `(removed business: ${removedBusinessId})` : '(business switch)'
    );

    const cleanupPromises: Promise<void>[] = [];

    for (const [key, callback] of this.callbacks.entries()) {
      try {
        console.log(`[DataCleanupRegistry] Executing cleanup: ${key}`);
        const result = callback(removedBusinessId);

        // If callback returns a promise, add it to the array
        if (result instanceof Promise) {
          cleanupPromises.push(result);
        }
      } catch (error) {
        console.error(`[DataCleanupRegistry] Error in cleanup callback ${key}:`, error);
      }
    }

    // Wait for all async cleanups to complete
    if (cleanupPromises.length > 0) {
      try {
        await Promise.all(cleanupPromises);
        console.log('[DataCleanupRegistry] All async cleanups completed');
      } catch (error) {
        console.error('[DataCleanupRegistry] Error waiting for cleanups:', error);
      }
    }

    this.isCleaningUp = false;
    console.log('[DataCleanupRegistry] Cleanup finished');
  }

  /**
   * Cleanup data for a specific business (when user is removed)
   */
  async cleanupForRemovedBusiness(businessId: string): Promise<void> {
    console.log(`[DataCleanupRegistry] Cleaning up data for removed business: ${businessId}`);
    await this.cleanup(businessId);
  }

  /**
   * Cleanup all data (when switching businesses)
   */
  async cleanupAll(): Promise<void> {
    console.log('[DataCleanupRegistry] Cleaning up all data (business switch)');
    await this.cleanup();
  }

  /**
   * Check if cleanup is currently in progress
   */
  isInProgress(): boolean {
    return this.isCleaningUp;
  }

  /**
   * Get count of registered callbacks
   */
  getRegisteredCount(): number {
    return this.callbacks.size;
  }

  /**
   * Clear all registered callbacks (useful for testing or reset)
   */
  clear(): void {
    this.callbacks.clear();
    console.log('[DataCleanupRegistry] All callbacks cleared');
  }
}

// Export singleton instance
export const dataCleanupRegistry = new DataCleanupRegistry();
