import { supabase } from '../lib/supabase';

// Authentication services
export const authService = {
  // Sign up new user (public self-registration)
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: metadata.username,
          full_name: metadata.fullName || metadata.username,
          role: metadata.role || 'encoder',
        }
      }
    });

    if (error) throw error;
    return data;
  },

  // Sign in user
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  async requestPasswordReset(email, redirectTo) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;
    return data;
  },

  async exchangeRecoveryCode(code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;
    return data;
  },

  async setRecoverySession(accessToken, refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  },

  // Sign out user
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get user profile
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update user profile
  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// User management services (admin only)
export const usersService = {
  // Get all users
  async getAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create user (admin only)
  // NOTE: supabase.auth.admin.* requires the service_role key and must NEVER be called
  // from the browser. As a temporary workaround we use public signUp() and then restore
  // the admin's session so the admin doesn't get logged out.
  async create(userData) {
    // Save the current admin session so we can restore it after signUp
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    // Create the new auth user via public signUp (trigger handle_new_user creates the profile)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          username: userData.username,
          full_name: userData.fullName,
          role: userData.role
        }
      }
    });

    if (authError) throw authError;

    // Restore the admin's session (signUp auto-logs-in as the new user)
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
    }

        // Ensure the return object matches exactly what our UI expects
    // (camelCase and proper status)
    return {
      id: authData.user.id,
      username: userData.username,
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role,
      status: 'active'
    };
  },

  // Update user
  async update(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete user (admin only)
  async delete(userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
};

// Entry management services
// Entry management services
export const entriesService = {
  // Helper function to transform snake_case to camelCase
  transformEntry(entry) {
    if (!entry) return entry;
    
    // Get unit name from joined data or fallback
    const unitName = entry.units?.name || entry.unit || entry.unit_id || '';
    
    // Calculate grand total from unit_cost if grand_total doesn't exist
    const grandTotal = entry.grand_total || Number(entry.unit_cost || 0);
    
    return {
      id: entry.id,
      owner_id: entry.owner_id,
      planningYear: entry.planning_year || String(new Date().getFullYear()),
      unit: unitName,
      component: entry.component || entry.component_id || '',
      subComponent: entry.sub_component || entry.sub_component_id || '',
      keyActivity: entry.key_activity || entry.key_activity_id || '',
      titleOfActivities: entry.title_of_activities,
      unitCost: entry.unit_cost,
      status: entry.status || entry.entry_status || 'Pending Review',
      submittedAt: entry.submitted_at || entry.submission_date,
      monthlyBreakdown: entry.monthly_breakdown || [],
      adminComment: entry.admin_comment || entry.reviewer_notes || '',
      grandTotal: grandTotal,
      // Keep original fields just in case
      ...entry
    };
  },

  // Helper to map UI-style updates -> the snake_case columns used by Supabase.
  // This also prevents "column not found" errors by only including valid fields.
  mapUpdatesToEntry(updates) {
    const payload = {};
    if (updates.planningYear !== undefined || updates.planning_year !== undefined) payload.planning_year = updates.planningYear || updates.planning_year;
    if (updates.titleOfActivities !== undefined || updates.title_of_activities !== undefined) payload.title_of_activities = updates.titleOfActivities || updates.title_of_activities;
    if (updates.unitCost !== undefined || updates.unit_cost !== undefined) payload.unit_cost = updates.unitCost || updates.unit_cost;
    if (updates.status !== undefined || updates.status !== undefined) payload.status = updates.status;
    if (updates.submittedAt !== undefined || updates.submission_date !== undefined) payload.submission_date = updates.submittedAt || updates.submission_date;
    if (updates.adminComment !== undefined || updates.admin_comment !== undefined) payload.admin_comment = updates.adminComment || updates.admin_comment;
    
    // Map foreign key IDs if present
    if (updates.unitId !== undefined || updates.unit_id !== undefined) payload.unit_id = updates.unitId || updates.unit_id;
    if (updates.componentId !== undefined || updates.component_id !== undefined) payload.component_id = updates.componentId || updates.component_id;
    if (updates.subComponentId !== undefined || updates.sub_component_id !== undefined) payload.sub_component_id = updates.subComponentId || updates.sub_component_id;
    if (updates.keyActivityId !== undefined || updates.key_activity_id !== undefined) payload.key_activity_id = updates.keyActivityId || updates.key_activity_id;
    if (updates.subActivityId !== undefined || updates.sub_activity_id !== undefined) payload.sub_activity_id = updates.subActivityId || updates.sub_activity_id;

    return payload;
  },

  // Get entries for current user or all entries for admin
  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    
    let query = supabase
      .from('entries')
      .select('*, units(name)')
      .order('submission_date', { ascending: false });

    const profile = await authService.getProfile(user.id);
    if (profile.role !== 'admin') {
      query = query.eq('owner_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(entry => this.transformEntry(entry));
  },

  // Get single entry
  async getById(id) {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return this.transformEntry(data);
  },

  // Create entry
  async create(entryData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Map frontend keys to DB columns
    const payload = this.mapUpdatesToEntry(entryData);

    const { data, error } = await supabase
      .from('entries')
      .insert({
        ...payload,
        owner_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return await this.getById(data.id);
  },

  // Update entry
  async update(id, updates) {
    // Map frontend keys to DB columns
    const payload = this.mapUpdatesToEntry(updates);

    const { data, error } = await supabase
      .from('entries')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return await this.getById(data.id);
  },

  // Delete entry
  async delete(id) {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Update monthly targets
  async updateMonthlyTargets(entryId, targets) {
    const updates = Object.entries(targets).map(([month, quantity]) => 
      supabase
        .from('monthly_targets')
        .upsert({ 
          entry_id: entryId, 
          month, 
          target_quantity: quantity 
        })
    );

    await Promise.all(updates);
    
    return await this.getById(entryId);
  }
};

// Template services
export const templateService = {
  // Get full template hierarchy
  async getHierarchy() {
    const { data, error } = await supabase
      .from('template_hierarchy')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  // Get units
  async getUnits() {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('code');
    
    if (error) throw error;
    return data;
  },

  // Get components
  async getComponents() {
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get sub-components by component
  async getSubComponents(componentId) {
    const { data, error } = await supabase
      .from('sub_components')
      .select('*')
      .eq('component_id', componentId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get key activities by sub-component
  async getKeyActivities(subComponentId) {
    const { data, error } = await supabase
      .from('key_activities')
      .select('*')
      .eq('sub_component_id', subComponentId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get sub-activities by key activity
  async getSubActivities(keyActivityId) {
    const { data, error } = await supabase
      .from('sub_activities')
      .select('*')
      .eq('key_activity_id', keyActivityId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  }
};

// Template management services (admin only)
export const templateManagementService = {
  // Component management
  async createComponent(componentData) {
    const { data, error } = await supabase
      .from('components')
      .insert(componentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateComponent(id, updates) {
    const { data, error } = await supabase
      .from('components')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteComponent(id) {
    const { error } = await supabase
      .from('components')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Similar methods for sub-components, key activities, and sub-activities...
  async createSubComponent(subComponentData) {
    const { data, error } = await supabase
      .from('sub_components')
      .insert(subComponentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createKeyActivity(keyActivityData) {
    const { data, error } = await supabase
      .from('key_activities')
      .insert(keyActivityData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createSubActivity(subActivityData) {
    const { data, error } = await supabase
      .from('sub_activities')
      .insert(subActivityData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Submission window services
export const submissionService = {
  // Get active submission window
  async getActiveWindow() {
    const { data, error } = await supabase
      .from('submission_windows')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateWindow(id, updates) {
  const { data, error } = await supabase
    .from('submission_windows')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
};

// Real-time subscriptions
export const realtimeService = {
  // Subscribe to entries changes
  subscribeToEntries(callback) {
    return supabase
      .channel('entries_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'entries' },
        callback
      )
      .subscribe();
  },

  // Subscribe to user profile changes
  subscribeToProfiles(callback) {
    return supabase
      .channel('profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        callback
      )
      .subscribe();
  }
};
