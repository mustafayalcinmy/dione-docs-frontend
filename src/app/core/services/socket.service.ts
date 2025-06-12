import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, Observable, EMPTY } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface OTOperation {
  version: number;
  clientId: string;
  ops: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket$: WebSocketSubject<any> | null = null;
  private readonly WS_BASE_URL = 'ws://127.0.0.1:8080/api/v1/ws/documents';

  private incomingOpsSubject = new Subject<OTOperation>();
  public incomingOps$: Observable<OTOperation> = this.incomingOpsSubject.asObservable();

  constructor(private authService: AuthService) { }

  public connect(docId: string): void {
    if (this.socket$ && !this.socket$.closed) {
      console.log('Socket already connected.');
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('SocketService: Authentication token not found.');
      return;
    }

    const url = `ws://localhost:8080/api/v1/ws/documents/${docId}?token=${token}`;
    console.log(`Connecting to WebSocket at: ${url}`);

    this.socket$ = webSocket(url);

    this.socket$.pipe(
      tap(op => console.log('Received OT Op:', op)),
      catchError(err => {
        console.error('Socket Error:', err);
        this.socket$?.complete();
        this.socket$ = null;
        return EMPTY;
      })
    ).subscribe(
      (op: OTOperation) => this.incomingOpsSubject.next(op)
    );
  }


  public sendOperation(ops: any[], version: number): void {
    if (!this.socket$ || this.socket$.closed) {
      console.error('Socket not connected. Cannot send operation.');
      return;
    }

    const payload = {
      version,
      ops
    };
    this.socket$.next(payload);
  }

  public disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }
}