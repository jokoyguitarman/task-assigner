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

  // Audio service is initialized automatically

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
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private createBrowserNotification(notification: RealtimeNotification) {
    if (Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
        silent: false,
      });

      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }

  private createRealtimeNotification(
    type: RealtimeNotification['type'],
    title: string,
    message: string,
    data?: any
  ): RealtimeNotification {
    const soundMap: Record<RealtimeNotification['type'], 'task' | 'schedule' | 'assignment'> = {
      'task_assigned': 'task',
      'task_completed': 'task',
      'task_overdue': 'task',
      'reschedule_requested': 'task',
      'schedule_updated': 'schedule',
      'assignment_created': 'assignment',
      'assignment_updated': 'assignment',
    };

    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      data,
      sound: soundMap[type],
    };
  }

  private handleNotification(notification: RealtimeNotification) {
    console.log('🔔 Handling notification:', notification);
    
    // Play sound
    if (notification.sound) {
      this.playNotificationSound(notification.sound);
    }

    // Create browser notification
    this.createBrowserNotification(notification);

    // Call notification callback
    if (this.notificationCallback) {
      console.log('🔔 Calling notification callback');
      this.notificationCallback(notification);
    } else {
      console.warn('🔔 No notification callback set');
    }

    // Trigger refresh
    if (this.refreshCallback) {
      console.log('🔔 Triggering refresh callback');
      this.refreshCallback();
    } else {
      console.warn('🔔 No refresh callback set');
    }
  }

  public setNotificationCallback(callback: (notification: RealtimeNotification) => void) {
    this.notificationCallback = callback;
  }

  public setRefreshCallback(callback: () => void) {
    this.refreshCallback = callback;
  }

  public triggerNotification(notification: RealtimeNotification) {
    this.handleNotification(notification);
  }

  public async initialize() {
    console.log('🔔 Initializing real-time service...');
    await this.requestNotificationPermission();
    
    try {
      this.subscribeToTaskAssignments();
      this.subscribeToTasks();
      this.subscribeToSchedules();
      console.log('🔔 Real-time service initialized');
    } catch (error) {
      console.warn('🔔 Realtime initialization failed, using polling fallback mode:', error);
      // Start polling as fallback
      this.startPollingFallback();
    }
  }

  private startPollingFallback() {
    console.log('🔄 Starting polling fallback for notifications...');
    // Poll every 10 seconds to check for changes
    setInterval(async () => {
      await this.checkForChanges();
    }, 10000);
  }

  private async checkForChanges() {
    try {
      // This will be called by the refresh callback when data changes
      // We'll detect changes by comparing with previous state
      if (this.refreshCallback) {
        // Trigger a refresh which will also check for notifications
        this.refreshCallback();
      }
    } catch (error) {
      console.error('Error in polling fallback:', error);
    }
  }

  private subscribeToTaskAssignments() {
    console.log('🔔 Subscribing to task assignments changes...');
    const subscription = supabase
      .channel('task_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        (payload) => {
          console.log('Task assignment change detected:', payload);
          
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'INSERT') {
            const notification = this.createRealtimeNotification(
              'assignment_created',
              'New Task Assignment',
              `A new task has been assigned${newRecord.staffId ? ' to a staff member' : ' to an outlet'}`,
              newRecord
            );
            this.handleNotification(notification);
          } else if (eventType === 'UPDATE') {
            const statusChanged = oldRecord?.status !== newRecord?.status;
            
            if (statusChanged) {
              let notificationType: RealtimeNotification['type'];
              let title: string;
              let message: string;

              switch (newRecord.status) {
                case 'completed':
                  notificationType = 'task_completed';
                  title = 'Task Completed';
                  message = 'A task has been marked as completed';
                  break;
                case 'overdue':
                  notificationType = 'task_overdue';
                  title = 'Task Overdue';
                  message = 'A task has become overdue';
                  break;
                case 'reschedule_requested':
                  notificationType = 'reschedule_requested';
                  title = 'Reschedule Requested';
                  message = 'A staff member has requested to reschedule a task';
                  break;
                default:
                  notificationType = 'assignment_updated';
                  title = 'Assignment Updated';
                  message = 'A task assignment has been updated';
              }

              const notification = this.createRealtimeNotification(
                notificationType,
                title,
                message,
                newRecord
              );
              this.handleNotification(notification);
            } else {
              const notification = this.createRealtimeNotification(
                'assignment_updated',
                'Assignment Updated',
                'A task assignment has been updated',
                newRecord
              );
              this.handleNotification(notification);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Task assignments subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.warn('🔔 Task assignments realtime subscription failed - realtime may not be enabled');
        }
      });

    this.subscriptions.set('task_assignments', subscription);
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
          console.log('Task change detected:', payload);
          
          const { eventType, new: newRecord } = payload;
          
          if (eventType === 'INSERT') {
            const notification = this.createRealtimeNotification(
              'task_assigned',
              'New Task Created',
              `A new task "${newRecord.title}" has been created`,
              newRecord
            );
            this.handleNotification(notification);
          } else if (eventType === 'UPDATE') {
            const notification = this.createRealtimeNotification(
              'task_assigned',
              'Task Updated',
              `Task "${newRecord.title}" has been updated`,
              newRecord
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
          table: 'monthly_schedules',
        },
        (payload) => {
          console.log('Schedule change detected:', payload);
          
          const { new: newRecord } = payload;
          
          const notification = this.createRealtimeNotification(
            'schedule_updated',
            'Schedule Updated',
            'Staff schedules have been updated',
            newRecord
          );
          this.handleNotification(notification);
        }
      )
      .subscribe();

    this.subscriptions.set('monthly_schedules', subscription);

    // Also subscribe to daily schedules
    const dailySubscription = supabase
      .channel('daily_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_schedules',
        },
        (payload) => {
          console.log('Daily schedule change detected:', payload);
          
          const { new: newRecord } = payload;
          
          const notification = this.createRealtimeNotification(
            'schedule_updated',
            'Daily Schedule Updated',
            'Daily staff schedules have been updated',
            newRecord
          );
          this.handleNotification(notification);
        }
      )
      .subscribe();

    this.subscriptions.set('daily_schedules', dailySubscription);
  }

  public cleanup() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }

}

export const realtimeService = new RealtimeService();
