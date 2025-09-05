import { supabase } from '../lib/supabase';

export interface TierLimits {
  max_admins: number;
  max_restaurants: number;
  max_employees: number;
  current_admins: number;
  current_restaurants: number;
  current_employees: number;
  subscription_tier: string;
}

export interface UsageStats {
  admins_used: number;
  admins_max: number;
  restaurants_used: number;
  restaurants_max: number;
  employees_used: number;
  employees_max: number;
  subscription_tier: string;
}

export const tierLimitsService = {
  async getOrganizationLimits(organizationId: string): Promise<TierLimits | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_organization_limits', { org_id: organizationId });

      if (error) {
        console.error('Error getting organization limits:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error getting organization limits:', error);
      return null;
    }
  },

  async getUsageStats(organizationId: string): Promise<UsageStats | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_organization_usage_stats', { org_id: organizationId });

      if (error) {
        console.error('Error getting usage stats:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  },

  async canAddAdmin(organizationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('can_add_admin', { org_id: organizationId });

      if (error) {
        console.error('Error checking admin limit:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking admin limit:', error);
      return false;
    }
  },

  async canAddRestaurant(organizationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('can_add_restaurant', { org_id: organizationId });

      if (error) {
        console.error('Error checking restaurant limit:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking restaurant limit:', error);
      return false;
    }
  },

  async canAddEmployee(organizationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('can_add_employee', { org_id: organizationId });

      if (error) {
        console.error('Error checking employee limit:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking employee limit:', error);
      return false;
    }
  },

  async checkAllLimits(organizationId: string): Promise<{
    canAddAdmin: boolean;
    canAddRestaurant: boolean;
    canAddEmployee: boolean;
    limits: TierLimits | null;
  }> {
    try {
      const [canAddAdmin, canAddRestaurant, canAddEmployee, limits] = await Promise.all([
        this.canAddAdmin(organizationId),
        this.canAddRestaurant(organizationId),
        this.canAddEmployee(organizationId),
        this.getOrganizationLimits(organizationId),
      ]);

      return {
        canAddAdmin,
        canAddRestaurant,
        canAddEmployee,
        limits,
      };
    } catch (error) {
      console.error('Error checking all limits:', error);
      return {
        canAddAdmin: false,
        canAddRestaurant: false,
        canAddEmployee: false,
        limits: null,
      };
    }
  },
};
