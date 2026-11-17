import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_PATH: process.env.DATABASE_PATH || 'data.db',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  EMBEDDING_DIM: 768,
  EMBEDDING_MODEL: 'text-embedding-004',
  CHAT_MODEL: 'gemini-2.0-flash',
  TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.30,
  MAX_TEXT_SIZE_BYTES: 50000,
  FETCH_TIMEOUT_MS: 10000,
  CHUNK_MAX_CHARS: 800,
  CHUNK_MIN_CHARS: 100,
  CHUNK_OVERLAP_CHARS: 100,
};
