import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  let res;
  try {
    res = await fetch(import.meta.env.VITE_API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}
