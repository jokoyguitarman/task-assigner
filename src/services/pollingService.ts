import { assignmentsAPI } from './supabaseService';
import { realtimeService } from './realtimeService';

interface PollingNotification {
  id: string;
  type: 'task_completed' | 'task_overdue' | 'assignment_created';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckTime: Date = new Date();
  private notificationCallback?: (notification: PollingNotification) => void;
  private isRunning = false;

  public setNotificationCallback(callback: (notification: PollingNotification) => void) {
    this.notificationCallback = callback;
  }

  public startPolling(intervalMs: number = 10000) { // Check every 10 seconds
    if (this.isRunning) return;
    
    console.log('🔄 Starting polling service for notifications...');
    this.isRunning = true;
    
    this.intervalId = setInterval(async () => {
      await this.checkForUpdates();
    }, intervalMs);
  }

  public stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🔄 Polling service stopped');
  }

  private async checkForUpdates() {
    try {
      // Get all assignments updated since last check
      const assignments = await assignmentsAPI.getAll();
      
      // Filter for assignments updated since last check
      const recentUpdates = assignments.filter(assignment => {
        const updatedAt = new Date(assignment.updatedAt);
        return updatedAt > this.lastCheckTime;
      });

      // Process each update
      for (const assignment of recentUpdates) {
        await this.processAssignmentUpdate(assignment);
      }

      // Update last check time
      this.lastCheckTime = new Date();

    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  private async processAssignmentUpdate(assignment: any) {
    // Check if assignment was just completed
    if (assignment.status === 'completed' && assignment.completedAt) {
      const completedAt = new Date(assignment.completedAt);
      const isRecent = completedAt > this.lastCheckTime;
      
      if (isRecent) {
        const notification: PollingNotification = {
          id: `polling_${assignment.id}_${Date.now()}`,
          type: 'task_completed',
          title: 'Task Completed',
          message: `A task has been marked as completed`,
          timestamp: new Date(),
          data: assignment
        };

        this.triggerNotification(notification);
      }
    }

    // Check if assignment became overdue
    if (assignment.status === 'overdue') {
      const updatedAt = new Date(assignment.updatedAt);
      const isRecent = updatedAt > this.lastCheckTime;
      
      if (isRecent) {
        const notification: PollingNotification = {
          id: `polling_overdue_${assignment.id}_${Date.now()}`,
          type: 'task_overdue',
          title: 'Task Overdue',
          message: `A task has become overdue`,
          timestamp: new Date(),
          data: assignment
        };

        this.triggerNotification(notification);
      }
    }
  }

  private triggerNotification(notification: PollingNotification) {
    console.log('🔔 Polling notification triggered:', notification);
    
    // Convert to RealtimeNotification format
    const soundMap: Record<string, 'task' | 'schedule' | 'assignment'> = {
      'task_completed': 'task',
      'task_overdue': 'task',
      'assignment_created': 'assignment'
    };
    
    const realtimeNotification = {
      id: notification.id,
      type: notification.type as any, // Type conversion
      title: notification.title,
      message: notification.message,
      timestamp: notification.timestamp,
      data: notification.data,
      sound: soundMap[notification.type] || 'task' // Map to correct sound type
    };
    
    // Trigger realtime service for audio and browser notifications
    realtimeService.triggerNotification(realtimeNotification);
    
    // Call notification callback
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }
  }

}

export const pollingService = new PollingService();
