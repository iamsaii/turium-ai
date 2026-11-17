export interface Item {
  id: number;
  type: 'note' | 'url';
  title: string;
  sourceUrl?: string | null;
  rawContent: string;
  status: 'processing' | 'ready' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  chunkCount: number;
}

export interface Chunk {
  id: number;
  itemId: number;
  chunkIndex: number;
  content: string;
  embedding: Buffer;
}

export interface IngestRequestDTO {
  type: 'note' | 'url';
  content: string;
  title?: string;
}

export interface SourceSnippet {
  id: number;
  itemId: number;
  title: string;
  sourceUrl?: string | null;
  content: string;
  similarity: number;
}

export interface QueryResponseDTO {
  answer: string;
  sources: SourceSnippet[];
}
