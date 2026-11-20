# Inbox

Save a note or a link, then ask a question about what you saved.

One person, one SQLite file. No accounts.

## Run it

Node 24 (built-in `node:sqlite`). An OpenAI key.

```
Copy-Item server\.env.example server\.env
```

Put the key in `server/.env`. Then, from this folder:

```
npm install
npm test
npm run dev
```

Open http://localhost:5173.

`npm start` builds the client and serves it from the API on port 8787.

Delete `server/data/inbox.db` if you want an empty inbox again.

## What a question does

Notes and pages are split into chunks of about 1,800 characters, with ~220 characters of overlap so a sentence on the boundary isn't lost. Each chunk is embedded with `text-embedding-3-small` and stored next to the text. The question is embedded the same way. Every chunk is scored in process with cosine similarity, and the top few go to `gpt-6-luna` with instructions to answer only from those excerpts and cite them as [1], [2]. The UI shows the excerpts too, so a bad citation is still checkable.

Below a similarity of 0.22 the model isn't called. That number is a guess. Move it in `server/src/query.js` if the inbox starts refusing questions it should answer, or answering ones it shouldn't.

SQLite is the whole store because there's one user and the vectors are small. Scoring every chunk in JavaScript gets silly somewhere in the tens of thousands of chunks. That's when I'd put the vectors in sqlite-vec or Postgres and stop looping. Saving is synchronous on purpose: a note comes back when it's actually searchable. A long page can sit there for a few seconds. A queue is the first thing I'd add if anyone else used this.

Pages that only render in a browser come back thin. I don't run one.

## API

`POST /ingest`

```json
{ "type": "note", "content": "buy oat milk" }
{ "type": "url", "url": "https://example.com/post" }
```

`201` `{ "item": { "id", "sourceType", "title", "url", "preview", "body", "chunkCount", "createdAt" } }`

`GET /items` → `{ "items": [ ...same shape ] }`

`POST /query` `{ "question": "what did I say about milk?" }` → `{ "answer", "sources" }`

`sources` is in citation order. `[1]` in the answer is `sources[0]`. Each source has `chunkId`, `itemId`, `sourceType`, `title`, `url`, `text`, and `score` (cosine).

`DELETE /items/:id` → `204`

Errors are `{ "error": "..." }`. `400` bad input, `404` unknown id, `413` too big, `422` a page that isn't usable text, `502` when the fetch or the model fails. Logs are one JSON object per line on stdout. Bodies aren't logged.

The list endpoint returns the full text. That's convenient until the file gets big.
