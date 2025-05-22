// Path: dione-docs-frontend/src/app/core/dto/document.dto.ts
import { Op } from 'quill-delta'; // Quill'in Op tipini import et

/**
 * Bir dizi Quill Op'undan oluşan Quill Delta formatını temsil eder.
 */
export interface QuillDelta {
  ops: Op[];
}

/**
 * Backend'den gelen ham doküman yanıtı için arayüz.
 * `content` alanı JSON string olarak beklenir.
 */
export interface DocumentResponseFromAPI {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  version: number;
  is_public: boolean;
  status: string;
  created_at: string; // ISO Date string
  updated_at: string; // ISO Date string
  content?: string; // Backend'den JSON string olarak gelir
}

/**
 * Backend'den kullanıcı doküman listesi alındığında beklenen yanıt yapısı.
 */
export interface DocumentListResponseFromAPI {
  owned: DocumentResponseFromAPI[];
  shared: DocumentResponseFromAPI[];
}

/**
 * Frontend'de kullanılacak, backend'den gelen yanıttan türetilmiş
 * genel doküman istek/yanıt yapısı.
 */
export interface DocumentPayload {
  id?: string; // Backend'den geldiğinde string (UUID) olacak
  title: string;
  description?: string;
  owner_id?: string; // Backend'den geldiğinde string (UUID) olacak
  version?: number;
  is_public?: boolean;
  status?: string;
  created_at?: string; // ISO Date string
  updated_at?: string; // ISO Date string
  content: QuillDelta; // Her zaman parse edilmiş QuillDelta olacak
}

/**
 * Özellikle doküman listeleme ve temel bilgiler için daha hafif bir DTO.
 * `content` alanı olmadan.
 */
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

/**
 * MainPageComponent'te kullanılmak üzere birleştirilmiş doküman listesi yapısı.
 */
export interface CombinedDocumentList {
  owned: DocumentPayload[];
  shared: DocumentPayload[];
  all: DocumentPayload[]; // Tüm dokümanların birleşik listesi
  recent: DocumentPayload[]; // Son kullanılan dokümanlar
}