import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { HttpError } from './errors.js';
import { saveNote, saveUrl } from './ingest.js';
import { listItems, deleteItem } from './db.js';
import { log } from './log.js';
import { answerQuestion } from './query.js';
import { parseIngest, parseQuestion } from './validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

export function createApp() {
  const app = express();
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      log('info', 'request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });
  app.use(express.json({ limit: '200kb' }));

  app.post('/ingest', wrap(async (req, res) => {
    const input = parseIngest(req.body);
    const item = input.type === 'note' ? await saveNote(input) : await saveUrl(input.url);
    res.status(201).json({ item });
  }));

  app.get('/items', wrap(async (_req, res) => {
    res.json({ items: listItems() });
  }));

  app.delete('/items/:id', wrap(async (req, res) => {
    if (!deleteItem(req.params.id)) throw new HttpError(404, 'No item with that id.');
    res.status(204).end();
  }));

  app.post('/query', wrap(async (req, res) => {
    const question = parseQuestion(req.body);
    res.json(await answerQuestion(question));
  }));

  const dist = path.resolve(here, '../../client/dist');
  app.use(express.static(dist));
  app.use((req, res) => {
    if (req.method !== 'GET') {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.sendFile(path.join(dist, 'index.html'), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Not found.' });
    });
  });

  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof SyntaxError || err.type === 'entity.too.large') {
      const status = err.type === 'entity.too.large' ? 413 : 400;
      const message = status === 413 ? 'That request is too big.' : 'Body was not valid JSON.';
      res.status(status).json({ error: message });
      return;
    }
    if (!(err instanceof HttpError)) {
      log('error', 'unhandled', { message: err.message, stack: err.stack });
    }
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Something broke on our side.';
    res.status(status).json({ error: message });
  });

  return app;
}

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const invokedDirectly = process.argv[1]
  && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const port = Number(process.env.PORT) || 8787;
  createApp().listen(port, () => {
    log('info', 'listening', { port });
    if (!process.env.OPENAI_API_KEY) log('warn', 'OPENAI_API_KEY is empty; save and ask will fail');
  });
}
