export function serializeEmbedding(vec: number[] | Float32Array): Buffer {
  if (!vec || vec.length !== 768) {
    throw new Error(`Invalid embedding dimension: expected 768, got ${vec ? vec.length : 'undefined'}`);
  }
  const floatArray = vec instanceof Float32Array ? vec : new Float32Array(vec);
  return Buffer.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength);
}

export function deserializeEmbedding(buf: Buffer): Float32Array {
  if (buf.byteLength !== 3072) {
    throw new Error(`Invalid buffer length: expected 3072 bytes, got ${buf.byteLength}`);
  }
  const alignedBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(alignedBuffer);
}

export const serializeVector = serializeEmbedding;
export const deserializeVector = deserializeEmbedding;

export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`);
  }
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
