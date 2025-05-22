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

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private readonly API_URL = 'http://127.0.0.1:8080/api/v1/documents';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private mapResponseToPayload(response: DocumentResponseFromAPI): DocumentPayload {
    let parsedContent: QuillDelta = { ops: [] };
    console.log('mapResponseToPayload - Gelen yanıt:', response);

    if (response.content) {
      try {
        // Adım 1: Backend'den gelen base64 string'ini decode et.
        // Tarayıcı ortamında `atob()` fonksiyonu bunun için kullanılabilir.
        // Node.js ortamında (SSR sırasında) Buffer kullanılabilir.
        // Angular'da platforma göre işlem yapmak daha doğru olur.
        let decodedJsonString: string;
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          // Tarayıcı ortamı
          decodedJsonString = window.atob(response.content);
        } else {
          // Node.js ortamı (SSR)
          decodedJsonString = Buffer.from(response.content, 'base64').toString('utf-8');
        }
        console.log('mapResponseToPayload - Base64 decode edilmiş JSON string:', decodedJsonString);

        // Adım 2: Decode edilmiş JSON string'ini parse et.
        if (typeof decodedJsonString === 'string' && decodedJsonString.trim() !== "") {
          const tempParsed = JSON.parse(decodedJsonString);
          if (tempParsed && Array.isArray(tempParsed.ops)) {
            parsedContent = tempParsed as QuillDelta;
            console.log('mapResponseToPayload - Başarıyla parse edilen içerik:', parsedContent);
          } else {
            console.warn('mapResponseToPayload - Parse edilen içerik QuillDelta formatında değil:', tempParsed);
          }
        } else {
          console.warn('mapResponseToPayload - Decode edilen içerik boş veya string değil:', decodedJsonString);
        }
      } catch (e) {
        console.error('mapResponseToPayload - Doküman içeriği base64 decode veya JSON.parse hatası:', e, 'Ham (base64) içerik:', response.content);
        // throw new Error('Doküman içeriği okunamadı.'); // Hata component'e taşınabilir
      }
    } else {
      console.warn('mapResponseToPayload - API yanıtında content alanı bulunmuyor veya null.');
    }

    if (!response.id || typeof response.title === 'undefined' || !response.owner_id) {
        console.error('mapResponseToPayload - API yanıtında zorunlu alanlar eksik veya hatalı:', response);
        throw new Error('Sunucudan gelen doküman verisinde eksik veya hatalı temel alanlar mevcut.');
    }

    return {
      id: response.id,
      title: response.title,
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
}