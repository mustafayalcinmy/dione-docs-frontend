import { Op } from 'quill-delta';

export interface QuillDelta {
  ops: Op[];
}

export interface DocumentResponseFromAPI {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  version: number;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  content?: string;
}

export interface DocumentListResponseFromAPI {
  owned: DocumentResponseFromAPI[];
  shared: DocumentResponseFromAPI[];
}

export interface DocumentPayload {
  id?: string;
  title: string;
  description?: string;
  owner_id?: string;
  version?: number;
  is_public?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  content: QuillDelta;
}

export interface DocumentListItem {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  version: number;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CombinedDocumentList {
  owned: DocumentPayload[];
  shared: DocumentPayload[];
  all: DocumentPayload[];
  recent: DocumentPayload[];
}