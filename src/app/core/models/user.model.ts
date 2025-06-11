export enum AccessType {
  Viewer = 'viewer',
  Editor = 'editor',
  Admin = 'admin',
  Owner = 'owner'
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}