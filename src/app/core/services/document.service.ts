// Path: dione-docs-frontend/src/app/core/services/document.service.ts
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
import { PermissionResponseFromAPI, MessageResponse } from '../dto/permission.dto';
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
    let parsedContent: QuillDelta = { ops: [{ insert: '\n' }] }; // Hata durumunda veya boş içerikte varsayılan

    if (response.content) {
      try {
        let decodedJsonString: string;
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          // Tarayıcı ortamı için UTF-8 çözümleyici
          const binaryString = window.atob(response.content);
          const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
          decodedJsonString = new TextDecoder('utf-8').decode(bytes);
        } else {
          // Node.js ortamı için zaten UTF-8 destekli
          decodedJsonString = Buffer.from(response.content, 'base64').toString('utf-8');
        }

        console.log('mapResponseToPayload - Base64 decode edilmiş JSON string:', decodedJsonString);

        if (typeof decodedJsonString === 'string' && decodedJsonString.trim() !== "") {
          const temp = JSON.parse(decodedJsonString); // SADECE BİR KEZ PARSE ET
          const parsedData = JSON.parse(temp); // SADECE BİR KEZ PARSE ET
          console.log('mapResponseToPayload - Decode edilmiş stringden parse edilen veri:', parsedData, typeof parsedData);

          if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.ops)) {
            // Durum 1: Gelen veri zaten doğru QuillDelta formatında: { ops: [...] }
            parsedContent = parsedData as QuillDelta;
            console.log('mapResponseToPayload: Doğrudan QuillDelta objesi olarak parse edildi:', parsedContent);
          } else if (parsedData && Array.isArray(parsedData)) {
            // Durum 2: Gelen veri bir operasyon dizisi: [{insert:'...'}, ...]
            // Bu senin "obje aslında bu şekilde geliyor db'den" tanımına uyuyor.
            parsedContent = { ops: parsedData as Op[] };
            console.log('mapResponseToPayload: Ops dizisi olarak parse edildi ve QuillDelta objesine sarıldı:', parsedContent);
          } else {
            console.warn('mapResponseToPayload - Parse edilen veri QuillDelta formatında değil veya bir ops dizisi değil:', parsedData);
          }
        } else {
          console.warn('mapResponseToPayload - Decode edilmiş içerik boş veya string değil:', decodedJsonString);
        }
      } catch (e) {
        console.error('mapResponseToPayload - Doküman içeriği (base64 decode veya JSON.parse) hatası:', e, 'Ham (base64) içerik:', response.content);
        // Hata durumunda parsedContent varsayılan değerini koruyacak ({ ops: [{ insert: '\n' }] })
      }
    } else {
      console.warn('mapResponseToPayload - API yanıtında "content" alanı bulunmuyor veya null.');
    }

    // Temel alanların varlığını kontrol et ve varsayılan değerler ata (gerekirse)
    if (!response.id || typeof response.title === 'undefined' || !response.owner_id) {
      console.error('mapResponseToPayload - API yanıtında zorunlu alanlar eksik:', response);
      // Burada hata fırlatabilir veya kısmi bir payload döndürebilirsin. Şimdilik logluyoruz.
    }

    return {
      id: response.id ?? `fallback-id-${Date.now()}`, // ID yoksa geçici bir ID ata
      title: response.title ?? 'Adsız Doküman',
      description: response.description,
      owner_id: response.owner_id,
      version: response.version,
      is_public: response.is_public,
      status: response.status,
      created_at: response.created_at,
      updated_at: response.updated_at,
      content: parsedContent // Güvenli parsedContent
    };
  }



  // createDocument, getDocument, updateDocument, getUserDocuments metodları
  // mapResponseToPayload'u kullandığı için bu değişiklikten otomatik olarak faydalanacaktır.
  // Bu metodlarda ekstra bir değişiklik gerekmez.

  createDocument(title: string, description: string, contentDelta: QuillDelta, isPublic: boolean): Observable<DocumentPayload> {
    const payload = {
      title: title,
      description: description,
      is_public: isPublic,
      content: JSON.stringify(contentDelta) // Backend'e giderken base64 kodlama YAPILMAZ, JSON string olarak gider.
      // Backend, json.RawMessage veya []byte olarak alır.
      // Eğer []byte ise, jsonb'ye yazılırken db driver'ı base64 encode ETMEMELİDİR.
      // EĞER backend `[]byte` alıp bunu base64 OLARAK BEKLİYORSA, o zaman frontend'de encode gerekir.
      // Ama "illegal base64 data" hatası OKURKEN olduğuna göre, backend YAZARKEN base64 yazmıyor,
      // OKURKEN []byte'ı base64 OLARAK GÖNDERİYOR.
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
    const payload: any = { // Partial<UpdateDocumentServicePayload> daha iyi olurdu
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
          const ownedDocs = response.owned.map(doc => this.mapResponseToPayload(doc)); // Her doküman için decode işlemi yapılacak
          const sharedDocs = response.shared.map(doc => this.mapResponseToPayload(doc)); // Her doküman için decode işlemi yapılacak
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
    // **ÖNEMLİ NOT:** Bu metodun çalışması için backend'de
    // `PUT /api/v1/permissions/:permissionId` gibi bir endpoint'e ve ilgili handler'a ihtiyacınız var.
    // Bu endpoint, `{ "access_type": "new_type" }` şeklinde bir body almalıdır.
    // Mevcut backend router'ınızda bu endpoint henüz tanımlı değil.
    console.warn(`updatePermission çağrıldı, ancak backend'de PUT ${this.API_BASE_URL}/permissions/${permissionId} endpoint'i tanımlı olmalıdır.`);
    return this.http.put<MessageResponse>(`${this.API_BASE_URL}/permissions/${permissionId}`, { access_type: newAccessType }, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(err => {
          console.error('updatePermission servisinde HTTP hatası:', err);
          // Kullanıcıya daha anlamlı bir hata mesajı gösterilebilir.
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

  getPendingInvitations(): Observable<any[]> { // DTO'yu backend yanıtına göre güncelleyin (InvitationDetailResponse gibi)
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
}