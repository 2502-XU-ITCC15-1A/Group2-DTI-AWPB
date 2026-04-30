export function cloneTemplateData(templateData) {
  return JSON.parse(JSON.stringify(templateData));
}

export function normalizeName(value) {
  return String(value || "").trim();
}

export function normalizeIndicatorNo(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

export function getHierarchy(templateData) {
  return templateData?.hierarchy || {};
}

export function getComponentNames(templateData) {
  return Object.keys(getHierarchy(templateData));
}

export function getSubComponentNames(templateData, componentName) {
  if (!componentName) return [];
  return Object.keys(getHierarchy(templateData)[componentName] || {});
}

export function getKeyActivityNames(templateData, componentName, subComponentName) {
  if (!componentName || !subComponentName) return [];
  return Object.keys(
    getHierarchy(templateData)[componentName]?.[subComponentName] || {},
  );
}

export function getIndicatorItems(templateData, componentName, subComponentName, keyActivityName) {
  if (!componentName || !subComponentName || !keyActivityName) return [];
  return (
    getHierarchy(templateData)[componentName]?.[subComponentName]?.[keyActivityName] ||
    []
  );
}

export function getSubActivityItems(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
) {
  return (
    getIndicatorItems(
      templateData,
      componentName,
      subComponentName,
      keyActivityName,
    )[indicatorIndex]?.subActivities || []
  );
}
