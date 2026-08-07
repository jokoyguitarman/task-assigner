import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AuthClaims } from '../types';

// Who the caller is, according to the access token.
//
// The custom_access_token_hook stamps user_role, organization_id and outlet_id
// into the JWT at sign-in, and row-level security enforces exactly those values.
// Reading them here means the client and the database agree on identity by
// construction, instead of the client guessing from user_metadata (which the
// user can edit) and hoping the two match.
//
// Claims are fixed for the life of a token. If an owner changes a branch's
// organization, that branch sees it after its next token refresh.

export const MISSING_CLAIMS_MESSAGE =
  'Your session is missing its organization. Sign out and sign back in. If that does not ' +
  'help, the access token hook is probably not registered in Supabase ' +
  '(Authentication > Hooks > Customize Access Token).';

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;

    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const readClaims = (session: Session | null): AuthClaims => {
  if (!session?.access_token) return {};

  const payload = decodeJwtPayload(session.access_token);
  if (!payload) return {};

  const role = payload.user_role;

  return {
    role: role === 'admin' || role === 'outlet' ? role : undefined,
    organizationId: payload.organization_id ?? undefined,
    outletId: payload.outlet_id ?? undefined,
  };
};

export const getClaims = async (): Promise<AuthClaims> => {
  const { data } = await supabase.auth.getSession();
  return readClaims(data.session);
};

// For writes, which must stamp organization_id themselves: the column is NOT
// NULL and no default exists, so a missing claim has to fail loudly here rather
// than produce a constraint violation from deep inside PostgREST.
export const requireOrganizationId = async (): Promise<string> => {
  const { organizationId } = await getClaims();
  if (!organizationId) throw new Error(MISSING_CLAIMS_MESSAGE);
  return organizationId;
};

export const requireOutletId = async (): Promise<string> => {
  const { outletId } = await getClaims();
  if (!outletId) throw new Error('This action is only available when signed in as a branch.');
  return outletId;
};
