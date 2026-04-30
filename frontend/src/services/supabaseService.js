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
  transformEntry(row) {
    if (!row) return row;
    return {
      id: row.id,
      ownerId: row.owner_id,
      ownerUsername: row.owner_username,
      ownerFullName: row.owner_full_name,
      planningYear: row.planning_year,
      unit: row.unit,
      component: row.component,
      subComponent: row.sub_component,
      keyActivity: row.key_activity,
      no: row.no,
      performanceIndicator: row.performance_indicator || '',
      subActivity: row.sub_activity || '',
      titleOfActivities: row.title_of_activities,
      unitCost: Number(row.unit_cost) || 0,
      monthlyBreakdown: row.monthly_breakdown || [],
      grandTotal: Number(row.grand_total) || 0,
      status: row.status,
      adminComment: row.reviewer_notes || '',
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    
    let query = supabase
      .from('admin_entry_view')
      .select('*')
      .order('submitted_at', { ascending: false });

    const profile = await authService.getProfile(user.id);
    if (profile.role !== 'admin') {
      query = query.eq('owner_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error getting entries:', error);
      throw error;
    }
    
    return (data || []).map(row => this.transformEntry(row));
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('admin_entry_view')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return this.transformEntry(data);
  },

  async create(entryData) {
    const { data: { user } } = await supabase.auth.getUser();
    const profile = await authService.getProfile(user.id);
    
    console.log("=== CREATING ENTRY ===");
    console.log("Entry data received:", entryData);
    
    // Step 1: Get or find unit ID
    let unitId = null;
    const unitName = entryData.unit;
    
    if (!unitName) {
      throw new Error('Unit is required');
    }
    
    // Try to find unit by exact name match
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('id, name, code')
      .eq('name', unitName)
      .maybeSingle();
    
    if (unitData) {
      unitId = unitData.id;
      console.log("Found unit by name:", unitData.name, unitId);
    } else {
      // Try to find by code
      const { data: unitByCode } = await supabase
        .from('units')
        .select('id, name, code')
        .eq('code', unitName)
        .maybeSingle();
      
      if (unitByCode) {
        unitId = unitByCode.id;
        console.log("Found unit by code:", unitByCode.name, unitId);
      } else {
        // Try partial match
        const { data: allUnits } = await supabase
          .from('units')
          .select('id, name, code');
        
        const partialMatch = allUnits?.find(u => 
          unitName.toLowerCase().includes(u.name.toLowerCase()) ||
          u.name.toLowerCase().includes(unitName.toLowerCase()) ||
          unitName.toLowerCase().includes(u.code.toLowerCase())
        );
        
        if (partialMatch) {
          unitId = partialMatch.id;
          console.log("Found unit by partial match:", partialMatch.name, unitId);
        } else {
          console.error("Unit not found:", unitName);
          throw new Error(`Unit not found: "${unitName}". Please select a valid unit.`);
        }
      }
    }
    
    // Step 2: Get component ID
    let componentId = null;
    const { data: componentData } = await supabase
      .from('components')
      .select('id')
      .eq('name', entryData.component)
      .maybeSingle();
    
    if (componentData) {
      componentId = componentData.id;
      console.log("Found component:", componentData.name, componentId);
    } else {
      // Try partial match for component
      const { data: allComponents } = await supabase
        .from('components')
        .select('id, name');
      
      const partialMatch = allComponents?.find(c => 
        entryData.component.toLowerCase().includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(entryData.component.toLowerCase())
      );
      
      if (partialMatch) {
        componentId = partialMatch.id;
        console.log("Found component by partial match:", partialMatch.name);
      } else {
        throw new Error(`Component not found: ${entryData.component}`);
      }
    }
    
    // Step 3: Get sub-component ID
    let subComponentId = null;
    const { data: subComponentData } = await supabase
      .from('sub_components')
      .select('id')
      .eq('name', entryData.subComponent)
      .maybeSingle();
    
    if (subComponentData) {
      subComponentId = subComponentData.id;
      console.log("Found sub-component:", subComponentData.name, subComponentId);
    } else {
      // Try partial match for sub-component
      const { data: allSubComponents } = await supabase
        .from('sub_components')
        .select('id, name');
      
      const partialMatch = allSubComponents?.find(sc => 
        entryData.subComponent.toLowerCase().includes(sc.name.toLowerCase()) ||
        sc.name.toLowerCase().includes(entryData.subComponent.toLowerCase())
      );
      
      if (partialMatch) {
        subComponentId = partialMatch.id;
        console.log("Found sub-component by partial match:", partialMatch.name);
      } else {
        throw new Error(`Sub-component not found: ${entryData.subComponent}`);
      }
    }
    
    // Step 4: Get key activity ID
    let keyActivityId = null;
    const { data: keyActivityData } = await supabase
      .from('key_activities')
      .select('id')
      .eq('name', entryData.keyActivity)
      .maybeSingle();
    
    if (keyActivityData) {
      keyActivityId = keyActivityData.id;
      console.log("Found key activity:", keyActivityData.name, keyActivityId);
    } else {
      // Try partial match for key activity
      const { data: allKeyActivities } = await supabase
        .from('key_activities')
        .select('id, name');
      
      const partialMatch = allKeyActivities?.find(ka => 
        entryData.keyActivity.toLowerCase().includes(ka.name.toLowerCase()) ||
        ka.name.toLowerCase().includes(entryData.keyActivity.toLowerCase())
      );
      
      if (partialMatch) {
        keyActivityId = partialMatch.id;
        console.log("Found key activity by partial match:", partialMatch.name);
      } else {
        throw new Error(`Key activity not found: ${entryData.keyActivity}`);
      }
    }
    
    // Step 5: Get sub-activity ID if provided
    let subActivityId = null;
    if (entryData.subActivity && entryData.subActivity !== '' && entryData.subActivity !== 'N/A' && entryData.subActivity !== 'Select sub activity') {
      console.log("Looking for sub-activity:", entryData.subActivity);
      
      const { data: subActivityData } = await supabase
        .from('sub_activities')
        .select('id')
        .eq('name', entryData.subActivity)
        .maybeSingle();
      
      if (subActivityData) {
        subActivityId = subActivityData.id;
        console.log("Found sub-activity:", entryData.subActivity, "ID:", subActivityId);
      }
    }
    
    // Step 6: Insert the entry
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
    
    // Add sub_activity_id if found
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
    
    // Step 7: Insert monthly targets
    if (entryData.monthlyBreakdown && entryData.monthlyBreakdown.length > 0) {
      console.log("Inserting monthly targets:", entryData.monthlyBreakdown);
      
      // Delete any existing monthly targets for this entry (in case of resubmission)
      const { error: deleteError } = await supabase
        .from('monthly_targets')
        .delete()
        .eq('entry_id', data.id);
      
      if (deleteError) {
        console.error("Error deleting existing monthly targets:", deleteError);
      }
      
      // Insert new monthly targets
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
          } else {
            console.log(`Successfully inserted ${monthName}: ${month.target}`);
          }
        }
      }
    } else {
      console.warn("No monthly breakdown found in entryData!");
    }
    
    // Return the created entry with all joined data
    return await this.getById(data.id);
  },

  async update(id, updates) {
    const dbUpdates = {};
    
    // Map frontend field names to actual database column names
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.review_date !== undefined) dbUpdates.review_date = updates.review_date;
    if (updates.titleOfActivities !== undefined) dbUpdates.title_of_activities = updates.titleOfActivities;
    if (updates.unitCost !== undefined) dbUpdates.unit_cost = updates.unitCost;
    
    // Map adminComment (from frontend) to reviewer_notes (database column)
    if (updates.adminComment !== undefined) dbUpdates.reviewer_notes = updates.adminComment;
    if (updates.reviewer_notes !== undefined) dbUpdates.reviewer_notes = updates.reviewer_notes;
    
    // Update entries table if there are changes
    if (Object.keys(dbUpdates).length > 0) {
      const { data, error } = await supabase
        .from('entries')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
    }
    
    // Update monthly targets if provided
    if (updates.monthlyBreakdown && updates.monthlyBreakdown.length > 0) {
      console.log("Updating monthly targets for entry:", id);
      
      // Delete existing targets first
      const { error: deleteError } = await supabase
        .from('monthly_targets')
        .delete()
        .eq('entry_id', id);
      
      if (deleteError) {
        console.error("Error deleting existing monthly targets:", deleteError);
      }
      
      // Insert new targets
      for (const month of updates.monthlyBreakdown) {
        if (month.target > 0) {
          const monthName = month.month.toLowerCase().slice(0, 3);
          console.log(`Inserting ${monthName}: ${month.target}`);
          
          const { error: mtError } = await supabase
            .from('monthly_targets')
            .insert({
              entry_id: id,
              month: monthName,
              target_quantity: month.target,
            });
          
          if (mtError) {
            console.error(`Error inserting monthly target for ${monthName}:`, mtError);
          }
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
    const { data, error } = await supabase.from('template_hierarchy').select('*');
    if (error) throw error;
    return data;
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

  async createSubActivity(data) {
    const { data: result, error } = await supabase
      .from('sub_activities')
      .insert({
        key_activity_id: data.key_activity_id,
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
            const { data } = await supabase
              .from('admin_entry_view')
              .select('*')
              .eq('id', payload.new.id)
              .single();
            callback({ ...payload, new: data });
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