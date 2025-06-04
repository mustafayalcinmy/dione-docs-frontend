export enum PermissionStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected'
}

export interface PermissionResponseFromAPI {
  id: string; // Permission ID
  document_id: string;
  user_id: string;
  user_email: string;
  access_type: 'viewer' | 'editor' | 'admin'; // 'admin' de eklendi, backend'den gelebilir
  status: PermissionStatus;
  shared_by?: string; // Daveti gönderenin e-postası (backend'den gelirse)
  created_at: string;
  updated_at: string;
}

// Mesaj yanıtları için genel bir arayüz (backend'deki MessageResponse)
export interface MessageResponse {
  message: string;
}