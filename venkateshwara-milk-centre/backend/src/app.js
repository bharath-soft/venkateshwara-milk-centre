import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import farmers from './routes/farmers.js';
import collections from './routes/collections.js';
import { authenticate, notFound, errorHandler } from './middleware.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: '50kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/me', authenticate, (req, res) => res.json(req.user));
app.use('/api/farmers', farmers);
app.use('/api/collections', collections);
app.use(notFound);
app.use(errorHandler);

app.listen(process.env.PORT || 4000, () => console.log('API running'));
