import express from 'express';
import { getEntries, deleteEntry, updateEntry } from '../controller/entriesController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const entriesRoutes = express.Router();

entriesRoutes.use(authMiddleware);
/*entriesRoutes.use((req, res, next) => { //temp for testing
  req.user = { id: '2c7da4b9-85ce-44dd-a5e4-18a3cb73acf2', role: 'admin'};
  next();
})*/

entriesRoutes.get('/', getEntries);
entriesRoutes.delete('/:id', deleteEntry);
entriesRoutes.put('/:id', updateEntry);

export default entriesRoutes;