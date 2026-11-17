import { describe, it, expect } from 'vitest';
import { serializeEmbedding, deserializeEmbedding, cosineSimilarity } from '../src/lib/vector.js';

describe('vector math & serialization', () => {
  it('serializes 768 floats to a 3072-byte Buffer', () => {
    const vec = new Array(768).fill(0.5);
    const buf = serializeEmbedding(vec);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBe(3072);
  });

  it('throws error when serializing vector with invalid dimension', () => {
    expect(() => serializeEmbedding([0.1, 0.2])).toThrow('Invalid embedding dimension');
  });

  it('deserializes a Buffer back to Float32Array accurately', () => {
    const vec = new Array(768).fill(0).map((_, i) => i * 0.001);
    const buf = serializeEmbedding(vec);
    const decoded = deserializeEmbedding(buf);

    expect(decoded).toBeInstanceOf(Float32Array);
    expect(decoded.length).toBe(768);
    for (let i = 0; i < 768; i++) {
      expect(decoded[i]).toBeCloseTo(vec[i], 5);
    }
  });

  it('deserializes safely with unaligned byteOffset', () => {
    const vec = new Array(768).fill(0.123);
    const standardBuf = serializeEmbedding(vec);
    
    // Create an unaligned buffer: 1-byte padding + 3072 bytes + 1-byte padding
    const unalignedContainer = Buffer.alloc(3074);
    standardBuf.copy(unalignedContainer, 1);
    const unalignedSlice = unalignedContainer.subarray(1, 3073);
    expect(unalignedSlice.byteOffset % 4).not.toBe(0);

    const decoded = deserializeEmbedding(unalignedSlice);
    expect(decoded.length).toBe(768);
    expect(decoded[0]).toBeCloseTo(0.123, 5);
  });

  it('computes cosine similarity accurately for identical, orthogonal, and opposing vectors', () => {
    const a = new Float32Array(768).fill(1.0);
    const b = new Float32Array(768).fill(1.0);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);

    const c = new Float32Array(768).fill(-1.0);
    expect(cosineSimilarity(a, c)).toBeCloseTo(-1.0, 5);

    const ortho1 = new Float32Array(768);
    const ortho2 = new Float32Array(768);
    ortho1[0] = 1.0;
    ortho2[1] = 1.0;
    expect(cosineSimilarity(ortho1, ortho2)).toBeCloseTo(0.0, 5);
  });

  it('throws error when cosine similarity vectors have mismatched lengths', () => {
    const a = new Float32Array(768);
    const b = new Float32Array(512);
    expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch');
  });
});
