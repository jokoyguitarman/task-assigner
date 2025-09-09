import { useEffect, useCallback } from 'react';
import { realtimeService } from '../services/realtimeService';

interface UseAutoRefreshOptions {
  refreshFunction: () => void | Promise<void>;
  enabled?: boolean;
}

export const useAutoRefresh = ({ refreshFunction, enabled = true }: UseAutoRefreshOptions) => {
  const handleRefresh = useCallback(async () => {
    try {
      await refreshFunction();
      // Notifications are now handled by realtime subscriptions only
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, [refreshFunction]);

  useEffect(() => {
    if (!enabled) return;

    // Set up real-time refresh callback
    realtimeService.setRefreshCallback(handleRefresh);

    // Initial refresh
    handleRefresh();

    return () => {
      // Cleanup is handled by the realtime service
    };
  }, [enabled, handleRefresh]);

  return {
    refresh: handleRefresh,
  };
};
