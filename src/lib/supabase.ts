import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY are not set. ' +
      'Reads will return empty and writes will throw. See .env.example.'
  );
}

// A hand-written Database interface used to live here. It was never passed to
// createClient, so it type-checked nothing, and it had drifted badly: it named a
// file_url column that is actually file_path, gave users a 'staff' role that no
// longer exists, and omitted organization_id from every table.
//
// Generate it instead, once 0003_rebuild.sql has been applied:
//
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
//
// then parameterise the client with createClient<Database>(...) so the compiler
// actually checks column names.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
