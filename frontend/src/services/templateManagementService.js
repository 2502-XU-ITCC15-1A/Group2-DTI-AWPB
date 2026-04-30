import {
  cloneTemplateData,
  normalizeIndicatorNo,
  normalizeName,
} from "./templateService";

function withHierarchyDraft(templateData, updater) {
  const nextTemplate = cloneTemplateData(templateData);
  updater(nextTemplate.hierarchy || (nextTemplate.hierarchy = {}));
  return nextTemplate;
}

export function addComponent(templateData, componentName) {
  const name = normalizeName(componentName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[name] = {};
  });
}

export function renameComponent(templateData, currentName, nextName) {
  const normalizedNextName = normalizeName(nextName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[normalizedNextName] = hierarchy[currentName];
    delete hierarchy[currentName];
  });
}

export function deleteComponent(templateData, componentName) {
  return withHierarchyDraft(templateData, (hierarchy) => {
    delete hierarchy[componentName];
  });
}

export function addSubComponent(templateData, componentName, subComponentName) {
  const name = normalizeName(subComponentName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[componentName][name] = {};
  });
}

export function renameSubComponent(
  templateData,
  componentName,
  currentName,
  nextName,
) {
  const normalizedNextName = normalizeName(nextName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    const componentNode = hierarchy[componentName];
    componentNode[normalizedNextName] = componentNode[currentName];
    delete componentNode[currentName];
  });
}

export function deleteSubComponent(templateData, componentName, subComponentName) {
  return withHierarchyDraft(templateData, (hierarchy) => {
    delete hierarchy[componentName][subComponentName];
  });
}

export function addKeyActivity(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
) {
  const name = normalizeName(keyActivityName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[componentName][subComponentName][name] = [];
  });
}

export function renameKeyActivity(
  templateData,
  componentName,
  subComponentName,
  currentName,
  nextName,
) {
  const normalizedNextName = normalizeName(nextName);
  return withHierarchyDraft(templateData, (hierarchy) => {
    const subComponentNode = hierarchy[componentName][subComponentName];
    subComponentNode[normalizedNextName] = subComponentNode[currentName];
    delete subComponentNode[currentName];
  });
}

export function deleteKeyActivity(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
) {
  return withHierarchyDraft(templateData, (hierarchy) => {
    delete hierarchy[componentName][subComponentName][keyActivityName];
  });
}

export function addIndicator(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorNo,
  indicatorText,
) {
  const nextNo = normalizeIndicatorNo(indicatorNo);
  const nextText = normalizeName(indicatorText);

  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[componentName][subComponentName][keyActivityName].push({
      no: nextNo,
      performanceIndicator: nextText,
      subActivities: [],
    });
  });
}

export function saveIndicator(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
  indicatorNo,
  indicatorText,
  subActivities,
) {
  const nextNo = normalizeIndicatorNo(indicatorNo);
  const nextText = normalizeName(indicatorText);

  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[componentName][subComponentName][keyActivityName][indicatorIndex] = {
      no: nextNo,
      performanceIndicator: nextText,
      subActivities: subActivities || [],
    };
  });
}

export function deleteIndicator(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
) {
  return withHierarchyDraft(templateData, (hierarchy) => {
    hierarchy[componentName][subComponentName][keyActivityName].splice(
      indicatorIndex,
      1,
    );
  });
}

export function addSubActivity(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
  subActivityText,
) {
  const nextText = normalizeName(subActivityText);

  return withHierarchyDraft(templateData, (hierarchy) => {
    const targetIndicator =
      hierarchy[componentName][subComponentName][keyActivityName][indicatorIndex];
    targetIndicator.subActivities = [
      ...(targetIndicator.subActivities || []),
      nextText,
    ];
  });
}

export function saveSubActivity(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
  subActivityIndex,
  subActivityText,
) {
  const nextText = normalizeName(subActivityText);

  return withHierarchyDraft(templateData, (hierarchy) => {
    const targetIndicator =
      hierarchy[componentName][subComponentName][keyActivityName][indicatorIndex];
    targetIndicator.subActivities[subActivityIndex] = nextText;
  });
}

export function deleteSubActivity(
  templateData,
  componentName,
  subComponentName,
  keyActivityName,
  indicatorIndex,
  subActivityIndex,
) {
  return withHierarchyDraft(templateData, (hierarchy) => {
    const targetIndicator =
      hierarchy[componentName][subComponentName][keyActivityName][indicatorIndex];
    targetIndicator.subActivities.splice(subActivityIndex, 1);
  });
}
