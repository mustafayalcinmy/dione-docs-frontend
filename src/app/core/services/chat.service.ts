import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, Observable, EMPTY, of } from 'rxjs';
import { catchError, tap, retry } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ChatMessage, NewChatMessage } from '../dto/chat-message.dto';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket$: WebSocketSubject<ChatMessage | NewChatMessage> | null = null;
  private readonly API_BASE_URL = 'http://127.0.0.1:8080/api/v1';

  private incomingMessagesSubject = new Subject<ChatMessage>();
  public messages$: Observable<ChatMessage> = this.incomingMessagesSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) { }

  public getChatHistory(docId: string): Observable<ChatMessage[]> {
    const url = `${this.API_BASE_URL}/documents/${docId}/messages`;
    return this.http.get<ChatMessage[]>(url).pipe(
      catchError(err => {
        console.error('Sohbet geçmişi alınırken hata oluştu:', err);
        return of([]);
      })
    );
  }

  public connect(docId: string): void {
    if (this.socket$ && !this.socket$.closed) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('ChatService: Bağlantı için kimlik doğrulama tokenı bulunamadı.');
      return;
    }

    const url = `ws://127.0.0.1:8080/api/v1/ws/chat/documents/${docId}?token=${token}`;

    this.socket$ = webSocket({
      url: url
    });

    this.socket$.pipe(
      tap(message => console.log('Gelen sohbet mesajı:', message)),
      retry({ delay: 5000 }),
      catchError(err => {
        console.error('Sohbet soket hatası:', err);
        this.socket$ = null;
        return EMPTY;
      })
    ).subscribe(
      (message: ChatMessage | NewChatMessage) => {
        if ('id' in message && 'user' in message) {
          this.incomingMessagesSubject.next(message as ChatMessage);
        }
      }
    );
  }

  public sendMessage(content: string): void {
    if (!this.socket$ || this.socket$.closed) {
      console.error('Soket bağlı değil. Mesaj gönderilemiyor.');
      return;
    }
    const payload: NewChatMessage = { content };
    this.socket$.next(payload);
  }

  public disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }
}