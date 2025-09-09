import { assignmentsAPI, tasksAPI } from './supabaseService';

export interface NotificationData {
  id: string;
  type: 'task_completed' | 'task_assigned' | 'task_overdue' | 'assignment_created';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

class NotificationService {
  private lastAssignmentStates: Map<string, any> = new Map();
  private notificationCallback?: (notification: NotificationData) => void;
  private currentUserId?: string;
  private currentUserRole?: string;

  public setNotificationCallback(callback: (notification: NotificationData) => void) {
    this.notificationCallback = callback;
  }

  public setCurrentUser(userId: string, role: string) {
    this.currentUserId = userId;
    this.currentUserRole = role;
  }

  public async checkForChanges() {
    try {
      const assignments = await assignmentsAPI.getAll();
      const currentStates = new Map();
      
      // Store current states
      assignments.forEach(assignment => {
        currentStates.set(assignment.id, {
          status: assignment.status,
          completedAt: assignment.completedAt,
          updatedAt: assignment.updatedAt
        });
      });

      // Check for changes
      currentStates.forEach(async (currentState, assignmentId) => {
        const previousState = this.lastAssignmentStates.get(assignmentId);
        
        if (previousState) {
          // Check if status changed to completed
          if (previousState.status !== 'completed' && currentState.status === 'completed') {
            // Only notify admin when task is completed (not the staff who completed it)
            if (this.currentUserRole === 'admin') {
              await this.triggerTaskCompletedNotification(assignmentId, currentState);
            }
          }
          
          // Check if status changed to overdue
          if (previousState.status !== 'overdue' && currentState.status === 'overdue') {
            // Notify admin about overdue tasks
            if (this.currentUserRole === 'admin') {
              this.triggerNotification({
                id: `task_overdue_${assignmentId}_${Date.now()}`,
                type: 'task_overdue',
                title: 'Task Overdue',
                message: 'A task has become overdue',
                timestamp: new Date(),
                data: { assignmentId, ...currentState }
              });
            }
          }
        } else {
          // New assignment - notify staff member who was assigned
          if (this.currentUserRole === 'staff' || this.currentUserRole === 'outlet') {
            this.triggerNotification({
              id: `task_assigned_${assignmentId}_${Date.now()}`,
              type: 'task_assigned',
              title: 'New Task Assignment',
              message: 'A new task has been assigned to you',
              timestamp: new Date(),
              data: { assignmentId, ...currentState }
            });
          }
        }
      });

      // Update stored states
      this.lastAssignmentStates = currentStates;

    } catch (error) {
      console.error('Error checking for notification changes:', error);
    }
  }

  private async triggerTaskCompletedNotification(assignmentId: string, currentState: any) {
    try {
      // Get assignment details to find the task and staff member
      const assignment = await assignmentsAPI.getById(assignmentId);
      const task = await tasksAPI.getById(assignment.taskId);
      
      // Create notification for admin
      this.triggerNotification({
        id: `task_completed_${assignmentId}_${Date.now()}`,
        type: 'task_completed',
        title: 'Task Completed',
        message: `"${task.title}" has been completed by staff`,
        timestamp: new Date(),
        data: { 
          assignmentId, 
          taskId: task.id,
          taskTitle: task.title,
          staffId: assignment.staffId,
          ...currentState 
        }
      });
    } catch (error) {
      console.error('Error creating task completed notification:', error);
      // Fallback to simple notification
      this.triggerNotification({
        id: `task_completed_${assignmentId}_${Date.now()}`,
        type: 'task_completed',
        title: 'Task Completed',
        message: 'A task has been marked as completed',
        timestamp: new Date(),
        data: { assignmentId, ...currentState }
      });
    }
  }

  private triggerNotification(notification: NotificationData) {
    console.log('🔔 Notification triggered:', notification);
    
    // Convert to RealtimeNotification format
    const soundMap: Record<string, 'task' | 'schedule' | 'assignment'> = {
      'task_completed': 'task',
      'task_assigned': 'task',
      'task_overdue': 'task',
      'assignment_created': 'assignment',
      'schedule_updated': 'schedule'
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
    
    // Audio and browser notifications are now handled by realtimeService directly
    
    // Call notification callback
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }
  }

}

export const notificationService = new NotificationService();
