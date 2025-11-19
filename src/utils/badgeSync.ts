import { pushNotificationService } from '../services/pushNotifications';

export class BadgeSync {
  private static currentCount = 0;

  static async updateBadge(count: number) {
    if (count < 0) count = 0;

    if (this.currentCount !== count) {
      this.currentCount = count;
      await pushNotificationService.setBadgeCount(count);
    }
  }

  static async incrementBadge() {
    this.currentCount += 1;
    await pushNotificationService.setBadgeCount(this.currentCount);
  }

  static async decrementBadge() {
    if (this.currentCount > 0) {
      this.currentCount -= 1;
      await pushNotificationService.setBadgeCount(this.currentCount);
    }
  }

  static async clearBadge() {
    this.currentCount = 0;
    await pushNotificationService.clearBadge();
  }

  static getCurrentCount(): number {
    return this.currentCount;
  }

  static setCurrentCount(count: number) {
    this.currentCount = count;
  }
}
