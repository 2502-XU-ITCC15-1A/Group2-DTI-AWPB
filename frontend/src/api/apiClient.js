import { supabase } from '../lib/supabase.js'; 

const API_BASE = '/api';

async function getAccessToken() {
  const { data: {session} } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export async function apiFetch(endpoint, options = {}) {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token && { Authorization: `Bearer ${token}` })
    }
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }

  return res.json();
}