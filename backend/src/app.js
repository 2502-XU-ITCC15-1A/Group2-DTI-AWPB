import express from 'express';
import cors from 'cors';
import entriesRoutes from './routes/entriesRoutes';

const app = express();

app.use(express.json());
app.use(cors());

app.use('/api/entries', entriesRoutes)

export default app;
