import express from 'express';
import { getEntries, deleteEntry, updateEntry } from '../controllers/entryController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const entriesRoutes = express.Router();

entriesRoutes.use(authMiddleware);

entriesRoutes.get('/', getEntries);
entriesRoutes.delete('/:id', deleteEntry);
entriesRoutes.put('/:id', updateEntry);

export default entriesRoutes;