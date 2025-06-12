
import { Op } from 'quill-delta';

export interface ChatMessage {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: string; 
  updated_at: string; 
  user: ChatMessageUser;
}

export interface ChatMessageUser {
  ID: string;
  Username: string;
  Email: string;
  ProfileImage?: string; 
}

export interface NewChatMessage {
  content: string;
}