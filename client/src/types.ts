export type ItemType = 'note' | 'url';
export type ItemStatus = 'processing' | 'ready' | 'failed';

export interface Item {
  id: number;
  type: ItemType;
  title: string;
  sourceUrl?: string | null;
  status: ItemStatus;
  errorMessage?: string | null;
  createdAt: string;
  chunkCount: number;
}

export interface IngestRequestDTO {
  type: ItemType;
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

export type IngestTab = 'note' | 'url';
