import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
const db = new PrismaClient();
try {
  await db.$connect();
  console.log('PostgreSQL: connected');
} catch (e) {
  console.log(
    `PostgreSQL: unavailable (${e.errorCode || e.code || e.name}). Verify password, IPv4 pooler and network connectivity.`,
  );
} finally {
  await db.$disconnect();
}
const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: buckets, error } = await storage.storage.listBuckets();
if (error) console.log('Supabase Storage: access failed');
else {
  console.log(`Supabase Storage: connected (${buckets.length} buckets)`);
  if (
    process.argv.includes('--configure') &&
    !buckets.some((b) => b.name === process.env.SUPABASE_STORAGE_BUCKET)
  ) {
    const { error: e } = await storage.storage.createBucket(process.env.SUPABASE_STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    console.log(e ? 'Private bucket: creation failed' : 'Private bucket: created');
  }
}
const res = await fetch(process.env.NVIDIA_BASE_URL + '/models', {
  headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
  signal: AbortSignal.timeout(20000),
});
const models = await res.json();
console.log(`NVIDIA model directory: HTTP ${res.status}`);
const ids = (models.data || []).map((m) => m.id);
const model =
  process.env.NVIDIA_CHAT_MODEL ||
  ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'].find(
    (id) => ids.includes(id),
  );
console.log('NVIDIA candidate:', model || 'No candidate found; specify NVIDIA_CHAT_MODEL.');
if (model) {
  const chat = await fetch(process.env.NVIDIA_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with only the word connected.' }],
      max_tokens: 8,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(45000),
  });
  console.log(`NVIDIA chat: HTTP ${chat.status}`);
  if (chat.ok && process.argv.includes('--configure')) {
    const env = readFileSync('.env', 'utf8').replace(
      /^NVIDIA_CHAT_MODEL=.*$/m,
      `NVIDIA_CHAT_MODEL=${model}`,
    );
    writeFileSync('.env', env);
    console.log('Verified chat model saved to ignored server environment.');
  }
}
const embedding = await fetch(process.env.NVIDIA_BASE_URL + '/embeddings', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.NVIDIA_EMBEDDING_MODEL,
    input: ['FinSight synthetic integration verification.'],
    input_type: 'query',
    encoding_format: 'float',
    ...(process.env.NVIDIA_EMBEDDING_MODEL !== 'nvidia/nv-embedqa-e5-v5'
      ? { dimensions: 1024 }
      : {}),
  }),
  signal: AbortSignal.timeout(45000),
});
const result = await embedding.json();
console.log(
  `NVIDIA embeddings: HTTP ${embedding.status}, dimensions ${result.data?.[0]?.embedding?.length || 0}`,
);
