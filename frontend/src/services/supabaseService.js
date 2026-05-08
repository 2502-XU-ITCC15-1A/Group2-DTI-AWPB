import { supabase } from '../lib/supabase';

// Authentication services
export const authService = {
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

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

  async setSessionFromTokens(accessToken, refreshToken) {
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

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

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

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// User management services (admin only)
export const usersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(userData) {
    const { data: { session: adminSession } } = await supabase.auth.getSession();
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
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
    }
    return authData;
  },

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

  async delete(userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
};

// Entry management services
export const entriesService = {
  getMonthName(monthCode) {
    const months = {
      'jan': 'January',
      'feb': 'February',
      'mar': 'March',
      'apr': 'April',
      'may': 'May',
      'jun': 'June',
      'jul': 'July',
      'aug': 'August',
      'sep': 'September',
      'oct': 'October',
      'nov': 'November',
      'dec': 'December'
    };
    return months[monthCode?.toLowerCase()] || monthCode;
  },

  transformEntryWithJoins(row, monthlyBreakdown = []) {
    if (!row) return row;
    
    // Calculate grand total from monthly breakdown
    const grandTotal = monthlyBreakdown.reduce((sum, m) => sum + (m.amount || 0), 0);
    
    return {
      id: row.id,
      ownerId: row.owner_id,
      ownerUsername: row.profiles?.username || '',
      ownerFullName: row.profiles?.full_name || '',
      planningYear: row.planning_year,
      unit: row.units?.name || '',
      component: row.components?.name || '',
      subComponent: row.sub_components?.name || '',
      keyActivity: row.key_activities?.name || '',
      no: row.key_activities?.activity_no || '',
      performanceIndicator: row.key_activities?.performance_indicator || '',
      subActivity: row.sub_activities?.name || '',
      titleOfActivities: row.title_of_activities,
      unitCost: Number(row.unit_cost) || 0,
      monthlyBreakdown: monthlyBreakdown,
      grandTotal: grandTotal,
      status: row.status,
      adminComment: row.reviewer_notes || '',
      submittedAt: row.submission_date,
      reviewedAt: row.review_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    
    let query = supabase
      .from('entries')
      .select(`
        *,
        profiles!owner_id (username, full_name),
        units (name),
        components (name),
        sub_components (name),
        key_activities (name, activity_no, performance_indicator),
        sub_activities (name)
      `)
      .order('created_at', { ascending: false });

    const profile = await authService.getProfile(user.id);
    if (profile.role !== 'admin') {
      query = query.eq('owner_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error getting entries:', error);
      throw error;
    }
    
    // For each entry, fetch its monthly targets
    const entriesWithBreakdown = await Promise.all(
      (data || []).map(async (row) => {
        // Fetch monthly targets for this entry
        const { data: monthlyTargets } = await supabase
          .from('monthly_targets')
          .select('month, target_quantity')
          .eq('entry_id', row.id);
        
        // Build monthly breakdown
        const monthlyBreakdown = (monthlyTargets || [])
          .filter(mt => mt.target_quantity > 0)
          .map(mt => ({
            month: this.getMonthName(mt.month),
            target: mt.target_quantity,
            amount: mt.target_quantity * (row.unit_cost || 0)
          }));
        
        return this.transformEntryWithJoins(row, monthlyBreakdown);
      })
    );
    
    return entriesWithBreakdown;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        profiles!owner_id (username, full_name),
        units (name),
        components (name),
        sub_components (name),
        key_activities (name, activity_no, performance_indicator),
        sub_activities (name)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    
    // Fetch monthly targets for this entry
    const { data: monthlyTargets } = await supabase
      .from('monthly_targets')
      .select('month, target_quantity')
      .eq('entry_id', id);
    
    const monthlyBreakdown = (monthlyTargets || [])
      .filter(mt => mt.target_quantity > 0)
      .map(mt => ({
        month: this.getMonthName(mt.month),
        target: mt.target_quantity,
        amount: mt.target_quantity * (data.unit_cost || 0)
      }));
    
    return this.transformEntryWithJoins(data, monthlyBreakdown);
  },

  async create(entryData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    console.log("=== CREATING ENTRY ===");
    console.log("Entry data received:", entryData);
    
    // Helper function to find ID by name
    const findUnitId = async (name) => {
      const { data } = await supabase
        .from('units')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    const findComponentId = async (name) => {
      const { data } = await supabase
        .from('components')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    const findSubComponentId = async (name) => {
      const { data } = await supabase
        .from('sub_components')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    const findKeyActivityId = async (name) => {
      const { data } = await supabase
        .from('key_activities')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    const findSubActivityId = async (name) => {
      if (!name || name === 'N/A' || name === 'Select sub activity' || name === '') return null;
      const { data } = await supabase
        .from('sub_activities')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    // Get all IDs
    const unitId = await findUnitId(entryData.unit);
    const componentId = await findComponentId(entryData.component);
    const subComponentId = await findSubComponentId(entryData.subComponent);
    const keyActivityId = await findKeyActivityId(entryData.keyActivity);
    const subActivityId = await findSubActivityId(entryData.subActivity);
    
    if (!unitId) throw new Error(`Unit not found: ${entryData.unit}`);
    if (!componentId) throw new Error(`Component not found: ${entryData.component}`);
    if (!subComponentId) throw new Error(`Sub-component not found: ${entryData.subComponent}`);
    if (!keyActivityId) throw new Error(`Key activity not found: ${entryData.keyActivity}`);
    
    // Insert entry
    const insertData = {
      owner_id: user.id,
      unit_id: unitId,
      planning_year: parseInt(entryData.planningYear),
      component_id: componentId,
      sub_component_id: subComponentId,
      key_activity_id: keyActivityId,
      title_of_activities: entryData.titleOfActivities,
      unit_cost: entryData.unitCost || 0,
      status: 'Pending Review',
      submission_date: new Date().toISOString(),
    };
    
    if (subActivityId) {
      insertData.sub_activity_id = subActivityId;
    }
    
    console.log("Insert data:", insertData);
    
    const { data, error } = await supabase
      .from('entries')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Error inserting entry:', error);
      throw new Error(`Failed to create entry: ${error.message}`);
    }
    
    console.log("Entry created with ID:", data.id);
    
    // Insert monthly targets
    if (entryData.monthlyBreakdown && entryData.monthlyBreakdown.length > 0) {
      console.log("Inserting monthly targets:", entryData.monthlyBreakdown);
      
      for (const month of entryData.monthlyBreakdown) {
        if (month.target && month.target > 0) {
          const monthName = month.month.toLowerCase().slice(0, 3);
          console.log(`Inserting ${monthName}: ${month.target}`);
          
          const { error: mtError } = await supabase
            .from('monthly_targets')
            .insert({
              entry_id: data.id,
              month: monthName,
              target_quantity: month.target,
            });
          
          if (mtError) {
            console.error(`Error inserting monthly target for ${monthName}:`, mtError);
          }
        }
      }
    }
    
    return await this.getById(data.id);
  },

  async update(id, updates) {
    const dbUpdates = {};
    
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.review_date !== undefined) dbUpdates.review_date = updates.review_date;
    if (updates.titleOfActivities !== undefined) dbUpdates.title_of_activities = updates.titleOfActivities;
    if (updates.unitCost !== undefined) dbUpdates.unit_cost = updates.unitCost;
    if (updates.adminComment !== undefined) dbUpdates.reviewer_notes = updates.adminComment;
    
    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase
        .from('entries')
        .update(dbUpdates)
        .eq('id', id);
        
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
    }
    
    // Update monthly targets if provided
    if (updates.monthlyBreakdown && updates.monthlyBreakdown.length > 0) {
      // Delete existing targets
      await supabase.from('monthly_targets').delete().eq('entry_id', id);
      
      // Insert new targets
      for (const month of updates.monthlyBreakdown) {
        if (month.target > 0) {
          const monthName = month.month.toLowerCase().slice(0, 3);
          await supabase
            .from('monthly_targets')
            .insert({
              entry_id: id,
              month: monthName,
              target_quantity: month.target,
            });
        }
      }
    }
    
    return await this.getById(id);
  },

  async delete(id) {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Template services (read-only)
export const templateService = {
  async getHierarchy() {
    // Query individual tables instead of the view, because the view
    // does not join the separate performance_indicators table.
    const [compRes, scRes, kaRes, piRes, saRes] = await Promise.all([
      supabase.from('components').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('sub_components').select('id, name, component_id').eq('is_active', true).order('sort_order'),
      supabase.from('key_activities').select('id, name, sub_component_id').eq('is_active', true).order('sort_order'),
      supabase.from('performance_indicators').select('id, key_activity_id, activity_no, label, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('sub_activities').select('id, name, performance_indicator_id').eq('is_active', true).order('sort_order'),
    ]);

    if (compRes.error) throw compRes.error;
    if (scRes.error) throw scRes.error;
    if (kaRes.error) throw kaRes.error;
    if (piRes.error) throw piRes.error;
    if (saRes.error) throw saRes.error;

    // Build lookup maps
    const compMap = Object.fromEntries(compRes.data.map((c) => [c.id, c]));
    const scMap = Object.fromEntries(scRes.data.map((sc) => [sc.id, sc]));
    const kaMap = Object.fromEntries(kaRes.data.map((ka) => [ka.id, ka]));

    // Group performance_indicators by key_activity_id
    const piByKa = {};
    for (const pi of piRes.data) {
      if (!piByKa[pi.key_activity_id]) piByKa[pi.key_activity_id] = [];
      piByKa[pi.key_activity_id].push(pi);
    }

    // Group sub_activities by performance_indicator_id
    const saByPi = {};
    for (const sa of saRes.data) {
      if (!saByPi[sa.performance_indicator_id]) saByPi[sa.performance_indicator_id] = [];
      saByPi[sa.performance_indicator_id].push(sa);
    }

    // Build flat rows that match the structure the frontend expects
    const rows = [];

    for (const ka of kaRes.data) {
      const sc = scMap[ka.sub_component_id];
      if (!sc) continue;
      const comp = compMap[sc.component_id];
      if (!comp) continue;

      const pis = piByKa[ka.id] || [];
      if (pis.length === 0) {
        // Key activity with no performance indicators yet — emit placeholder row
        rows.push({
          component: comp.name, component_id: comp.id,
          sub_component: sc.name, sub_component_id: sc.id,
          key_activity: ka.name, key_activity_id: ka.id,
          activity_no: null, label: null,
          sub_activity: null, sub_activity_id: null,
        });
      } else {
        for (const pi of pis) {
          const subs = saByPi[pi.id] || [];
          if (subs.length === 0) {
            rows.push({
              component: comp.name, component_id: comp.id,
              sub_component: sc.name, sub_component_id: sc.id,
              key_activity: ka.name, key_activity_id: ka.id,
              activity_no: pi.activity_no, label: pi.label,
              sub_activity: null, sub_activity_id: null,
            });
          } else {
            for (const sa of subs) {
              rows.push({
                component: comp.name, component_id: comp.id,
                sub_component: sc.name, sub_component_id: sc.id,
                key_activity: ka.name, key_activity_id: ka.id,
                activity_no: pi.activity_no, label: pi.label,
                sub_activity: sa.name, sub_activity_id: sa.id,
              });
            }
          }
        }
      }
    }

    return rows;
  },

  async getUnits() {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('code');
    if (error) throw error;
    return data;
  },

  async getComponents() {
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  },

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
export const templateMgmtService = {
  async createComponent(data) {
    const { data: result, error } = await supabase
      .from('components')
      .insert({
        name: data.name,
        code: data.code,
        sort_order: data.sort_order,
        is_active: data.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateComponent(id, updates) {
    const { data: result, error } = await supabase
      .from('components')
      .update({
        name: updates.name,
        code: updates.code,
        sort_order: updates.sort_order,
        is_active: updates.is_active
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async deleteComponent(id) {
    const { error } = await supabase.from('components').delete().eq('id', id);
    if (error) throw error;
  },

  async createSubComponent(data) {
    const { data: result, error } = await supabase
      .from('sub_components')
      .insert({
        component_id: data.component_id,
        name: data.name,
        code: data.code,
        sort_order: data.sort_order,
        is_active: data.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateSubComponent(id, updates) {
    const { data: result, error } = await supabase
      .from('sub_components')
      .update({
        name: updates.name,
        code: updates.code,
        sort_order: updates.sort_order,
        is_active: updates.is_active
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async deleteSubComponent(id) {
    const { error } = await supabase.from('sub_components').delete().eq('id', id);
    if (error) throw error;
  },

  async createKeyActivity(data) {
    const { data: result, error } = await supabase
      .from('key_activities')
      .insert({
        sub_component_id: data.sub_component_id,
        name: data.name,
        code: data.code,
        activity_no: data.activity_no,
        performance_indicator: data.performance_indicator || '',
        sort_order: data.sort_order,
        is_active: data.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateKeyActivity(id, updates) {
    const { data: result, error } = await supabase
      .from('key_activities')
      .update({
        name: updates.name,
        code: updates.code,
        activity_no: updates.activity_no,
        performance_indicator: updates.performance_indicator,
        sort_order: updates.sort_order,
        is_active: updates.is_active
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async deleteKeyActivity(id) {
    const { error } = await supabase.from('key_activities').delete().eq('id', id);
    if (error) throw error;
  },

  async createPerformanceIndicator(data) {
    const { data: result, error } = await supabase
      .from('performance_indicators')
      .insert({
        key_activity_id: data.key_activity_id,
        activity_no: data.activity_no,
        label: data.label,
        sort_order: data.sort_order,
        is_active: data.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updatePerformanceIndicator(id, updates) {
    const { data: result, error } = await supabase
      .from('performance_indicators')
      .update({
        activity_no: updates.activity_no,
        label: updates.label,
        sort_order: updates.sort_order,
        is_active: updates.is_active
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async deletePerformanceIndicator(id) {
    const { error } = await supabase.from('performance_indicators').delete().eq('id', id);
    if (error) throw error;
  },

  async createSubActivity(data) {
    const { data: result, error } = await supabase
      .from('sub_activities')
      .insert({
        performance_indicator_id: data.performance_indicator_id,
        name: data.name,
        code: data.code,
        sort_order: data.sort_order,
        is_active: data.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateSubActivity(id, updates) {
    const { data: result, error } = await supabase
      .from('sub_activities')
      .update({
        name: updates.name,
        code: updates.code,
        sort_order: updates.sort_order,
        is_active: updates.is_active
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async deleteSubActivity(id) {
    const { error } = await supabase.from('sub_activities').delete().eq('id', id);
    if (error) throw error;
  }
};

// Submission window services
export const submissionService = {
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
  subscribeToEntries(callback) {
    return supabase
      .channel('entries_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'entries' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const entry = await entriesService.getById(payload.new.id);
            callback({ ...payload, new: entry });
          } else {
            callback(payload);
          }
        }
      )
      .subscribe();
  },

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