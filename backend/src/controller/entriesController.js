import * as entryService from '../services/entriesService.js';
import { isSubmissionWindowOpen } from '../utils/submissionWindow.js';

export const getEntries = async (req, res) => {
  try {
    const data = await entryService.getEntriesByUser(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    await entryService.deleteEntryById(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEntry = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body required" });
    }

    const { submissionWindow, titleOfActivities, ...rest } = req.body;

    if (!isSubmissionWindowOpen(submissionWindow)) {
      return res.status(403).json({ error: 'Editing closed' });
    }

    const updates = {
      ...rest,
      ...(titleOfActivities && { title_of_activities: titleOfActivities }),
      ...(req.body.unitCost !== undefined && { unit_cost: req.body.unitCost }),
      ...(req.body.planningYear && { planning_year: req.body.planningYear })
    };

    const data = await entryService.updateEntryById(
      req.params.id,
      updates,
      req.user.id
    );

    res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};