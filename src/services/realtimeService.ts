import { supabase } from '../lib/supabase';
import { audioService } from './audioService';

export interface RealtimeNotification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'task_overdue' | 'reschedule_requested' | 'schedule_updated' | 'assignment_created' | 'assignment_updated';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
  sound?: 'task' | 'schedule' | 'assignment';
}

class RealtimeService {
  private subscriptions: Map<string, any> = new Map();
  private notificationCallback?: (notification: RealtimeNotification) => void;
  private refreshCallback?: () => void;
  private currentUserId?: string;
  private currentUserRole?: string;
  private currentOrganizationId?: string;
  private currentOutletId?: string;
  private sentNotifications: Set<string> = new Set();

  private async playNotificationSound(soundType: 'task' | 'schedule' | 'assignment') {
    try {
      switch (soundType) {
        case 'task':
          await audioService.playTaskNotification();
          break;
        case 'schedule':
          await audioService.playScheduleNotification();
          break;
        case 'assignment':
          await audioService.playAssignmentNotification();
          break;
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  private async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private createRealtimeNotification(
    type: RealtimeNotification['type'],
    title: string,
    message: string,
    data?: any
  ): RealtimeNotification {
    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      data,
      sound: type.includes('assignment') ? 'assignment' : type.includes('schedule') ? 'schedule' : 'task'
    };
  }

  private handleNotification(notification: RealtimeNotification) {
    // Deduplication check
    const notificationKey = `${notification.type}_${notification.data?.id || 'unknown'}_${Math.floor(notification.timestamp.getTime() / 1000)}`;
    
    if (this.sentNotifications.has(notificationKey)) {
      return;
    }

    // Add to sent notifications and clean up old ones
    this.sentNotifications.add(notificationKey);
    if (this.sentNotifications.size > 100) {
      const oldKeys = Array.from(this.sentNotifications).slice(0, 50);
      oldKeys.forEach(key => this.sentNotifications.delete(key));
    }

    // Play sound
    if (notification.sound) {
      this.playNotificationSound(notification.sound);
    }

    // Show browser notification
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }

    // Call notification callback
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }

    // Call refresh callback for dashboard updates
    if (this.refreshCallback) {
      this.refreshCallback();
    }
  }

  public setNotificationCallback(callback: (notification: RealtimeNotification) => void) {
    this.notificationCallback = callback;
  }

  public setRefreshCallback(callback: () => void) {
    this.refreshCallback = callback;
  }

  public setCurrentUser(userId: string, role: string, organizationId?: string, outletId?: string) {
    // The branch identity arrives after the session, so this is called more than
    // once per sign-in. Rebuilding every channel each time would drop and reopen
    // websockets for no reason.
    const unchanged =
      this.currentUserId === userId &&
      this.currentUserRole === role &&
      this.currentOrganizationId === organizationId &&
      this.currentOutletId === outletId;

    if (unchanged) return;

    this.currentUserId = userId;
    this.currentUserRole = role;
    this.currentOrganizationId = organizationId;
    this.currentOutletId = outletId;

    this.cleanup();
    this.initialize();
  }

  public triggerNotification(notification: RealtimeNotification) {
    this.handleNotification(notification);
  }

  public async initialize() {
    await this.requestNotificationPermission();
    
    try {
      // Skip task assignments subscription - dashboard metrics already handles it
      console.log('🔄 Skipping task assignments subscription (handled by dashboard metrics)');
      
      console.log('🔄 Setting up tasks subscription...');
      this.subscribeToTasks();
      
      console.log('🔄 Setting up schedules subscription...');
      this.subscribeToSchedules();
      
      console.log('✅ Realtime service initialized');
    } catch (error) {
      console.error('❌ Realtime initialization failed:', error);
      throw error;
    }
  }

  // Replaces whatever is registered under this key, closing the old channel
  // first. Without this, navigating back to a dashboard opened a second
  // websocket channel for the same table and never closed the first.
  private register(key: string, channel: any) {
    const existing = this.subscriptions.get(key);
    if (existing) {
      supabase.removeChannel(existing);
    }
    this.subscriptions.set(key, channel);
  }

  private subscribeToTasks() {
    const subscription = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          console.log('🔔 Task change detected:', {
            eventType: payload.eventType,
            taskTitle: (payload.new as any)?.title,
            currentUser: this.currentUserId,
            currentRole: this.currentUserRole
          });
          // Only notify admin about task changes
          if (this.currentUserRole === 'admin') {
            const taskTitle = (payload.new as any)?.title || 'Unknown';
            const notification = this.createRealtimeNotification(
              'task_assigned',
              'Task Updated',
              `Task "${taskTitle}" has been updated`,
              payload.new
            );
            this.handleNotification(notification);
          }
        }
      )
      .subscribe();

    this.register('tasks', subscription);
  }

  private subscribeToSchedules() {
    const subscription = supabase
      .channel('schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          // There is no `schedules` table; this listened to nothing.
          table: 'daily_schedules',
        },
        (payload) => {
          const notification = this.createRealtimeNotification(
            'schedule_updated',
            'Schedule Updated',
            'Your schedule has been updated',
            payload.new
          );
          this.handleNotification(notification);
        }
      )
      .subscribe();

    this.register('schedules', subscription);
  }

  public subscribeToDashboardMetrics() {
    const subscription = supabase
      .channel('dashboard_metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        () => {
          this.refreshCallback?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          this.refreshCallback?.();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Dashboard metrics subscription failed');
        }
      });

    this.register('dashboard_metrics', subscription);

    return () => {
      // Actually close the channel. Only removing the map entry left it
      // subscribed for the rest of the session.
      const current = this.subscriptions.get('dashboard_metrics');
      if (current) {
        supabase.removeChannel(current);
        this.subscriptions.delete('dashboard_metrics');
      }
    };
  }

  public cleanup() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

export const realtimeService = new RealtimeService();