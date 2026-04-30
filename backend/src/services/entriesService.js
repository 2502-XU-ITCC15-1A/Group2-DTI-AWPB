import { supabase } from '../config/supabaseClient.js';

export const getEntriesByUser = async (userId) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data;
};

export const deleteEntryById = async (id, userId) => {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

export const updateEntry = async (id, updates, userId) => {
  const { data, error } = await supabase
    .from('entries')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  return data;
};