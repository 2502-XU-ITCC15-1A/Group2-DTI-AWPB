import { supabase } from '../config/supabaseClient.js';

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
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);

  if (error) throw error;
};

export const updateEntryById = async (id, updates, userId) => {
  console.log("Filtering by owner_id:", userId);
  const { data, error } = await supabase
    .from('entries')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', userId)
    .select();
  
  console.log("Update result:", data);
  console.log("error:", error);

  if (error) throw error;
  return data;
};