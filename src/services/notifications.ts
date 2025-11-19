import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];
type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];
type NotificationPreferencesUpdate = Database['public']['Tables']['notification_preferences']['Update'];

export const notificationService = {
  async getNotifications(userId: string, businessId?: string, limit = 50) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getUnreadCount(userId: string, businessId?: string) {
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as NotificationUpdate)
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllAsRead(userId: string, businessId?: string) {
    let query = supabase
      .from('notifications')
      .update({ is_read: true } as NotificationUpdate)
      .eq('user_id', userId)
      .eq('is_read', false);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { error } = await query;

    if (error) throw error;
  },

  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
  },

  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updatePreferences(userId: string, preferences: NotificationPreferencesUpdate) {
    const updateData: any = {
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(updateData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return channel;
  },

  async unsubscribeFromNotifications(channel: any) {
    if (channel) {
      try {
        await channel.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from notifications:', error);
      }
    }
  },
};
