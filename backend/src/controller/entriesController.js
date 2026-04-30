import * as entryService from '../services/entryService.js';
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
    const submissionWindow = req.body.submissionWindow;

    if (!isSubmissionWindowOpen(submissionWindow)) {
      return res.status(403).json({ error: 'Editing closed' });
    }

    const data = await entryService.updateEntry(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};