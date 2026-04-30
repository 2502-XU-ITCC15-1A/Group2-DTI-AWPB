import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import entriesRoutes from './routes/entriesRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({path: path.resolve(__dirname, '../.env')});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//for testing only
app.use((req, res, next) => {
  // bypass auth for testing entries
  req.user = { id: '2c7da4b9-85ce-44dd-a5e4-18a3cb73acf2', role: 'admin' };
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/entries', entriesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📦 Entries API: http://localhost:${PORT}/api/entries`);
});
