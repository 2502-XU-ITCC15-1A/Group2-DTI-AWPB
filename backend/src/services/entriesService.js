import { supabaseAdmin } from '../config/supabaseClient.js';

export const getEntriesByUser = async (userId) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('owner_id', userId);

  /*console.log("Update result:", data);
  console.log("error:", error);*/
  if (error) throw error;
  return data;
};

export const deleteEntryById = async (id, userId) => {
  const { error } = await supabaseAdmin
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No rows deleted (check id/owner_id match)');
  }
};

export const updateEntryById = async (id, updates, userId) => {
  //console.log("Filtering by owner_id:", userId);
  const { data, error } = await supabaseAdmin
    .from('entries')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', userId)
    .select();
  
  /*console.log("Update result:", data);
  console.log("error:", error);
  console.log("id:", id);*/

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No rows updated (check id/owner_id match)');
  }

  return data;
};