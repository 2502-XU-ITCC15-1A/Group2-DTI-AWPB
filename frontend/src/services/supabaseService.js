import { supabase } from '../lib/supabase';
import { getUnitLookupValues, normalizeUnitCode } from '../lib/units';

const ENTRY_SELECT_WITH_REVIEWER = `
        *,
        profiles!owner_id (username, full_name),
        reviewer:profiles!reviewer_id (username, full_name),
        units (name, code),
        components (name),
        sub_components (name),
        key_activities (name, activity_no, performance_indicator),
        sub_activities (name)
      `;

const ENTRY_SELECT = `
        *,
        profiles!owner_id (username, full_name),
        units (name, code),
        components (name),
        sub_components (name),
        key_activities (name, activity_no, performance_indicator),
        sub_activities (name)
      `;

function formatPersonName(profile) {
  if (!profile) return '';
  return profile.full_name || profile.username || '';
}

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
      ownerDisplayName: formatPersonName(row.profiles),
      reviewerId: row.reviewer_id || '',
      reviewerUsername: row.reviewer?.username || '',
      reviewerFullName: row.reviewer?.full_name || '',
      reviewerDisplayName: formatPersonName(row.reviewer),
      planningYear: row.planning_year,
      unit: normalizeUnitCode(row.units?.code || row.units?.name || ''),
      component: row.components?.name || '',
      subComponent: row.sub_components?.name || '',
      keyActivity: row.key_activities?.name || '',
      // Prefer entry-level values saved from Submit Entry. The template now
      // stores No./PI in performance_indicators, so key_activities may be blank.
      no: row.no || row.activity_no || row.key_activities?.activity_no || '',
      performanceIndicator:
        row.performance_indicator ||
        row.performanceIndicator ||
        row.key_activities?.performance_indicator ||
        '',
      subActivity: row.sub_activities?.name || '',
      titleOfActivities: row.title_of_activities,
      unitCost: Number(row.unit_cost) || 0,
      monthlyBreakdown: monthlyBreakdown,
      grandTotal: grandTotal,
      status: row.status,
      adminComment: row.admin_comment || row.reviewer_notes || '',
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
      .select(ENTRY_SELECT_WITH_REVIEWER)
      .order('created_at', { ascending: false });

    const profile = await authService.getProfile(user.id);
    if (profile.role !== 'admin') {
      query = query.eq('owner_id', user.id);
    }

    let { data, error } = await query;
    if (error?.message?.includes('reviewer_id') || error?.message?.includes('relationship')) {
      let fallbackQuery = supabase
        .from('entries')
        .select(ENTRY_SELECT)
        .order('created_at', { ascending: false });
      if (profile.role !== 'admin') {
        fallbackQuery = fallbackQuery.eq('owner_id', user.id);
      }
      const fallback = await fallbackQuery;
      data = fallback.data;
      error = fallback.error;
    }
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
    let { data, error } = await supabase
      .from('entries')
      .select(ENTRY_SELECT_WITH_REVIEWER)
      .eq('id', id)
      .single();
    if (error?.message?.includes('reviewer_id') || error?.message?.includes('relationship')) {
      const fallback = await supabase
        .from('entries')
        .select(ENTRY_SELECT)
        .eq('id', id)
        .single();
      data = fallback.data;
      error = fallback.error;
    }
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
    
    const findUnitId = async (identifier) => {
      const lookupValues = getUnitLookupValues(identifier);
      const { data, error } = await supabase
        .from('units')
        .select('id')
        .or(lookupValues.flatMap((value) => [`code.eq.${value}`, `name.eq.${value}`]).join(','))
        .maybeSingle();
      if (error) console.error('Unit lookup error:', error);
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
      if (!name) return null;
      const { data } = await supabase
        .from('sub_components')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      return data?.id;
    };
    
    const findKeyActivityId = async (name) => {
      if (!name) return null;
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
    if (entryData.subComponent !== 'N/A' && !subComponentId) throw new Error(`Sub-component not found: ${entryData.subComponent}`);
    if (entryData.keyActivity !== 'N/A' && !keyActivityId) throw new Error(`Key activity not found: ${entryData.keyActivity}`);
    
    // Insert entry
    const insertData = {
      owner_id: user.id,
      unit_id: unitId,
      planning_year: parseInt(entryData.planningYear),
      component_id: componentId,
      title_of_activities: entryData.titleOfActivities,
      unit_cost: entryData.unitCost || 0,
      status: 'Pending Review',
      submission_date: new Date().toISOString(),
    };

    if (subComponentId) {
      insertData.sub_component_id = subComponentId;
    }

    if (keyActivityId) {
      insertData.key_activity_id = keyActivityId;
    }

    if (subActivityId) {
      insertData.sub_activity_id = subActivityId;
    }

    const insertDataWithClassification = {
      ...insertData,
      no: entryData.no || '',
      performance_indicator: entryData.performanceIndicator || '',
    };

    console.log("Insert data:", insertDataWithClassification);

    let insertResponse = await supabase
      .from('entries')
      .insert(insertDataWithClassification)
      .select()
      .single();

    if (
      insertResponse.error?.code === 'PGRST204' ||
      insertResponse.error?.message?.includes("'no'") ||
      insertResponse.error?.message?.includes('performance_indicator')
    ) {
      console.warn(
        'entries table does not expose no/performance_indicator columns; falling back to FK-only insert.',
        insertResponse.error,
      );
      insertResponse = await supabase
        .from('entries')
        .insert(insertData)
        .select()
        .single();
    }

    const { data, error } = insertResponse;
    
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
    
    const createdEntry = await this.getById(data.id);
    return {
      ...createdEntry,
      // If the database schema cannot store these columns yet, preserve the
      // submitted values for the immediate UI state after create.
      no: createdEntry.no || entryData.no || '',
      performanceIndicator:
        createdEntry.performanceIndicator || entryData.performanceIndicator || '',
    };
  },

  async update(id, updates) {
    const dbUpdates = {};
    
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.review_date !== undefined) dbUpdates.review_date = updates.review_date;
    if (updates.reviewedAt !== undefined) dbUpdates.review_date = updates.reviewedAt;
    if (updates.reviewerId !== undefined) dbUpdates.reviewer_id = updates.reviewerId;
    if (updates.reviewer_id !== undefined) dbUpdates.reviewer_id = updates.reviewer_id;
    if (updates.titleOfActivities !== undefined) dbUpdates.title_of_activities = updates.titleOfActivities;
    if (updates.unitCost !== undefined) dbUpdates.unit_cost = updates.unitCost;
    if (updates.adminComment !== undefined) dbUpdates.admin_comment = updates.adminComment;
    if (updates.reviewer_notes !== undefined) dbUpdates.admin_comment = updates.reviewer_notes;
    if (updates.admin_comment !== undefined) dbUpdates.admin_comment = updates.admin_comment;
    if (updates.no !== undefined) dbUpdates.no = updates.no;
    if (updates.performanceIndicator !== undefined) dbUpdates.performance_indicator = updates.performanceIndicator;
    
    if (Object.keys(dbUpdates).length > 0) {
      let response = await supabase
        .from('entries')
        .update(dbUpdates)
        .eq('id', id);

      if (
        response.error?.code === 'PGRST204' ||
        response.error?.message?.includes("'no'") ||
        response.error?.message?.includes('performance_indicator') ||
        response.error?.message?.includes('admin_comment') ||
        response.error?.message?.includes('reviewer_id')
      ) {
        const shouldUseReviewerNotes =
          response.error?.message?.includes('admin_comment');
        const fallbackUpdates = { ...dbUpdates };
        delete fallbackUpdates.no;
        delete fallbackUpdates.performance_indicator;
        delete fallbackUpdates.reviewer_id;
        if (shouldUseReviewerNotes && fallbackUpdates.admin_comment !== undefined) {
          fallbackUpdates.reviewer_notes = fallbackUpdates.admin_comment;
          delete fallbackUpdates.admin_comment;
        }
        response = await supabase
          .from('entries')
          .update(fallbackUpdates)
          .eq('id', id);
      }
        
      if (response.error) {
        console.error('Update error:', response.error);
        throw response.error;
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
    const [compRes, scRes, kaRes, piRes, initialSaRes] = await Promise.all([
      supabase.from('components').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('sub_components').select('id, name, component_id, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('key_activities').select('id, name, sub_component_id, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('performance_indicators').select('id, key_activity_id, activity_no, label, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('sub_activities').select('id, name, performance_indicator_id, key_activity_id, sort_order').eq('is_active', true).order('sort_order'),
    ]);
    let saRes = initialSaRes;
    if (initialSaRes.error?.message?.includes('performance_indicator_id')) {
      saRes = await supabase
        .from('sub_activities')
        .select('id, name, key_activity_id, sort_order')
        .eq('is_active', true)
        .order('sort_order');
    }

    if (compRes.error) throw compRes.error;
    if (scRes.error) throw scRes.error;
    if (kaRes.error) throw kaRes.error;
    if (piRes.error) throw piRes.error;
    if (saRes.error) throw saRes.error;

    // Build lookup maps
    const compMap = Object.fromEntries(compRes.data.map((c) => [c.id, c]));
    const scMap = Object.fromEntries(scRes.data.map((sc) => [sc.id, sc]));

    // Group performance_indicators by key_activity_id
    const piByKa = {};
    for (const pi of piRes.data) {
      if (!piByKa[pi.key_activity_id]) piByKa[pi.key_activity_id] = [];
      piByKa[pi.key_activity_id].push(pi);
    }

    // Group sub_activities by both possible FK columns. Older deployments use
    // key_activity_id; newer ones may use performance_indicator_id.
    const saByPi = {};
    const saByKa = {};
    for (const sa of saRes.data) {
      if (sa.performance_indicator_id) {
        if (!saByPi[sa.performance_indicator_id]) saByPi[sa.performance_indicator_id] = [];
        saByPi[sa.performance_indicator_id].push(sa);
      }
      if (sa.key_activity_id) {
        if (!saByKa[sa.key_activity_id]) saByKa[sa.key_activity_id] = [];
        saByKa[sa.key_activity_id].push(sa);
      }
    }

    // Build flat rows that match the structure the frontend expects
    const rows = [];

    for (const comp of compRes.data) {
      const subComponents = scRes.data.filter((sc) => sc.component_id === comp.id);
      if (subComponents.length > 0) continue;
      // Emit parent-only rows so Submit Entry can show N/A instead of losing
      // components that do not have child hierarchy rows yet.
      rows.push({
        component: comp.name, component_id: comp.id, component_sort_order: comp.sort_order,
        sub_component: null, sub_component_id: null, sub_component_sort_order: null,
        key_activity: null, key_activity_id: null, key_activity_sort_order: null,
        activity_no: null, label: null, performance_indicator_sort_order: null,
        sub_activity: null, sub_activity_id: null, sub_activity_sort_order: null,
      });
    }

    for (const sc of scRes.data) {
      const comp = compMap[sc.component_id];
      if (!comp) continue;
      const keyActivities = kaRes.data.filter((ka) => ka.sub_component_id === sc.id);
      if (keyActivities.length > 0) continue;
      // Preserve sub-components with no key activities so the next dropdown can
      // intentionally fall back to N/A instead of appearing broken.
      rows.push({
        component: comp.name, component_id: comp.id, component_sort_order: comp.sort_order,
        sub_component: sc.name, sub_component_id: sc.id, sub_component_sort_order: sc.sort_order,
        key_activity: null, key_activity_id: null, key_activity_sort_order: null,
        activity_no: null, label: null, performance_indicator_sort_order: null,
        sub_activity: null, sub_activity_id: null, sub_activity_sort_order: null,
      });
    }

    for (const ka of kaRes.data) {
      const sc = scMap[ka.sub_component_id];
      if (!sc) continue;
      const comp = compMap[sc.component_id];
      if (!comp) continue;

      const pis = piByKa[ka.id] || [];
      if (pis.length === 0) {
        // Key activity with no performance indicators yet — emit placeholder row
        rows.push({
          component: comp.name, component_id: comp.id, component_sort_order: comp.sort_order,
          sub_component: sc.name, sub_component_id: sc.id, sub_component_sort_order: sc.sort_order,
          key_activity: ka.name, key_activity_id: ka.id, key_activity_sort_order: ka.sort_order,
          activity_no: null, label: null, performance_indicator_sort_order: null,
          sub_activity: null, sub_activity_id: null, sub_activity_sort_order: null,
        });
      } else {
        for (const pi of pis) {
          const subs = saByPi[pi.id] || saByKa[ka.id] || [];
          if (subs.length === 0) {
            rows.push({
              component: comp.name, component_id: comp.id, component_sort_order: comp.sort_order,
              sub_component: sc.name, sub_component_id: sc.id, sub_component_sort_order: sc.sort_order,
              key_activity: ka.name, key_activity_id: ka.id, key_activity_sort_order: ka.sort_order,
              activity_no: pi.activity_no, label: pi.label, performance_indicator_sort_order: pi.sort_order,
              sub_activity: null, sub_activity_id: null, sub_activity_sort_order: null,
            });
          } else {
            for (const sa of subs) {
              rows.push({
                component: comp.name, component_id: comp.id, component_sort_order: comp.sort_order,
                sub_component: sc.name, sub_component_id: sc.id, sub_component_sort_order: sc.sort_order,
                key_activity: ka.name, key_activity_id: ka.id, key_activity_sort_order: ka.sort_order,
                activity_no: pi.activity_no, label: pi.label, performance_indicator_sort_order: pi.sort_order,
                sub_activity: sa.name, sub_activity_id: sa.id, sub_activity_sort_order: sa.sort_order,
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

  async getSubActivities(performanceIndicatorId) {
    const { data, error } = await supabase
      .from('sub_activities')
      .select('*')
      .eq('performance_indicator_id', performanceIndicatorId)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

// Template management services (admin only)
function logTemplateMutation(action, payload, result) {
  console.log(`[templateMgmtService.${action}]`, {
    payload,
    result,
  });
}

function assertTemplateMutation(action, payload, result, error) {
  if (error) {
    console.error(`[templateMgmtService.${action}] Supabase error`, {
      payload,
      error,
    });
    throw error;
  }

  if (!result) {
    const missingResultError = new Error(`${action} did not return a saved row from Supabase.`);
    console.error(`[templateMgmtService.${action}] Missing saved row`, {
      payload,
      error: missingResultError,
    });
    throw missingResultError;
  }

  logTemplateMutation(action, payload, result);
  return result;
}

function withoutUndefined(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

async function getComponentIdByName(name) {
  const { data, error } = await supabase
    .from('components')
    .select('id')
    .eq('name', name)
    .limit(1);
  if (error || !data || data.length === 0) throw new Error(`Component not found: ${name}`);
  return data[0].id;
}

async function getSubComponentIdByName(subCompName, componentName) {
  const compId = await getComponentIdByName(componentName);
  const { data, error } = await supabase
    .from('sub_components')
    .select('id')
    .eq('component_id', compId)
    .eq('name', subCompName)
    .limit(1);
  if (error || !data || data.length === 0) throw new Error(`Sub-component not found: ${subCompName}`);
  return data[0].id;
}

async function getKeyActivityIdByName(kaName, subCompName, componentName) {
  const subCompId = await getSubComponentIdByName(subCompName, componentName);
  const { data, error } = await supabase
    .from('key_activities')
    .select('id')
    .eq('sub_component_id', subCompId)
    .eq('name', kaName)
    .limit(1);
  if (error || !data || data.length === 0) throw new Error(`Key activity not found: ${kaName}`);
  return data[0].id;
}

async function getPerformanceIndicatorRowByNo(indicatorNo, kaName, subCompName, componentName) {
  const kaId = await getKeyActivityIdByName(kaName, subCompName, componentName);
  const { data, error } = await supabase
    .from('performance_indicators')
    .select('id')
    .eq('key_activity_id', kaId)
    .eq('activity_no', indicatorNo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPerformanceIndicatorIdByNo(indicatorNo, kaName, subCompName, componentName) {
  const row = await getPerformanceIndicatorRowByNo(indicatorNo, kaName, subCompName, componentName);
  if (!row) throw new Error(`Performance indicator not found: ${indicatorNo}`);
  return row.id;
}

async function getSubActivityRowByName({
  keyActivityId,
  performanceIndicatorId,
  name,
}) {
  if (performanceIndicatorId) {
    const { data, error } = await supabase
      .from('sub_activities')
      .select('id')
      .eq('performance_indicator_id', performanceIndicatorId)
      .eq('name', name)
      .limit(1);

    if (!error && data?.length > 0) return data;
  }

  const { data, error } = await supabase
    .from('sub_activities')
    .select('id')
    .eq('key_activity_id', keyActivityId)
    .eq('name', name)
    .limit(1);

  if (error) throw error;
  return data || [];
}

function getSupabaseDebugInfo() {
  const url = import.meta.env.VITE_SUPABASE_URL || "";
  let host = "missing-url";
  try {
    host = new URL(url).host;
  } catch {
    host = url || "missing-url";
  }

  return {
    urlHost: host,
    hasAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  };
}

async function probeSubActivitySchema() {
  const keyActivityProbe = await supabase
    .from('sub_activities')
    .select('id, key_activity_id')
    .limit(1);
  const performanceIndicatorProbe = await supabase
    .from('sub_activities')
    .select('id, performance_indicator_id')
    .limit(1);

  const schema = {
    hasKeyActivityId: !keyActivityProbe.error,
    hasPerformanceIndicatorId: !performanceIndicatorProbe.error,
    keyActivityProbeError: keyActivityProbe.error || null,
    performanceIndicatorProbeError: performanceIndicatorProbe.error || null,
  };

  console.log('[templateMgmtService.createSubActivity] sub_activities schema probe', schema);
  return schema;
}

async function verifySavedSubActivity(row, payload) {
  if (!row?.id) {
    throw new Error('Sub activity insert did not return an id.');
  }

  let response = await supabase
    .from('sub_activities')
    .select('id, name, key_activity_id, performance_indicator_id, sort_order, is_active')
    .eq('id', row.id)
    .maybeSingle();

  if (response.error?.message?.includes('performance_indicator_id')) {
    response = await supabase
      .from('sub_activities')
      .select('id, name, key_activity_id, sort_order, is_active')
      .eq('id', row.id)
      .maybeSingle();
  }

  if (response.error) {
    console.error('[templateMgmtService.createSubActivity] Verification failed', {
      payload,
      savedRow: row,
      error: response.error,
    });
    throw response.error;
  }

  if (!response.data) {
    const error = new Error(`Sub activity was not readable after insert: ${row.id}`);
    console.error('[templateMgmtService.createSubActivity] Verification missing row', {
      payload,
      savedRow: row,
      error,
    });
    throw error;
  }

  console.log('[templateMgmtService.createSubActivity] Verified saved row', response.data);
  return response.data;
}

export const templateMgmtService = {
  getComponentIdByName,
  getSubComponentIdByName,
  getKeyActivityIdByName,
  getPerformanceIndicatorIdByNo,
  getPerformanceIndicatorRowByNo,
  getSubActivityRowByName,

  async createComponent(data) {
    const payload = {
      name: data.name,
      code: data.code,
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    };
    const { data: result, error } = await supabase
      .from('components')
      .insert(payload)
      .select()
      .single();
    return assertTemplateMutation('createComponent', payload, result, error);
  },

  async updateComponent(id, updates) {
    const payload = withoutUndefined({
      name: updates.name,
      code: updates.code,
      sort_order: updates.sort_order,
      is_active: updates.is_active
    });
    const { data: result, error } = await supabase
      .from('components')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return assertTemplateMutation('updateComponent', { id, ...payload }, result, error);
  },

  async deleteComponent(id) {
    const { error } = await supabase.from('components').delete().eq('id', id);
    if (error) throw error;
  },

  async createSubComponent(data) {
    const payload = {
      component_id: data.component_id,
      name: data.name,
      code: data.code,
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    };
    const { data: result, error } = await supabase
      .from('sub_components')
      .insert(payload)
      .select()
      .single();
    return assertTemplateMutation('createSubComponent', payload, result, error);
  },

  async updateSubComponent(id, updates) {
    const payload = withoutUndefined({
      name: updates.name,
      code: updates.code,
      sort_order: updates.sort_order,
      is_active: updates.is_active
    });
    const { data: result, error } = await supabase
      .from('sub_components')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return assertTemplateMutation('updateSubComponent', { id, ...payload }, result, error);
  },

  async deleteSubComponent(id) {
    const { error } = await supabase.from('sub_components').delete().eq('id', id);
    if (error) throw error;
  },

  async createKeyActivity(data) {
    const payload = {
      sub_component_id: data.sub_component_id,
      name: data.name,
      code: data.code,
      activity_no: data.activity_no,
      performance_indicator: data.performance_indicator || '',
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    };
    const { data: result, error } = await supabase
      .from('key_activities')
      .insert(payload)
      .select()
      .single();
    return assertTemplateMutation('createKeyActivity', payload, result, error);
  },

  async updateKeyActivity(id, updates) {
    const payload = withoutUndefined({
      name: updates.name,
      code: updates.code,
      activity_no: updates.activity_no,
      performance_indicator: updates.performance_indicator,
      sort_order: updates.sort_order,
      is_active: updates.is_active
    });
    const { data: result, error } = await supabase
      .from('key_activities')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return assertTemplateMutation('updateKeyActivity', { id, ...payload }, result, error);
  },

  async deleteKeyActivity(id) {
    const { error } = await supabase.from('key_activities').delete().eq('id', id);
    if (error) throw error;
  },

  async createPerformanceIndicator(data) {
    const payload = {
      key_activity_id: data.key_activity_id,
      activity_no: data.activity_no,
      label: data.label,
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    };
    const { data: result, error } = await supabase
      .from('performance_indicators')
      .insert(payload)
      .select()
      .single();
    return assertTemplateMutation('createPerformanceIndicator', payload, result, error);
  },

  async updatePerformanceIndicator(id, updates) {
    const payload = withoutUndefined({
      activity_no: updates.activity_no,
      label: updates.label,
      sort_order: updates.sort_order,
      is_active: updates.is_active
    });
    const { data: result, error } = await supabase
      .from('performance_indicators')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return assertTemplateMutation('updatePerformanceIndicator', { id, ...payload }, result, error);
  },

  async deletePerformanceIndicator(id) {
    const { error } = await supabase.from('performance_indicators').delete().eq('id', id);
    if (error) throw error;
  },

  async createSubActivity(data) {
    console.log('[templateMgmtService.createSubActivity] Starting insert', {
      supabase: getSupabaseDebugInfo(),
      input: data,
    });

    const schema = await probeSubActivitySchema();
    const shouldUseKeyActivityId =
      schema.hasKeyActivityId || !schema.hasPerformanceIndicatorId;
    const shouldUsePerformanceIndicatorId = schema.hasPerformanceIndicatorId;

    const payload = withoutUndefined({
      performance_indicator_id: shouldUsePerformanceIndicatorId ? data.performance_indicator_id : undefined,
      key_activity_id: shouldUseKeyActivityId ? data.key_activity_id : undefined,
      name: data.name,
      code: data.code,
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    });

    console.log('[templateMgmtService.createSubActivity] Insert payload', {
      table: 'sub_activities',
      payload,
      schema,
      supabase: getSupabaseDebugInfo(),
    });

    const response = await supabase
      .from('sub_activities')
      .insert(payload)
      .select()
      .single();

    console.log('[templateMgmtService.createSubActivity] Raw insert response', {
      data: response.data,
      error: response.error,
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.error) {
      const savedRow = assertTemplateMutation('createSubActivity', payload, response.data, response.error);
      return verifySavedSubActivity(savedRow, payload);
    }

    const mentionsPerformanceIndicator = response.error.message?.includes('performance_indicator_id');
    const mentionsKeyActivity = response.error.message?.includes('key_activity_id');
    const shouldFallbackToKeyActivity =
      data.key_activity_id &&
      (mentionsPerformanceIndicator || response.error.code === 'PGRST204' || response.error.code === '23502');
    const shouldFallbackToPerformanceIndicator =
      data.performance_indicator_id &&
      mentionsKeyActivity &&
      !mentionsPerformanceIndicator;

    if (!shouldFallbackToKeyActivity && !shouldFallbackToPerformanceIndicator) {
      console.error('[templateMgmtService.createSubActivity] Insert failed without fallback', {
        payload,
        schema,
        error: response.error,
      });
      return assertTemplateMutation('createSubActivity', payload, response.data, response.error);
    }

    const fallbackPayload = withoutUndefined({
      key_activity_id: shouldFallbackToKeyActivity ? data.key_activity_id : undefined,
      performance_indicator_id: shouldFallbackToPerformanceIndicator ? data.performance_indicator_id : undefined,
      name: data.name,
      code: data.code,
      sort_order: data.sort_order,
      is_active: data.is_active ?? true
    });

    console.log('[templateMgmtService.createSubActivity] Fallback insert payload', {
      fallbackPayload,
      reason: {
        shouldFallbackToKeyActivity,
        shouldFallbackToPerformanceIndicator,
        firstError: response.error,
      },
      supabase: getSupabaseDebugInfo(),
    });

    const { data: result, error } = await supabase
      .from('sub_activities')
      .insert(fallbackPayload)
      .select()
      .single();
    console.log('[templateMgmtService.createSubActivity] Fallback raw response', {
      data: result,
      error,
    });
    if (error) {
      console.error('[templateMgmtService.createSubActivity] Fallback insert failed', {
        fallbackPayload,
        error,
      });
    }
    const savedRow = assertTemplateMutation('createSubActivity', fallbackPayload, result, error);
    return verifySavedSubActivity(savedRow, fallbackPayload);
  },

  async updateSubActivity(id, updates) {
    const payload = withoutUndefined({
      name: updates.name,
      code: updates.code,
      sort_order: updates.sort_order,
      is_active: updates.is_active
    });
    const { data: result, error } = await supabase
      .from('sub_activities')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return assertTemplateMutation('updateSubActivity', { id, ...payload }, result, error);
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
