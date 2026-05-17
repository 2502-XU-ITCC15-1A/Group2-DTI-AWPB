import { supabase } from "../lib/supabase";

function makeTemplateCode(prefix, value, index = 0) {
  const slug = String(value || "item")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);

  return `${prefix}_${index + 1}_${slug || "ITEM"}`;
}

async function getOrCreateComponent(name, sortOrder) {
  const { data: existing, error: findError } = await supabase
    .from("components")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (existing.is_active !== true) {
      const { data, error } = await supabase
        .from("components")
        .update({ is_active: true, sort_order: existing.sort_order ?? sortOrder })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("components")
    .insert({
      name,
      code: makeTemplateCode("COMP", name, sortOrder),
      sort_order: sortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreateSubComponent(componentId, name, sortOrder) {
  const { data: existing, error: findError } = await supabase
    .from("sub_components")
    .select("*")
    .eq("component_id", componentId)
    .eq("name", name)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (existing.is_active !== true) {
      const { data, error } = await supabase
        .from("sub_components")
        .update({ is_active: true, sort_order: existing.sort_order ?? sortOrder })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("sub_components")
    .insert({
      component_id: componentId,
      name,
      code: makeTemplateCode(`SUB_COMP_${String(componentId).slice(0, 8)}`, name, sortOrder),
      sort_order: sortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreateKeyActivity(subComponentId, name, sortOrder) {
  const { data: existing, error: findError } = await supabase
    .from("key_activities")
    .select("*")
    .eq("sub_component_id", subComponentId)
    .eq("name", name)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (existing.is_active !== true) {
      const { data, error } = await supabase
        .from("key_activities")
        .update({ is_active: true, sort_order: existing.sort_order ?? sortOrder })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("key_activities")
    .insert({
      sub_component_id: subComponentId,
      name,
      code: makeTemplateCode(`KEY_ACT_${String(subComponentId).slice(0, 8)}`, name, sortOrder),
      sort_order: sortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreatePerformanceIndicator(keyActivityId, indicator, sortOrder) {
  const activityNo = indicator.no;
  const label = indicator.performanceIndicator || "";
  const { data: existing, error: findError } = await supabase
    .from("performance_indicators")
    .select("*")
    .eq("key_activity_id", keyActivityId)
    .eq("activity_no", activityNo)
    .maybeSingle();

  if (
    findError?.message?.includes("performance_indicators") ||
    findError?.code === "42P01" ||
    findError?.code === "PGRST205"
  ) {
    return null;
  }
  if (findError) throw findError;
  if (existing) {
    const updates = {};
    if (existing.is_active !== true) updates.is_active = true;
    if (!existing.label && label) updates.label = label;
    if (existing.sort_order == null) updates.sort_order = sortOrder;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("performance_indicators")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("performance_indicators")
    .insert({
      key_activity_id: keyActivityId,
      activity_no: activityNo,
      label,
      sort_order: sortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreateSubActivity(keyActivityId, performanceIndicatorId, name, sortOrder) {
  let existingResponse = performanceIndicatorId
    ? await supabase
      .from("sub_activities")
      .select("*")
      .eq("performance_indicator_id", performanceIndicatorId)
      .eq("name", name)
      .maybeSingle()
    : { data: null, error: { message: "performance_indicator_id unavailable" } };

  if (existingResponse.error?.message?.includes("performance_indicator_id")) {
    existingResponse = await supabase
      .from("sub_activities")
      .select("*")
      .eq("key_activity_id", keyActivityId)
      .eq("name", name)
      .maybeSingle();
  }

  if (existingResponse.error) throw existingResponse.error;
  if (existingResponse.data) {
    if (existingResponse.data.is_active !== true) {
      const { error } = await supabase
        .from("sub_activities")
        .update({ is_active: true, sort_order: existingResponse.data.sort_order ?? sortOrder })
        .eq("id", existingResponse.data.id);
      if (error) throw error;
    }
    return existingResponse.data;
  }

  const payload = {
    key_activity_id: keyActivityId,
    performance_indicator_id: performanceIndicatorId,
    name,
    code: makeTemplateCode(`SUB_ACT_${String(performanceIndicatorId || keyActivityId).slice(0, 8)}`, name, sortOrder),
    sort_order: sortOrder,
    is_active: true,
  };

  let insertResponse = await supabase
    .from("sub_activities")
    .insert(payload)
    .select()
    .single();

  if (insertResponse.error?.message?.includes("performance_indicator_id")) {
    const { performance_indicator_id, ...fallbackPayload } = payload;
    fallbackPayload.code = makeTemplateCode(`SUB_ACT_${String(keyActivityId).slice(0, 8)}`, name, sortOrder);
    insertResponse = await supabase
      .from("sub_activities")
      .insert(fallbackPayload)
      .select()
      .single();
  }

  if (insertResponse.error) throw insertResponse.error;
  return insertResponse.data;
}

export async function syncDefaultTemplateToSupabase(templateData) {
  const hierarchy = templateData?.hierarchy || {};

  for (const [componentIndex, [componentName, subComponents]] of Object.entries(hierarchy).entries()) {
    const component = await getOrCreateComponent(componentName, componentIndex + 1);

    for (const [subComponentIndex, [subComponentName, keyActivities]] of Object.entries(subComponents || {}).entries()) {
      const subComponent = await getOrCreateSubComponent(component.id, subComponentName, subComponentIndex + 1);

      for (const [keyActivityIndex, [keyActivityName, indicators]] of Object.entries(keyActivities || {}).entries()) {
        const keyActivity = await getOrCreateKeyActivity(subComponent.id, keyActivityName, keyActivityIndex + 1);

        for (const [indicatorIndex, indicator] of (indicators || []).entries()) {
          const performanceIndicator = await getOrCreatePerformanceIndicator(
            keyActivity.id,
            indicator,
            indicatorIndex + 1,
          );

          for (const [subActivityIndex, subActivityName] of (indicator.subActivities || []).entries()) {
            await getOrCreateSubActivity(
              keyActivity.id,
              performanceIndicator?.id,
              subActivityName,
              subActivityIndex + 1,
            );
          }
        }
      }
    }
  }
}

function buildHierarchyRows({ components = [], subComponents = [], keyActivities = [], indicators = [], subActivities = [] }) {
  const componentById = Object.fromEntries(components.map((component) => [component.id, component]));
  const subComponentById = Object.fromEntries(subComponents.map((subComponent) => [subComponent.id, subComponent]));

  const subComponentsByComponent = subComponents.reduce((acc, subComponent) => {
    acc[subComponent.component_id] = acc[subComponent.component_id] || [];
    acc[subComponent.component_id].push(subComponent);
    return acc;
  }, {});

  const keyActivitiesBySubComponent = keyActivities.reduce((acc, keyActivity) => {
    acc[keyActivity.sub_component_id] = acc[keyActivity.sub_component_id] || [];
    acc[keyActivity.sub_component_id].push(keyActivity);
    return acc;
  }, {});

  const indicatorsByKeyActivity = indicators.reduce((acc, indicator) => {
    acc[indicator.key_activity_id] = acc[indicator.key_activity_id] || [];
    acc[indicator.key_activity_id].push(indicator);
    return acc;
  }, {});

  const subActivitiesByIndicator = subActivities.reduce((acc, subActivity) => {
    if (!subActivity.performance_indicator_id) return acc;
    acc[subActivity.performance_indicator_id] = acc[subActivity.performance_indicator_id] || [];
    acc[subActivity.performance_indicator_id].push(subActivity);
    return acc;
  }, {});

  const subActivitiesByKeyActivity = subActivities.reduce((acc, subActivity) => {
    if (!subActivity.key_activity_id) return acc;
    acc[subActivity.key_activity_id] = acc[subActivity.key_activity_id] || [];
    acc[subActivity.key_activity_id].push(subActivity);
    return acc;
  }, {});

  const rows = [];

  components.forEach((component) => {
    const children = subComponentsByComponent[component.id] || [];
    if (children.length > 0) return;

    rows.push({
      component_id: component.id,
      component: component.name,
      component_code: component.code,
      component_sort_order: component.sort_order,
      sub_component_id: null,
      sub_component: null,
      sub_component_code: null,
      sub_component_sort_order: null,
      key_activity_id: null,
      key_activity: null,
      key_activity_code: null,
      key_activity_sort_order: null,
      activity_no: null,
      label: null,
      performance_indicator: null,
      performance_indicator_id: null,
      performance_indicator_sort_order: null,
      sub_activity_id: null,
      sub_activity: null,
      sub_activity_code: null,
      sub_activity_sort_order: null,
      sort_order: component.sort_order,
    });
  });

  subComponents.forEach((subComponent) => {
    const component = componentById[subComponent.component_id];
    if (!component) return;
    const children = keyActivitiesBySubComponent[subComponent.id] || [];
    if (children.length > 0) return;

    rows.push({
      component_id: component.id,
      component: component.name,
      component_code: component.code,
      component_sort_order: component.sort_order,
      sub_component_id: subComponent.id,
      sub_component: subComponent.name,
      sub_component_code: subComponent.code,
      sub_component_sort_order: subComponent.sort_order,
      key_activity_id: null,
      key_activity: null,
      key_activity_code: null,
      key_activity_sort_order: null,
      activity_no: null,
      label: null,
      performance_indicator: null,
      performance_indicator_id: null,
      performance_indicator_sort_order: null,
      sub_activity_id: null,
      sub_activity: null,
      sub_activity_code: null,
      sub_activity_sort_order: null,
      sort_order: subComponent.sort_order,
    });
  });

  keyActivities.forEach((keyActivity) => {
    const subComponent = subComponentById[keyActivity.sub_component_id];
    const component = componentById[subComponent?.component_id];
    if (!component || !subComponent) return;

    const indicatorRows = indicatorsByKeyActivity[keyActivity.id] || [];
    if (indicatorRows.length === 0) {
      const legacyActivityNo = keyActivity.activity_no;
      const legacyPerformanceIndicator = keyActivity.performance_indicator;
      const hasLegacyIndicator =
        legacyActivityNo !== null &&
        legacyActivityNo !== undefined &&
        legacyActivityNo !== "";

      if (hasLegacyIndicator) {
        const childSubActivities = subActivitiesByKeyActivity[keyActivity.id] || [];
        const rowsToAdd = childSubActivities.length > 0 ? childSubActivities : [null];

        rowsToAdd.forEach((subActivity) => {
          rows.push({
            component_id: component.id,
            component: component.name,
            component_code: component.code,
            component_sort_order: component.sort_order,
            sub_component_id: subComponent.id,
            sub_component: subComponent.name,
            sub_component_code: subComponent.code,
            sub_component_sort_order: subComponent.sort_order,
            key_activity_id: keyActivity.id,
            key_activity: keyActivity.name,
            key_activity_code: keyActivity.code,
            key_activity_sort_order: keyActivity.sort_order,
            activity_no: legacyActivityNo,
            label: legacyPerformanceIndicator || "",
            performance_indicator: legacyPerformanceIndicator || "",
            performance_indicator_id: null,
            performance_indicator_sort_order: keyActivity.sort_order,
            sub_activity_id: subActivity?.id || null,
            sub_activity: subActivity?.name || null,
            sub_activity_code: subActivity?.code || null,
            sub_activity_sort_order: subActivity?.sort_order || null,
            sort_order: keyActivity.sort_order,
          });
        });
        return;
      }

      rows.push({
        component_id: component.id,
        component: component.name,
        component_code: component.code,
        component_sort_order: component.sort_order,
        sub_component_id: subComponent.id,
        sub_component: subComponent.name,
        sub_component_code: subComponent.code,
        sub_component_sort_order: subComponent.sort_order,
        key_activity_id: keyActivity.id,
        key_activity: keyActivity.name,
        key_activity_code: keyActivity.code,
        key_activity_sort_order: keyActivity.sort_order,
        activity_no: null,
        label: null,
        performance_indicator: null,
        performance_indicator_id: null,
        performance_indicator_sort_order: null,
        sub_activity_id: null,
        sub_activity: null,
        sub_activity_code: null,
        sub_activity_sort_order: null,
        sort_order: keyActivity.sort_order,
      });
      return;
    }

    indicatorRows.forEach((indicator) => {
      const indicatorSubActivities = subActivitiesByIndicator[indicator.id] || [];
      const legacySubActivities =
        indicatorRows.length === 1 ? subActivitiesByKeyActivity[keyActivity.id] || [] : [];
      const childSubActivities =
        indicatorSubActivities.length > 0 ? indicatorSubActivities : legacySubActivities;
      const rowsToAdd = childSubActivities.length > 0 ? childSubActivities : [null];

      rowsToAdd.forEach((subActivity) => {
        rows.push({
          component_id: component.id,
          component: component.name,
          component_code: component.code,
          component_sort_order: component.sort_order,
          sub_component_id: subComponent.id,
          sub_component: subComponent.name,
          sub_component_code: subComponent.code,
          sub_component_sort_order: subComponent.sort_order,
          key_activity_id: keyActivity.id,
          key_activity: keyActivity.name,
          key_activity_code: keyActivity.code,
          key_activity_sort_order: keyActivity.sort_order,
          activity_no: indicator.activity_no,
          label: indicator.label,
          performance_indicator: indicator.label,
          performance_indicator_id: indicator.id,
          performance_indicator_sort_order: indicator.sort_order,
          sub_activity_id: subActivity?.id || null,
          sub_activity: subActivity?.name || null,
          sub_activity_code: subActivity?.code || null,
          sub_activity_sort_order: subActivity?.sort_order || null,
          sort_order: keyActivity.sort_order,
        });
      });
    });
  });

  return rows;
}

// Full hierarchy read used after refresh. Reading the base tables avoids stale
// `template_hierarchy` views that omit partial branches or the PI table.
export const getTemplateHierarchy = async () => {
  const [componentRes, subComponentRes, keyActivityRes, initialIndicatorRes, initialSubActivityRes] = await Promise.all([
    supabase.from("components").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("sub_components").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("key_activities").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("performance_indicators").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("sub_activities").select("*").eq("is_active", true).order("sort_order"),
  ]);
  let indicatorRes = initialIndicatorRes;
  let subActivityRes = initialSubActivityRes;

  if (
    indicatorRes.error?.message?.includes("performance_indicators") ||
    indicatorRes.error?.code === "42P01" ||
    indicatorRes.error?.code === "PGRST205"
  ) {
    indicatorRes = { data: [], error: null };
  }

  if (subActivityRes.error?.message?.includes("performance_indicator_id")) {
    subActivityRes = await supabase
      .from("sub_activities")
      .select("id, key_activity_id, name, code, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");
  }

  const error =
    componentRes.error ||
    subComponentRes.error ||
    keyActivityRes.error ||
    indicatorRes.error ||
    subActivityRes.error;

  if (error) {
    console.error("[templateService.getTemplateHierarchy] Failed to load hierarchy", error);
    return { data: null, error };
  }

  return {
    data: buildHierarchyRows({
      components: componentRes.data || [],
      subComponents: subComponentRes.data || [],
      keyActivities: keyActivityRes.data || [],
      indicators: indicatorRes.data || [],
      subActivities: subActivityRes.data || [],
    }),
    error: null,
  };
};
