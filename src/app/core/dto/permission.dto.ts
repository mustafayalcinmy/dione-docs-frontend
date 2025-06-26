export enum PermissionStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected'
}

export interface PermissionResponseFromAPI {
  id: string;
  document_id: string;
  user_id: string;
  user_email: string;
  access_type: 'viewer' | 'editor' | 'admin';
  status: PermissionStatus;
  shared_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserDocumentPermissionResponse {
  access_type: 'viewer' | 'editor' | 'admin';
}

export interface InvitationDetailResponse {
  invitation_id: string;
  document_id: string;
  document_title: string;
  shared_by_email: string;
  access_type: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}