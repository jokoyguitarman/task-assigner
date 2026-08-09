import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextType, Outlet, Organization } from '../types';
import { authAPI, outletsAPI, organizationsAPI, ProfileNotProvisionedError } from '../services/supabaseService';
import { readClaims } from '../lib/authClaims';
import { setAppTimeZone } from '../lib/dates';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [isOutletUser, setIsOutletUser] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const clearIdentity = useCallback(() => {
    setUser(null);
    setCurrentOutlet(null);
    setIsOutletUser(false);
    setOrganization(null);
    setNeedsSetup(false);
  }, []);

  // Establishes who the signed-in account is.
  //
  // Identity comes from the access token, which the database stamped via the
  // custom access token hook, and row-level security enforces exactly the same
  // values. The previous implementation guessed from user_metadata and fell back
  // to role 'admin' with a hardcoded organization id, which meant the client
  // believed it was an owner while the database disagreed.
  //
  // No claims means no profile yet: a new owner before creating their
  // organization, or an invited branch before redeeming its invitation. Both
  // route to setup rather than an empty dashboard.
  const loadIdentity = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.user) {
      clearIdentity();
      return;
    }

    const claims = readClaims(session);

    if (!claims.role || !claims.organizationId) {
      setUser(null);
      setOrganization(null);
      setCurrentOutlet(null);
      setIsOutletUser(false);
      setNeedsSetup(true);
      return;
    }

    setNeedsSetup(false);

    const profile = await authAPI.getCurrentUser();

    // Claims exist but the profile is unreadable. Trust the token for identity
    // and fall back to the session for the display name only.
    setUser(
      profile ?? {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        role: claims.role,
        organizationId: claims.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    const org = await organizationsAPI.getById(claims.organizationId);
    setOrganization(org);

    // Every date the app shows or compares is a calendar day in the restaurant's
    // timezone, not the device's. Set here because it has to be in place before
    // any screen works out whether something is overdue.
    setAppTimeZone(org?.timezone);

    if (claims.role === 'outlet' && claims.outletId) {
      setIsOutletUser(true);
      try {
        setCurrentOutlet(await outletsAPI.getById(claims.outletId));
      } catch (error) {
        console.error('Could not load the branch for this session:', error);
        setCurrentOutlet(null);
      }
    } else {
      setIsOutletUser(false);
      setCurrentOutlet(null);
    }
  }, [clearIdentity]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await loadIdentity();
      } catch (error) {
        console.error('Error establishing session:', error);
        if (active) clearIdentity();
      } finally {
        if (active) setIsLoading(false);
      }
    };

    run();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearIdentity();
        return;
      }

      // TOKEN_REFRESHED matters as much as SIGNED_IN: it is how an account that
      // has just been provisioned picks up its new claims.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadIdentity().catch((error) => console.error('Error reloading session:', error));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadIdentity, clearIdentity]);

  // Called after bootstrap_organization or redeem_outlet_invitation. The current
  // token predates the profile and carries no claims, so it has to be reissued
  // before anything is readable.
  const refreshIdentity = async (): Promise<void> => {
    await supabase.auth.refreshSession();
    await loadIdentity();
  };

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await authAPI.login(email, password);
      await loadIdentity();
    } catch (error) {
      if (error instanceof ProfileNotProvisionedError) {
        setNeedsSetup(true);
        return;
      }
      console.error('Login error:', error);
      throw error instanceof Error ? error : new Error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearIdentity();
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    currentOutlet,
    isOutletUser,
    organization,
    needsSetup,
    refreshIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
