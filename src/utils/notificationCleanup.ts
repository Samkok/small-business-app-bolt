type NotificationCleanupCallback = (businessId: string) => void;

class NotificationCleanupService {
  private callback: NotificationCleanupCallback | null = null;

  register(callback: NotificationCleanupCallback) {
    this.callback = callback;
  }

  unregister() {
    this.callback = null;
  }

  cleanup(businessId: string) {
    if (this.callback) {
      this.callback(businessId);
    }
  }
}

export const notificationCleanupService = new NotificationCleanupService();
