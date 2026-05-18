import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import AdminDeleteTemplateItemModal from "@/components/admin/AdminDeleteTemplateItemModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { templateMgmtService } from "@/services/supabaseService";

function cloneTemplateData(templateData) {
  return JSON.parse(JSON.stringify(templateData));
}

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizeIndicatorNo(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

function compareTemplateValues(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortTemplateKeys(keys) {
  return [...(keys || [])].sort(compareTemplateValues);
}

function sortIndicators(items) {
  return [...(items || [])]
    .map((item) => ({
      ...item,
      // Keep the child dropdown deterministic even when Supabase returns no rows.
      subActivities: sortTemplateKeys(item?.subActivities || []),
    }))
    .sort((a, b) => compareTemplateValues(a?.no, b?.no));
}

const panelClass =
  "min-w-0 rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)]";
const emptyStateClass =
  "rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500";
const inputClass =
  "h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm shadow-none focus-visible:ring-slate-200";
const primaryButtonClass =
  "h-11 rounded-xl border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] px-4 text-white shadow-[0_8px_20px_rgba(31,47,116,0.18)] hover:from-[#19265f] hover:to-[#213a80]";
const compactGradientButtonClass =
  "h-9 rounded-lg border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] px-3 text-sm text-white shadow-[0_6px_16px_rgba(31,47,116,0.18)] hover:from-[#19265f] hover:to-[#213a80]";
const secondaryButtonClass =
  "h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const dropdownTriggerClass =
  "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400";
const actionIconButtonClass = "rounded-lg p-2 transition";
const editActionIconButtonClass = `${actionIconButtonClass} text-sky-500 hover:bg-sky-50 hover:text-sky-700`;
const deleteActionIconButtonClass = `${actionIconButtonClass} text-red-400 hover:bg-red-50 hover:text-red-600`;
const saveInlineButtonClass =
  "rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100";
const addPickerButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-2.5 text-sm text-sky-700 transition hover:border-sky-300 hover:bg-sky-50";

function getLockedPanelClass(enabled) {
  return enabled
    ? panelClass
    : `${panelClass} border-slate-200 bg-slate-50/80 opacity-75`;
}

function getPanelTitleClass(enabled) {
  return enabled ? "text-lg text-slate-900" : "text-lg text-slate-400";
}

function getPanelDescriptionClass(enabled) {
  return enabled ? "text-sm text-slate-500" : "text-sm text-slate-400";
}

function getEmptyStateClass(enabled) {
  return enabled
    ? emptyStateClass
    : "rounded-[1.25rem] border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-400";
}

function getTemplateLabel(value, emptyLabel) {
  return normalizeName(value) || emptyLabel;
}

function getFallbackLabel(value) {
  return getTemplateLabel(value, "N/A");
}

function logTemplateCrudError(action, error) {
  console.error(`[ManageTemplate.${action}]`, error);
}

export default function ManageTemplate({
  templateData,
  defaultTemplateData,
  onUpdateTemplateData,
  onResetTemplate,
  onSetDefaultTemplate,
  onShowToast,
}) {
  const hierarchy = useMemo(() => templateData?.hierarchy || {}, [templateData]);

  const componentNames = useMemo(
    () => sortTemplateKeys(Object.keys(hierarchy)),
    [hierarchy]
  );

  const [selectedComponent, setSelectedComponent] = useState("");
  const [selectedSubComponent, setSelectedSubComponent] = useState("");
  const [selectedKeyActivity, setSelectedKeyActivity] = useState("");
  const [selectedIndicatorIndex, setSelectedIndicatorIndex] = useState(0);
  const [selectedSubActivityIndex, setSelectedSubActivityIndex] = useState(0);
  const [componentMenuOpen, setComponentMenuOpen] = useState(false);
  const [showAddComponentInput, setShowAddComponentInput] = useState(false);
  const [editingComponentName, setEditingComponentName] = useState("");
  const [subComponentMenuOpen, setSubComponentMenuOpen] = useState(false);
  const [showAddSubComponentInput, setShowAddSubComponentInput] = useState(false);
  const [editingSubComponentName, setEditingSubComponentName] = useState("");
  const [keyActivityMenuOpen, setKeyActivityMenuOpen] = useState(false);
  const [showAddKeyActivityInput, setShowAddKeyActivityInput] = useState(false);
  const [editingKeyActivityName, setEditingKeyActivityName] = useState("");
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [showAddIndicatorInput, setShowAddIndicatorInput] = useState(false);
  const [editingIndicatorIndex, setEditingIndicatorIndex] = useState(null);
  const [subActivityMenuOpen, setSubActivityMenuOpen] = useState(false);
  const [showAddSubActivityInput, setShowAddSubActivityInput] = useState(false);
  const [editingSubActivityIndex, setEditingSubActivityIndex] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [setDefaultDialogOpen, setSetDefaultDialogOpen] = useState(false);
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);

  const [newComponentName, setNewComponentName] = useState("");
  const [newSubComponentName, setNewSubComponentName] = useState("");
  const [newKeyActivityName, setNewKeyActivityName] = useState("");
  const [newIndicatorNo, setNewIndicatorNo] = useState("");
  const [newIndicatorText, setNewIndicatorText] = useState("");
  const [newSubActivityText, setNewSubActivityText] = useState("");

  const [componentDraft, setComponentDraft] = useState("");
  const [subComponentDraft, setSubComponentDraft] = useState("");
  const [keyActivityDraft, setKeyActivityDraft] = useState("");
  const [indicatorDraft, setIndicatorDraft] = useState({
    no: "",
    performanceIndicator: "",
  });
  const [subActivityDraft, setSubActivityDraft] = useState("");

  const subComponentNames = useMemo(() => {
    if (!selectedComponent) return [];
    return sortTemplateKeys(Object.keys(hierarchy[selectedComponent] || {}));
  }, [hierarchy, selectedComponent]);

  const keyActivityNames = useMemo(() => {
    if (!selectedComponent || !subComponentNames.includes(selectedSubComponent)) return [];
    return sortTemplateKeys(Object.keys(
      hierarchy[selectedComponent]?.[selectedSubComponent] || {}
    ));
  }, [hierarchy, selectedComponent, selectedSubComponent, subComponentNames]);

  const indicatorItems = useMemo(() => {
    if (
      !selectedComponent ||
      !subComponentNames.includes(selectedSubComponent) ||
      !keyActivityNames.includes(selectedKeyActivity)
    ) {
      return [];
    }
    return sortIndicators(
      hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] ||
      []
    );
  }, [
    hierarchy,
    selectedComponent,
    selectedSubComponent,
    selectedKeyActivity,
    subComponentNames,
    keyActivityNames,
  ]);

  const selectedIndicator = indicatorItems[selectedIndicatorIndex] || null;
  const subActivityItems = useMemo(
    () => selectedIndicator?.subActivities || [],
    [selectedIndicator],
  );
  const selectedSubActivity = subActivityItems[selectedSubActivityIndex] || "";
  const hasComponentSelected = componentNames.includes(selectedComponent);
  const hasSubComponentSelected = subComponentNames.includes(selectedSubComponent);
  const hasKeyActivitySelected = keyActivityNames.includes(selectedKeyActivity);
  const hasIndicatorSelected = Boolean(selectedIndicator);

  useEffect(() => {
    if (componentNames.length === 0) {
      setSelectedComponent("");
      return;
    }
    if (!componentNames.includes(selectedComponent)) {
      setSelectedComponent(componentNames[0]);
    }
  }, [componentNames, selectedComponent]);

  useEffect(() => {
    if (subComponentNames.length === 0) {
      setSelectedSubComponent("");
      return;
    }
    if (!subComponentNames.includes(selectedSubComponent)) {
      setSelectedSubComponent(subComponentNames[0]);
    }
  }, [selectedSubComponent, subComponentNames]);

  useEffect(() => {
    if (keyActivityNames.length === 0) {
      setSelectedKeyActivity("");
      return;
    }
    if (!keyActivityNames.includes(selectedKeyActivity)) {
      setSelectedKeyActivity(keyActivityNames[0]);
    }
  }, [keyActivityNames, selectedKeyActivity]);

  useEffect(() => {
    if (indicatorItems.length === 0) {
      setSelectedIndicatorIndex(0);
      return;
    }
    if (selectedIndicatorIndex > indicatorItems.length - 1) {
      setSelectedIndicatorIndex(0);
    }
  }, [indicatorItems, selectedIndicatorIndex]);

  useEffect(() => {
    if (subActivityItems.length === 0) {
      setSelectedSubActivityIndex(0);
      return;
    }
    if (selectedSubActivityIndex > subActivityItems.length - 1) {
      setSelectedSubActivityIndex(0);
    }
  }, [selectedSubActivityIndex, subActivityItems]);

  useEffect(() => {
    setComponentDraft(selectedComponent);
  }, [selectedComponent]);

  useEffect(() => {
    setSubComponentDraft(selectedSubComponent);
  }, [selectedSubComponent]);

  useEffect(() => {
    setKeyActivityDraft(selectedKeyActivity);
  }, [selectedKeyActivity]);

  useEffect(() => {
    if (!selectedIndicator) {
      setIndicatorDraft({
        no: "",
        performanceIndicator: "",
      });
      return;
    }
    setIndicatorDraft({
      no: String(selectedIndicator.no ?? ""),
      performanceIndicator: selectedIndicator.performanceIndicator || "",
    });
  }, [selectedIndicator]);

  useEffect(() => {
    setSubActivityDraft(selectedSubActivity);
  }, [selectedSubActivity]);

  const updateTemplate = (updater) => {
    const nextTemplate = cloneTemplateData(templateData);
    updater(nextTemplate);
    onUpdateTemplateData?.(nextTemplate);
  };

  // ========== COMPONENT CRUD (PERSISTED) ==========
  const addComponent = async () => {
    const name = normalizeName(newComponentName);
    if (!name) return;
    if (componentNames.includes(name)) {
      onShowToast?.({
        title: "Duplicate component",
        description: "That component already exists in the template.",
        type: "error",
      });
      return;
    }
    try {
      const savedComponent = await templateMgmtService.createComponent({
        name,
        code: name.toUpperCase().replace(/ /g, '_'),
        sort_order: componentNames.length + 1,
        is_active: true
      });
      const savedName = savedComponent.name || name;
      // Update local hierarchy only after Supabase confirms the row was saved.
      updateTemplate((nextTemplate) => {
        nextTemplate.hierarchy[savedName] = {};
      });
      onShowToast?.({
        title: "Component added",
        description: `${savedName} is now part of the template.`,
        type: "success",
      });
      setNewComponentName("");
      setSelectedComponent(savedName);
      setSelectedSubComponent("");
      setSelectedKeyActivity("");
      setSelectedIndicatorIndex(0);
      setSelectedSubActivityIndex(0);
      setComponentMenuOpen(false);
      setShowAddComponentInput(false);
      setEditingComponentName("");
    } catch (err) {
      logTemplateCrudError("addComponent", err);
      onShowToast?.({
        title: "Error",
        description: err.message,
        type: "error",
      });
    }
  };

  const renameComponent = async () => {
    const nextName = normalizeName(componentDraft);
    if (!selectedComponent || !nextName || nextName === selectedComponent) return;
    if (componentNames.includes(nextName)) {
      onShowToast?.({
        title: "Duplicate component",
        description: "Choose a different component name.",
        type: "error",
      });
      return;
    }
    try {
      const compId = await templateMgmtService.getComponentIdByName(selectedComponent);
      await templateMgmtService.updateComponent(compId, {
        name: nextName,
        code: nextName.toUpperCase().replace(/ /g, '_')
      });
      updateTemplate((nextTemplate) => {
        nextTemplate.hierarchy[nextName] = nextTemplate.hierarchy[selectedComponent];
        delete nextTemplate.hierarchy[selectedComponent];
      });
      setSelectedComponent(nextName);
      setEditingComponentName("");
      onShowToast?.({
        title: "Component renamed",
        description: `Component updated to ${nextName}.`,
        type: "success",
      });
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const deleteComponent = async () => {
    if (!deleteTarget || deleteTarget.kind !== "component") return;
    try {
      const compId = await templateMgmtService.getComponentIdByName(deleteTarget.label);
      await templateMgmtService.deleteComponent(compId);
      updateTemplate((nextTemplate) => {
        delete nextTemplate.hierarchy[deleteTarget.label];
      });
      onShowToast?.({
        title: "Component deleted",
        description: `${deleteTarget.label} was removed from the template.`,
        type: "success",
      });
      setEditingComponentName("");
      setDeleteTarget(null);
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  // ========== SUB COMPONENT CRUD (PERSISTED) ==========
  const addSubComponent = async () => {
    const name = normalizeName(newSubComponentName);
    if (!selectedComponent || !name) return;
    if (subComponentNames.includes(name)) {
      onShowToast?.({
        title: "Duplicate sub component",
        description: "That sub component already exists.",
        type: "error",
      });
      return;
    }
    try {
      const compId = await templateMgmtService.getComponentIdByName(selectedComponent);
      const savedSubComponent = await templateMgmtService.createSubComponent({
        component_id: compId,
        name,
        code: `${selectedComponent.toUpperCase().replace(/ /g, '_')}_${name.toUpperCase().replace(/ /g, '_')}`,
        sort_order: subComponentNames.length + 1,
        is_active: true
      });
      const savedName = savedSubComponent.name || name;
      // Keep the UI in sync with the database row that was actually inserted.
      updateTemplate((nextTemplate) => {
        nextTemplate.hierarchy[selectedComponent] = nextTemplate.hierarchy[selectedComponent] || {};
        nextTemplate.hierarchy[selectedComponent][savedName] = {};
      });
      onShowToast?.({
        title: "Sub component added",
        description: `${savedName} was added under ${selectedComponent}.`,
        type: "success",
      });
      setNewSubComponentName("");
      setSelectedSubComponent(savedName);
      setSelectedKeyActivity("");
      setSelectedIndicatorIndex(0);
      setSelectedSubActivityIndex(0);
      setSubComponentMenuOpen(false);
      setShowAddSubComponentInput(false);
      setEditingSubComponentName("");
    } catch (err) {
      logTemplateCrudError("addSubComponent", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const renameSubComponent = async () => {
    const nextName = normalizeName(subComponentDraft);
    if (!selectedComponent || !selectedSubComponent || !nextName || nextName === selectedSubComponent) return;
    if (subComponentNames.includes(nextName)) {
      onShowToast?.({
        title: "Duplicate sub component",
        description: "Choose a different sub component name.",
        type: "error",
      });
      return;
    }
    try {
      const subCompId = await templateMgmtService.getSubComponentIdByName(selectedSubComponent, selectedComponent);
      await templateMgmtService.updateSubComponent(subCompId, { name: nextName });
      updateTemplate((nextTemplate) => {
        const compNode = nextTemplate.hierarchy[selectedComponent];
        compNode[nextName] = compNode[selectedSubComponent];
        delete compNode[selectedSubComponent];
      });
      setSelectedSubComponent(nextName);
      onShowToast?.({
        title: "Sub component renamed",
        description: `Sub component updated to ${nextName}.`,
        type: "success",
      });
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const deleteSubComponent = async () => {
    if (!deleteTarget || deleteTarget.kind !== "subComponent" || !selectedComponent) return;
    try {
      const subCompId = await templateMgmtService.getSubComponentIdByName(deleteTarget.label, selectedComponent);
      await templateMgmtService.deleteSubComponent(subCompId);
      updateTemplate((nextTemplate) => {
        delete nextTemplate.hierarchy[selectedComponent][deleteTarget.label];
      });
      onShowToast?.({
        title: "Sub component deleted",
        description: `${deleteTarget.label} was removed.`,
        type: "success",
      });
      setEditingSubComponentName("");
      setDeleteTarget(null);
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  // ========== KEY ACTIVITY CRUD (PERSISTED) ==========
  const addKeyActivity = async () => {
    const name = normalizeName(newKeyActivityName);
    if (!selectedComponent || !selectedSubComponent || !name) return;
    if (keyActivityNames.includes(name)) {
      onShowToast?.({
        title: "Duplicate key activity",
        description: "That key activity already exists.",
        type: "error",
      });
      return;
    }
    try {
      const subCompId = await templateMgmtService.getSubComponentIdByName(selectedSubComponent, selectedComponent);
      const savedKeyActivity = await templateMgmtService.createKeyActivity({
        sub_component_id: subCompId,
        name,
        code: `KA_${name.toUpperCase().replace(/ /g, '_')}_${Date.now()}`,
        sort_order: keyActivityNames.length + 1,
        is_active: true
      });
      const savedName = savedKeyActivity.name || name;
      // Do not show the new key activity until the FK insert succeeds.
      updateTemplate((nextTemplate) => {
        nextTemplate.hierarchy[selectedComponent][selectedSubComponent] =
          nextTemplate.hierarchy[selectedComponent][selectedSubComponent] || {};
        nextTemplate.hierarchy[selectedComponent][selectedSubComponent][savedName] = [];
      });
      onShowToast?.({
        title: "Key activity added",
        description: `${savedName} was added.`,
        type: "success",
      });
      setNewKeyActivityName("");
      setSelectedKeyActivity(savedName);
      setSelectedIndicatorIndex(0);
      setSelectedSubActivityIndex(0);
      setKeyActivityMenuOpen(false);
      setShowAddKeyActivityInput(false);
      setEditingKeyActivityName("");
    } catch (err) {
      logTemplateCrudError("addKeyActivity", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const renameKeyActivity = async () => {
    const nextName = normalizeName(keyActivityDraft);
    if (!selectedComponent || !selectedSubComponent || !selectedKeyActivity || !nextName || nextName === selectedKeyActivity) return;
    if (keyActivityNames.includes(nextName)) {
      onShowToast?.({
        title: "Duplicate key activity",
        description: "Choose a different key activity name.",
        type: "error",
      });
      return;
    }
    try {
      const kaId = await templateMgmtService.getKeyActivityIdByName(selectedKeyActivity, selectedSubComponent, selectedComponent);
      await templateMgmtService.updateKeyActivity(kaId, { name: nextName });
      updateTemplate((nextTemplate) => {
        const subNode = nextTemplate.hierarchy[selectedComponent][selectedSubComponent];
        subNode[nextName] = subNode[selectedKeyActivity];
        delete subNode[selectedKeyActivity];
      });
      setSelectedKeyActivity(nextName);
      onShowToast?.({
        title: "Key activity renamed",
        description: `Key activity updated to ${nextName}.`,
        type: "success",
      });
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const deleteKeyActivity = async () => {
    if (!deleteTarget || deleteTarget.kind !== "keyActivity" || !selectedComponent || !selectedSubComponent) return;
    try {
      const kaId = await templateMgmtService.getKeyActivityIdByName(deleteTarget.label, selectedSubComponent, selectedComponent);
      await templateMgmtService.deleteKeyActivity(kaId);
      updateTemplate((nextTemplate) => {
        delete nextTemplate.hierarchy[selectedComponent][selectedSubComponent][deleteTarget.label];
      });
      onShowToast?.({
        title: "Key activity deleted",
        description: `${deleteTarget.label} was removed.`,
        type: "success",
      });
      setEditingKeyActivityName("");
      setDeleteTarget(null);
    } catch (err) {
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  // ========== PERFORMANCE INDICATOR & SUB ACTIVITIES (PERSISTED) ==========
  const addIndicator = async () => {
    const nextNo = normalizeIndicatorNo(newIndicatorNo);
    const nextText = normalizeName(newIndicatorText);
    if (!selectedComponent || !selectedSubComponent || !selectedKeyActivity) return;
    if (nextNo === "" || !nextText) return;
    if (indicatorItems.some((item) => String(item.no) === String(nextNo))) {
      onShowToast?.({
        title: "Duplicate No.",
        description: "That performance indicator number already exists here.",
        type: "error",
      });
      return;
    }
    try {
      const kaId = await templateMgmtService.getKeyActivityIdByName(selectedKeyActivity, selectedSubComponent, selectedComponent);
      const savedIndicator = await templateMgmtService.createPerformanceIndicator({
        key_activity_id: kaId,
        activity_no: nextNo,
        label: nextText,
        sort_order: indicatorItems.length + 1,
        is_active: true,
      });
      const savedNo = savedIndicator.activity_no ?? nextNo;
      const savedLabel = savedIndicator.label || nextText;
      // Use the saved PI values so local state mirrors Supabase after insert.
      updateTemplate((nextTemplate) => {
        nextTemplate.hierarchy[selectedComponent][selectedSubComponent][selectedKeyActivity].push({
          no: savedNo,
          performanceIndicator: savedLabel,
          subActivities: [],
        });
      });
      setNewIndicatorNo("");
      setNewIndicatorText("");
      setSelectedIndicatorIndex(indicatorItems.length);
      setSelectedSubActivityIndex(0);
      setIndicatorMenuOpen(false);
      setShowAddIndicatorInput(false);
      setEditingIndicatorIndex(null);
      onShowToast?.({
        title: "Performance indicator added",
        description: `No. ${savedNo} was added under ${selectedKeyActivity}.`,
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("addIndicator", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const saveIndicator = async () => {
    if (!selectedComponent || !selectedSubComponent || !selectedKeyActivity || !selectedIndicator) return;
    const nextNo = normalizeIndicatorNo(indicatorDraft.no);
    const nextText = normalizeName(indicatorDraft.performanceIndicator);
    if (nextNo === "" || !nextText) {
      onShowToast?.({
        title: "Missing indicator details",
        description: "Indicator No. and Performance Indicator are required.",
        type: "error",
      });
      return;
    }
    if (indicatorItems.some((item, index) => index !== selectedIndicatorIndex && String(item.no) === String(nextNo))) {
      onShowToast?.({
        title: "Duplicate No.",
        description: "Choose a different indicator number.",
        type: "error",
      });
      return;
    }
    try {
      const piRow = await templateMgmtService.getPerformanceIndicatorRowByNo(
        selectedIndicator.no,
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      if (!piRow) throw new Error(`Performance indicator not found in Supabase: ${selectedIndicator.no}`);
      const savedIndicator = await templateMgmtService.updatePerformanceIndicator(piRow.id, {
        activity_no: nextNo,
        label: nextText,
      });
      const savedNo = savedIndicator.activity_no ?? nextNo;
      const savedLabel = savedIndicator.label || nextText;
      updateTemplate((nextTemplate) => {
        const bucket = nextTemplate.hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] || [];
        const targetIndex = bucket.findIndex((item) => String(item.no) === String(selectedIndicator.no));
        if (targetIndex === -1) return;
        bucket[targetIndex] = {
          no: savedNo,
          performanceIndicator: savedLabel,
          subActivities: selectedIndicator.subActivities || [],
        };
      });
      onShowToast?.({
        title: "Indicator updated",
        description: `No. ${savedNo} was updated successfully.`,
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("saveIndicator", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const deleteIndicator = async () => {
    if (!deleteTarget || deleteTarget.kind !== "indicator" || !selectedComponent || !selectedSubComponent || !selectedKeyActivity) return;
    try {
      const targetItem = indicatorItems[deleteTarget.index];
      if (targetItem) {
        const piRow = await templateMgmtService.getPerformanceIndicatorRowByNo(
          targetItem.no,
          selectedKeyActivity,
          selectedSubComponent,
          selectedComponent,
        );
        if (!piRow) throw new Error(`Performance indicator not found in Supabase: ${targetItem.no}`);
        await templateMgmtService.deletePerformanceIndicator(piRow.id);
      }
      updateTemplate((nextTemplate) => {
        const bucket = nextTemplate.hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] || [];
        const targetIndex = bucket.findIndex((item) => String(item.no) === String(targetItem?.no));
        if (targetIndex !== -1) bucket.splice(targetIndex, 1);
      });
      onShowToast?.({
        title: "Indicator deleted",
        description: `No. ${deleteTarget.label} was removed.`,
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("deleteIndicator", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
    setEditingIndicatorIndex(null);
    setDeleteTarget(null);
  };

  const addSubActivity = async () => {
    const nextText = normalizeName(newSubActivityText);
    if (!selectedIndicator || !nextText) return;
    try {
      const keyActivityId = await templateMgmtService.getKeyActivityIdByName(
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const performanceIndicatorId = await templateMgmtService.getPerformanceIndicatorIdByNo(
        selectedIndicator.no,
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const subActivityPayload = {
        key_activity_id: keyActivityId,
        performance_indicator_id: performanceIndicatorId,
        name: nextText,
        code: `${selectedKeyActivity.toUpperCase().replace(/ /g, '_')}_SA_${Date.now()}`,
        sort_order: subActivityItems.length + 1,
        is_active: true,
      };
      // Pass both IDs because older Supabase schemas persist sub activities by
      // key_activity_id, while newer ones may use performance_indicator_id.
      const savedSubActivity = await templateMgmtService.createSubActivity(subActivityPayload);
      const savedName = savedSubActivity.name || nextText;
      updateTemplate((nextTemplate) => {
        const bucket = nextTemplate.hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] || [];
        const targetIndicator = bucket.find((item) => String(item.no) === String(selectedIndicator.no));
        if (!targetIndicator) return;
        targetIndicator.subActivities = [...(targetIndicator.subActivities || []), savedName];
      });
      setNewSubActivityText("");
      setSelectedSubActivityIndex(subActivityItems.length);
      setSubActivityMenuOpen(false);
      setShowAddSubActivityInput(false);
      setEditingSubActivityIndex(null);
      onShowToast?.({
        title: "Sub activity added",
        description: `Saved to Supabase with ID: ${savedSubActivity.id}`,
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("addSubActivity", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const saveSubActivity = async () => {
    const nextText = normalizeName(subActivityDraft);
    if (!selectedIndicator || !selectedSubActivity || !nextText) return;
    try {
      const keyActivityId = await templateMgmtService.getKeyActivityIdByName(
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const performanceIndicatorId = await templateMgmtService.getPerformanceIndicatorIdByNo(
        selectedIndicator.no,
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const saRow = await templateMgmtService.getSubActivityRowByName({
        keyActivityId,
        performanceIndicatorId,
        name: selectedSubActivity,
      });
      if (!saRow || saRow.length === 0) throw new Error(`Sub activity not found in Supabase: ${selectedSubActivity}`);
      const savedSubActivity = await templateMgmtService.updateSubActivity(saRow[0].id, { name: nextText });
      const savedName = savedSubActivity.name || nextText;
      updateTemplate((nextTemplate) => {
        const bucket = nextTemplate.hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] || [];
        const targetIndicator = bucket.find((item) => String(item.no) === String(selectedIndicator.no));
        const targetIndex = targetIndicator?.subActivities?.findIndex((item) => item === selectedSubActivity) ?? -1;
        if (targetIndex !== -1) targetIndicator.subActivities[targetIndex] = savedName;
      });
      onShowToast?.({
        title: "Sub activity updated",
        description: "The selected sub activity was updated successfully.",
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("saveSubActivity", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
  };

  const deleteSubActivity = async () => {
    if (!deleteTarget || deleteTarget.kind !== "subActivity" || !selectedIndicator) return;
    try {
      const keyActivityId = await templateMgmtService.getKeyActivityIdByName(
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const performanceIndicatorId = await templateMgmtService.getPerformanceIndicatorIdByNo(
        selectedIndicator.no,
        selectedKeyActivity,
        selectedSubComponent,
        selectedComponent,
      );
      const targetName = subActivityItems[deleteTarget.index];
      if (targetName) {
        const saRow = await templateMgmtService.getSubActivityRowByName({
          keyActivityId,
          performanceIndicatorId,
          name: targetName,
        });
        if (!saRow || saRow.length === 0) throw new Error(`Sub activity not found in Supabase: ${targetName}`);
        await templateMgmtService.deleteSubActivity(saRow[0].id);
      }
      updateTemplate((nextTemplate) => {
        const bucket = nextTemplate.hierarchy[selectedComponent]?.[selectedSubComponent]?.[selectedKeyActivity] || [];
        const targetIndicator = bucket.find((item) => String(item.no) === String(selectedIndicator.no));
        const targetIndex = targetIndicator?.subActivities?.findIndex((item) => item === targetName) ?? -1;
        if (targetIndex !== -1) targetIndicator.subActivities.splice(targetIndex, 1);
      });
      onShowToast?.({
        title: "Sub activity deleted",
        description: "The selected sub activity was removed.",
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("deleteSubActivity", err);
      onShowToast?.({ title: "Error", description: err.message, type: "error" });
    }
    setEditingSubActivityIndex(null);
    setDeleteTarget(null);
  };

  // For component delete modal trigger (kept original name)
  const setComponentDeleteTarget = (name) => setDeleteTarget({ kind: "component", label: name });

  const handleResetTemplate = async () => {
    const resetSnapshot = cloneTemplateData(defaultTemplateData || templateData);
    setIsResettingTemplate(true);

    try {
      await templateMgmtService.restoreTemplateSnapshot(resetSnapshot);
      onResetTemplate?.(resetSnapshot);
      setResetDialogOpen(false);
      onShowToast?.({
        title: "Template reset",
        description: "The template was restored to the saved default snapshot.",
        type: "success",
      });
    } catch (err) {
      logTemplateCrudError("resetTemplate", err);
      onShowToast?.({
        title: "Reset failed",
        description: err.message,
        type: "error",
      });
    } finally {
      setIsResettingTemplate(false);
    }
  };

  const handleSetCurrentAsDefault = () => {
    const defaultSnapshot = cloneTemplateData(templateData || { hierarchy: {} });
    if (Object.keys(defaultSnapshot?.hierarchy || {}).length === 0) {
      onShowToast?.({
        title: "Default not updated",
        description: "There is no template data to save as default.",
        type: "error",
      });
      return;
    }

    onSetDefaultTemplate?.(defaultSnapshot);
    setSetDefaultDialogOpen(false);
    onShowToast?.({
      title: "Default updated",
      description: "The current dropdowns are now used by Reset to Default.",
      type: "success",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Manage Template
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Update the classification hierarchy used by the Submit Entry form.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={secondaryButtonClass}
            onClick={() => setSetDefaultDialogOpen(true)}
          >
            <Save size={16} />
            Set as Default
          </Button>
          <Button
            type="button"
            className={compactGradientButtonClass}
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw size={16} />
            Reset to Default
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className={panelClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-slate-900">Component</CardTitle>
            <p className={getPanelDescriptionClass(hasSubComponentSelected)}>
              Select and manage the main component used in this template.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => setComponentMenuOpen((prev) => !prev)}
              className={dropdownTriggerClass}
            >
              <span className="truncate">{selectedComponent || "N/A"}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${componentMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {componentMenuOpen && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {componentNames.map((name) => (
                    <div
                      key={name}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                        selectedComponent === name
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {editingComponentName === name ? (
                        <div className="min-w-0 flex-1">
                          <Input
                            value={componentDraft}
                            onChange={(event) => setComponentDraft(event.target.value)}
                            className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComponent(name);
                            setEditingComponentName("");
                          }}
                          className="min-w-0 flex-1 text-left text-sm text-slate-700"
                        >
                          <span className="block truncate">{name}</span>
                        </button>
                      )}
                      {selectedComponent === name && (
                        <>
                          {editingComponentName === name ? (
                            <>
                              <button
                                type="button"
                                onClick={renameComponent}
                                className={saveInlineButtonClass}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingComponentName("");
                                  setComponentDraft(selectedComponent);
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Cancel rename"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setComponentDraft(name);
                                  setEditingComponentName(name);
                                  setShowAddComponentInput(false);
                                }}
                                className={editActionIconButtonClass}
                                aria-label="Rename component"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setComponentDeleteTarget(name)}
                                className={deleteActionIconButtonClass}
                                aria-label="Delete component"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddComponentInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddComponentInput(true);
                        setEditingComponentName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Component
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newComponentName}
                        onChange={(event) => setNewComponentName(event.target.value)}
                        placeholder="New component"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={addComponent}
                          className={`flex-1 ${primaryButtonClass}`}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddComponentInput(false);
                            setNewComponentName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={getLockedPanelClass(hasComponentSelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasComponentSelected)}>
              Sub Component
            </CardTitle>
            <p className={getPanelDescriptionClass(hasComponentSelected)}>
              Select and manage the sub component under the chosen component.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasComponentSelected && setSubComponentMenuOpen((prev) => !prev)}
              disabled={!hasComponentSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {hasSubComponentSelected
                  ? getFallbackLabel(selectedSubComponent)
                  : "N/A"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${subComponentMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {subComponentMenuOpen && hasComponentSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {subComponentNames.length === 0 ? (
                    <div className={getEmptyStateClass(hasComponentSelected)}>
                      N/A
                    </div>
                  ) : (
                    subComponentNames.map((name) => (
                      <div
                        key={name}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedSubComponent === name
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingSubComponentName === name ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={subComponentDraft}
                              onChange={(event) => setSubComponentDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubComponent(name);
                              setEditingSubComponentName("");
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">
                              {getFallbackLabel(name)}
                            </span>
                          </button>
                        )}
                        {selectedSubComponent === name && (
                          <>
                            {editingSubComponentName === name ? (
                              <>
                                <button
                                  type="button"
                                  onClick={renameSubComponent}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubComponentName("");
                                    setSubComponentDraft(selectedSubComponent);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubComponentDraft(name);
                                    setEditingSubComponentName(name);
                                    setShowAddSubComponentInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename sub component"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "subComponent",
                                      label: getFallbackLabel(name),
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete sub component"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddSubComponentInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubComponentInput(true);
                        setEditingSubComponentName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Sub Component
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newSubComponentName}
                        onChange={(event) => setNewSubComponentName(event.target.value)}
                        placeholder="New sub component"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addSubComponent} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddSubComponentInput(false);
                            setNewSubComponentName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AdminDeleteTemplateItemModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemType={
          deleteTarget?.kind === "component"
            ? "Component"
            : deleteTarget?.kind === "subComponent"
              ? "Sub Component"
              : deleteTarget?.kind === "keyActivity"
                ? "Key Activity"
                : deleteTarget?.kind === "indicator"
                  ? "Performance Indicator"
                  : deleteTarget?.kind === "subActivity"
                    ? "Sub Activity"
                    : "Template Item"
        }
        itemLabel={deleteTarget?.label || ""}
        onConfirm={() => {
          if (deleteTarget?.kind === "component") deleteComponent();
          if (deleteTarget?.kind === "subComponent") deleteSubComponent();
          if (deleteTarget?.kind === "keyActivity") deleteKeyActivity();
          if (deleteTarget?.kind === "indicator") deleteIndicator();
          if (deleteTarget?.kind === "subActivity") deleteSubActivity();
        }}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className={getLockedPanelClass(hasSubComponentSelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasSubComponentSelected)}>
              Key Activity
            </CardTitle>
            <p className={getPanelDescriptionClass(hasSubComponentSelected)}>
              Select and manage the key activity under the chosen sub component.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasSubComponentSelected && setKeyActivityMenuOpen((prev) => !prev)}
              disabled={!hasSubComponentSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {hasKeyActivitySelected ? selectedKeyActivity : "N/A"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${keyActivityMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {keyActivityMenuOpen && hasSubComponentSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {keyActivityNames.length === 0 ? (
                    <div className={getEmptyStateClass(hasSubComponentSelected)}>
                      N/A
                    </div>
                  ) : (
                    keyActivityNames.map((name) => (
                      <div
                        key={name}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedKeyActivity === name
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingKeyActivityName === name ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={keyActivityDraft}
                              onChange={(event) => setKeyActivityDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKeyActivity(name);
                              setEditingKeyActivityName("");
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">{name}</span>
                          </button>
                        )}
                        {selectedKeyActivity === name && (
                          <>
                            {editingKeyActivityName === name ? (
                              <>
                                <button
                                  type="button"
                                  onClick={renameKeyActivity}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKeyActivityName("");
                                    setKeyActivityDraft(selectedKeyActivity);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKeyActivityDraft(name);
                                    setEditingKeyActivityName(name);
                                    setShowAddKeyActivityInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename key activity"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "keyActivity",
                                      label: name,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete key activity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddKeyActivityInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddKeyActivityInput(true);
                        setEditingKeyActivityName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Key Activity
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newKeyActivityName}
                        onChange={(event) => setNewKeyActivityName(event.target.value)}
                        placeholder="New key activity"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addKeyActivity} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddKeyActivityInput(false);
                            setNewKeyActivityName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={getLockedPanelClass(hasKeyActivitySelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasKeyActivitySelected)}>
              Performance Indicator
            </CardTitle>
            <p className={getPanelDescriptionClass(hasKeyActivitySelected)}>
              Select and manage the performance indicator under the chosen key activity.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasKeyActivitySelected && setIndicatorMenuOpen((prev) => !prev)}
              disabled={!hasKeyActivitySelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {selectedIndicator ? `No. ${selectedIndicator.no}` : "N/A"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${indicatorMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {indicatorMenuOpen && hasKeyActivitySelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {indicatorItems.length === 0 ? (
                    <div className={getEmptyStateClass(hasKeyActivitySelected)}>
                      N/A
                    </div>
                  ) : (
                    indicatorItems.map((item, index) => (
                      <div
                        key={`${item.no}-${index}`}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedIndicatorIndex === index
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingIndicatorIndex === index ? (
                          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[110px_1fr]">
                            <Input
                              value={indicatorDraft.no}
                              onChange={(event) =>
                                setIndicatorDraft((prev) => ({
                                  ...prev,
                                  no: event.target.value,
                                }))
                              }
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                            <Input
                              value={indicatorDraft.performanceIndicator}
                              onChange={(event) =>
                                setIndicatorDraft((prev) => ({
                                  ...prev,
                                  performanceIndicator: event.target.value,
                                }))
                              }
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndicatorIndex(index);
                              setEditingIndicatorIndex(null);
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="text-sm font-medium text-slate-800">No. {item.no}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.performanceIndicator}
                            </p>
                          </button>
                        )}
                        {selectedIndicatorIndex === index && (
                          <>
                            {editingIndicatorIndex === index ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    saveIndicator();
                                    setEditingIndicatorIndex(null);
                                  }}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingIndicatorIndex(null);
                                    setIndicatorDraft({
                                      no: String(item.no ?? ""),
                                      performanceIndicator: item.performanceIndicator || "",
                                    });
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedIndicatorIndex(index);
                                    setIndicatorDraft({
                                      no: String(item.no ?? ""),
                                      performanceIndicator: item.performanceIndicator || "",
                                    });
                                    setEditingIndicatorIndex(index);
                                    setShowAddIndicatorInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename performance indicator"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "indicator",
                                      label: String(item.no),
                                      index,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete performance indicator"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddIndicatorInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddIndicatorInput(true);
                        setEditingIndicatorIndex(null);
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Performance Indicator
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr]">
                        <Input
                          value={newIndicatorNo}
                          onChange={(event) => setNewIndicatorNo(event.target.value)}
                          placeholder="No."
                          className={inputClass}
                        />
                        <Input
                          value={newIndicatorText}
                          onChange={(event) => setNewIndicatorText(event.target.value)}
                          placeholder="New performance indicator"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={addIndicator} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddIndicatorInput(false);
                            setNewIndicatorNo("");
                            setNewIndicatorText("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Card
          className={`${getLockedPanelClass(hasIndicatorSelected)} w-full md:max-w-[calc(50%-0.75rem)]`}
        >
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasIndicatorSelected)}>
              Sub Activities
            </CardTitle>
            <p className={getPanelDescriptionClass(hasIndicatorSelected)}>
              Select and manage the sub activities under the chosen performance indicator.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasIndicatorSelected && setSubActivityMenuOpen((prev) => !prev)}
              disabled={!hasIndicatorSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {selectedSubActivity || "N/A"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${subActivityMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {subActivityMenuOpen && hasIndicatorSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {subActivityItems.length === 0 ? (
                    <div className={emptyStateClass}>
                      N/A
                    </div>
                  ) : (
                    subActivityItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedSubActivityIndex === index
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingSubActivityIndex === index ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={subActivityDraft}
                              onChange={(event) => setSubActivityDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubActivityIndex(index);
                              setEditingSubActivityIndex(null);
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">{item}</span>
                          </button>
                        )}
                        {selectedSubActivityIndex === index && (
                          <>
                            {editingSubActivityIndex === index ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    saveSubActivity();
                                    setEditingSubActivityIndex(null);
                                  }}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubActivityIndex(null);
                                    setSubActivityDraft(selectedSubActivity);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSubActivityIndex(index);
                                    setSubActivityDraft(item);
                                    setEditingSubActivityIndex(index);
                                    setShowAddSubActivityInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename sub activity"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "subActivity",
                                      label: item,
                                      index,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete sub activity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddSubActivityInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubActivityInput(true);
                        setEditingSubActivityIndex(null);
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Sub Activity
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newSubActivityText}
                        onChange={(event) => setNewSubActivityText(event.target.value)}
                        placeholder="New sub activity"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addSubActivity} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddSubActivityInput(false);
                            setNewSubActivityText("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset template to default?</DialogTitle>
            <DialogDescription>
              {isResettingTemplate
                ? "Please wait while resetting the template. This may take a moment."
                : "This will restore the template to the saved correct version and update Supabase to match it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isResettingTemplate}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleResetTemplate}
              className={primaryButtonClass}
              disabled={isResettingTemplate}
            >
              {isResettingTemplate ? "Resetting..." : "Reset to Default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setDefaultDialogOpen} onOpenChange={setSetDefaultDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set current template as default?</DialogTitle>
            <DialogDescription>
              This will make the current dropdowns the saved version used by Reset to Default.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSetCurrentAsDefault}
              className={primaryButtonClass}
            >
              Set as Default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
