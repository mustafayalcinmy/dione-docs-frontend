import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  QuillDelta,

  DocumentPayload,
  DocumentResponseFromAPI,
  DocumentListResponseFromAPI,
  CombinedDocumentList
} from '../dto/document.dto';
import { PermissionResponseFromAPI, MessageResponse, UserDocumentPermissionResponse } from '../dto/permission.dto';
import { Op } from 'quill-delta';
@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private readonly API_URL = 'http://127.0.0.1:8080/api/v1/documents';
  private readonly API_BASE_URL = 'http://127.0.0.1:8080/api/v1';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private mapResponseToPayload(response: DocumentResponseFromAPI): DocumentPayload {
    let parsedContent: QuillDelta = { ops: [{ insert: '\n' }] };

    if (response.content) {
      try {
        let decodedJsonString: string;
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          const binaryString = window.atob(response.content);
          const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
          decodedJsonString = new TextDecoder('utf-8').decode(bytes);
        } else {
          decodedJsonString = Buffer.from(response.content, 'base64').toString('utf-8');
        }

        if (typeof decodedJsonString === 'string' && decodedJsonString.trim() !== "") {
          const temp = JSON.parse(decodedJsonString);
          const parsedData = JSON.parse(temp);

          if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.ops)) {
            parsedContent = parsedData as QuillDelta;
          } else if (parsedData && Array.isArray(parsedData)) {
            parsedContent = { ops: parsedData as Op[] };
          } else {
            console.warn('mapResponseToPayload - Parse edilen veri QuillDelta formatında değil veya bir ops dizisi değil:', parsedData);
          }
        } else {
          console.warn('mapResponseToPayload - Decode edilmiş içerik boş veya string değil:', decodedJsonString);
        }
      } catch (e) {
        console.error('mapResponseToPayload - Doküman içeriği (base64 decode veya JSON.parse) hatası:', e, 'Ham (base64) içerik:', response.content);
      }
    } else {
      console.warn('mapResponseToPayload - API yanıtında "content" alanı bulunmuyor veya null.');
    }

    if (!response.id || typeof response.title === 'undefined' || !response.owner_id) {
      console.error('mapResponseToPayload - API yanıtında zorunlu alanlar eksik:', response);
    }

    return {
      id: response.id ?? `fallback-id-${Date.now()}`,
      title: response.title ?? 'Adsız Doküman',
      description: response.description,
      owner_id: response.owner_id,
      version: response.version,
      is_public: response.is_public,
      status: response.status,
      created_at: response.created_at,
      updated_at: response.updated_at,
      content: parsedContent
    };
  }


  createDocument(title: string, description: string, contentDelta: QuillDelta, isPublic: boolean): Observable<DocumentPayload> {
    const payload = {
      title: title,
      description: description,
      is_public: isPublic,
      content: JSON.stringify(contentDelta)
    };
    console.log('createDocument payload gönderiliyor:', payload);
    return this.http.post<DocumentResponseFromAPI>(this.API_URL, payload, { headers: this.getAuthHeaders() })
      .pipe(
        map(this.mapResponseToPayload),
        catchError(err => {
          console.error('createDocument servisinde HTTP veya map hatası:', err);
          return throwError(() => err);
        })
      );
  }

  getDocument(docId: string): Observable<DocumentPayload> {
    return this.http.get<DocumentResponseFromAPI>(`${this.API_URL}/${docId}`, { headers: this.getAuthHeaders() })
      .pipe(
        map(this.mapResponseToPayload),
        catchError(err => {
          console.error('getDocument servisinde HTTP veya map hatası:', err);
          return throwError(() => err);
        })
      );
  }

  updateDocument(
    docId: string,
    title: string | undefined,
    description: string | undefined,
    contentDelta: QuillDelta,
    isPublic: boolean | undefined,
    status: string | undefined
  ): Observable<DocumentPayload> {
    const payload: any = {
      content: JSON.stringify(contentDelta)
    };
    if (title !== undefined) payload.title = title;
    if (description !== undefined) payload.description = description;
    if (isPublic !== undefined) payload.is_public = isPublic;
    if (status !== undefined) payload.status = status;

    console.log('updateDocument payload gönderiliyor:', payload);
    return this.http.put<DocumentResponseFromAPI>(`${this.API_URL}/${docId}`, payload, { headers: this.getAuthHeaders() })
      .pipe(
        map(this.mapResponseToPayload),
        catchError(err => {
          console.error('updateDocument servisinde HTTP veya map hatası:', err);
          const backendError = err.error?.error || err.message || 'Bilinmeyen bir güncelleme hatası oluştu.';
          return throwError(() => new Error(backendError));
        })
      );
  }

  getUserDocuments(): Observable<CombinedDocumentList> {
    return this.http.get<DocumentListResponseFromAPI>(`${this.API_URL}/user`, { headers: this.getAuthHeaders() })
      .pipe(
        map((response: DocumentListResponseFromAPI): CombinedDocumentList => {
          const ownedDocs = response.owned.map(doc => this.mapResponseToPayload(doc));
          const sharedDocs = response.shared.map(doc => this.mapResponseToPayload(doc));
          const allDocs = [...ownedDocs, ...sharedDocs];

          const sortedByLastUpdate = [...allDocs].sort((a, b) =>
            new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
          );
          const recentDocs = sortedByLastUpdate.slice(0, 4);

          return {
            owned: ownedDocs,
            shared: sharedDocs,
            all: allDocs,
            recent: recentDocs
          };
        }),
        catchError(err => {
          console.error('getUserDocuments servisinde HTTP veya map hatası:', err);
          return throwError(() => err);
        })
      );
  }
  deleteDocument(docId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${docId}`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('deleteDocument servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }


  inviteUserToDocument(docId: string, userEmail: string, accessType: 'viewer' | 'editor'): Observable<PermissionResponseFromAPI> {
    const payload = {
      user_email: userEmail,
      access_type: accessType
    };
    return this.http.post<PermissionResponseFromAPI>(`${this.API_URL}/${docId}/permissions/share`, payload, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('inviteUserToDocument servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  getDocumentShares(docId: string): Observable<PermissionResponseFromAPI[]> {
    return this.http.get<PermissionResponseFromAPI[]>(`${this.API_URL}/${docId}/permissions`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('getDocumentShares servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  updatePermission(permissionId: string, newAccessType: 'viewer' | 'editor'): Observable<MessageResponse> {
    console.warn(`updatePermission çağrıldı, ancak backend'de PUT ${this.API_BASE_URL}/permissions/${permissionId} endpoint'i tanımlı olmalıdır.`);
    return this.http.put<MessageResponse>(`${this.API_BASE_URL}/permissions/${permissionId}`, { access_type: newAccessType }, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('updatePermission servisinde HTTP hatası:', err);
          return throwError(() => new Error(`İzin güncellenemedi. Backend endpoint'i (${this.API_BASE_URL}/permissions/${permissionId}) kontrol edin.`));
        })
      );
  }

  revokePermission(docId: string, userEmail: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_URL}/${docId}/permissions/remove`, { user_email: userEmail }, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('revokePermission servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  getPendingInvitations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE_URL}/invitations/pending`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('getPendingInvitations servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  acceptInvitation(invitationId: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_BASE_URL}/invitations/${invitationId}/accept`, {}, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('acceptInvitation servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  rejectInvitation(invitationId: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_BASE_URL}/invitations/${invitationId}/reject`, {}, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('rejectInvitation servisinde HTTP hatası:', err);
          return throwError(() => err);
        })
      );
  }

  getUserDocumentPermission(docId: string): Observable<UserDocumentPermissionResponse> {
    const url = `${this.API_URL}/${docId}/role`;
    return this.http.get<UserDocumentPermissionResponse>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(err => {
        console.error(`getUserDocumentPermission servisinde hata oluştu (doküman: ${docId}):`, err);
        const errorMsg = err.error?.Error || 'Yetki bilgisi alınırken bir hata oluştu.';
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  importFromDocx(file: File): Observable<DocumentPayload> {
    const formData = new FormData();
    formData.append('file', file);
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    });

    return this.http.post<DocumentPayload>(`${this.API_BASE_URL}/import/docx`, formData, { headers });
  }


}