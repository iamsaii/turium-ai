import dotenv from 'dotenv';
dotenv.config();

export const PORT = parseInt(process.env.PORT || '3000', 10);
export const DATABASE_PATH = process.env.DATABASE_PATH || 'data.db';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || '768', 10);
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
export const CHAT_MODEL = process.env.CHAT_MODEL || 'gemini-2.5-flash';
export const TOP_K = 5;
export const SIMILARITY_THRESHOLD = 0.30;
export const MAX_TEXT_SIZE_BYTES = 50000;
export const FETCH_TIMEOUT_MS = 10000;
export const CHUNK_MAX_CHARS = 800;
export const CHUNK_MIN_CHARS = 100;
export const CHUNK_OVERLAP_CHARS = 100;

export const config = {
  PORT,
  DATABASE_PATH,
  GEMINI_API_KEY,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  CHAT_MODEL,
  TOP_K,
  SIMILARITY_THRESHOLD,
  MAX_TEXT_SIZE_BYTES,
  FETCH_TIMEOUT_MS,
  CHUNK_MAX_CHARS,
  CHUNK_MIN_CHARS,
  CHUNK_OVERLAP_CHARS,
};
