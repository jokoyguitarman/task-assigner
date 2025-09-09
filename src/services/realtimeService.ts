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
    console.log('🔔 Setting current user context:', { userId, role, organizationId, outletId });
    this.currentUserId = userId;
    this.currentUserRole = role;
    this.currentOrganizationId = organizationId;
    this.currentOutletId = outletId;
    
    // Clean up existing subscriptions and reinitialize
    this.cleanup();
    this.initialize();
  }

  public triggerNotification(notification: RealtimeNotification) {
    this.handleNotification(notification);
  }

  public testNotification() {
    const testNotification = this.createRealtimeNotification(
      'assignment_created',
      'Test Notification',
      'This is a test notification to verify the system is working',
      { test: true }
    );
    this.handleNotification(testNotification);
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

  public testRealtimeConnection() {
    console.log('🧪 Testing real-time connection...');
    console.log('🧪 Current user context:', {
      userId: this.currentUserId,
      role: this.currentUserRole,
      organizationId: this.currentOrganizationId
    });
    console.log('🧪 Refresh callback set:', !!this.refreshCallback);
    console.log('🧪 Subscriptions count:', this.subscriptions.size);
    
    // Test manual refresh
    if (this.refreshCallback) {
      console.log('🧪 Testing manual refresh...');
      this.refreshCallback();
    }
  }


  private shouldNotifyUser(newRecord: any, oldRecord: any, eventType: string): boolean {
    if (!this.currentUserId || !this.currentUserRole) {
      return false;
    }

    // For new assignments (INSERT)
    if (eventType === 'INSERT') {
      // Admin gets notified of all new assignments
      if (this.currentUserRole === 'admin') {
        return true;
      }
      // Assigned user gets notified
      if (this.currentUserRole === 'staff' && (newRecord as any)?.staffId === this.currentUserId) {
        return true;
      }
      if (this.currentUserRole === 'outlet' && (newRecord as any)?.outletId === this.currentOutletId) {
        return true;
      }
      return false;
    }

    // For updates (UPDATE)
    if (eventType === 'UPDATE') {
      // Admin gets notified of all updates (completions, assignments, etc.)
      if (this.currentUserRole === 'admin') {
        return true;
      }
      
      // Staff gets notified of their own task updates
      if (this.currentUserRole === 'staff' && (newRecord as any)?.staffId === this.currentUserId) {
        return true;
      }
      
      // Outlet gets notified of their outlet's task updates
      if (this.currentUserRole === 'outlet' && (newRecord as any)?.outletId === this.currentOutletId) {
        return true;
      }
    }

    return false;
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

    this.subscriptions.set('tasks', subscription);
  }

  private subscribeToSchedules() {
    const subscription = supabase
      .channel('schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
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

    this.subscriptions.set('schedules', subscription);
  }

  public subscribeToDashboardMetrics() {
    console.log('🔄 Setting up dashboard metrics subscription for user:', {
      userId: this.currentUserId,
      role: this.currentUserRole,
      organizationId: this.currentOrganizationId
    });
    
    const subscription = supabase
      .channel('dashboard_metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        (payload) => {
          console.log('🔔 Dashboard metrics - assignment change detected:', {
            eventType: payload.eventType,
            status: (payload.new as any)?.status,
            staffId: (payload.new as any)?.staffId,
            outletId: (payload.new as any)?.outletId,
            currentUser: this.currentUserId,
            currentRole: this.currentUserRole
          });
          console.log('🔔 Full payload:', payload);
          if (this.refreshCallback) {
            console.log('🔔 Triggering dashboard refresh for assignment change');
            this.refreshCallback();
          } else {
            console.warn('🔔 No refresh callback set');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          if (this.refreshCallback) {
            this.refreshCallback();
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Dashboard metrics subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Dashboard metrics subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('❌ Dashboard metrics subscription failed');
        }
      });

    // Add a test listener to see if we can receive any events
    const testSubscription = supabase
      .channel('test_connection')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        (payload) => {
          console.log('🧪 TEST: Task assignments change detected:', payload.eventType);
        }
      )
      .subscribe((status) => {
        console.log('🧪 TEST: Real-time test subscription status:', status);
      });

    this.subscriptions.set('dashboard_metrics', subscription);
    return () => {
      console.log('🔄 Cleaning up dashboard metrics subscription');
      this.subscriptions.delete('dashboard_metrics');
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