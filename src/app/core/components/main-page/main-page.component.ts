import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { DocumentService } from '../../services/document.service';
import { DocumentPayload, CombinedDocumentList } from '../../dto/document.dto';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, Observable } from 'rxjs';
import { InvitationDetailResponse } from '../../dto/permission.dto';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShareDialogComponent, ShareDialogData } from '../share-dialog/share-dialog.component';
import { AuthService } from '../../services/auth.service';
import { User } from '../../dto/user.dto';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['favorite', 'name', 'lastUpdate', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<DocumentPayload>;
  recentDocuments: DocumentPayload[] = [];
  allUserDocuments: DocumentPayload[] = [];
  pendingInvitations: InvitationDetailResponse[] = [];
  public isNotificationsSidebarOpen = false;
  currentUserId: string | undefined = undefined;
  id: string | undefined = undefined;
  isLoading = true;
  isProcessingInvitation = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private router: Router,
    private documentService: DocumentService,
    public dialog: MatDialog,
    private authService: AuthService,
  ) {
    this.dataSource = new MatTableDataSource<DocumentPayload>([]);
  }

  ngOnInit(): void {
    this.authService.fetchAndSetCurrentUser().subscribe({
      next: (user) => {
        this.currentUserId = user.id;
        console.log('Kullanıcı bilgisi başarıyla alındı ve atandı:', user);
        this.loadAllData();
      },
      error: (err) => {
        console.error('Kullanıcı bilgisi alınırken hata oluştu:', err);
        this.isLoading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // setTimeout ile bir tick bekleyerek ViewChild'ların tam yüklenmesini sağla
    setTimeout(() => {
      this.setupTableFeatures();
    });
  }

  private setupTableFeatures(): void {
    console.log('Setup table features - Paginator:', this.paginator);
    console.log('Setup table features - Sort:', this.sort);
    
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = 10;
      this.paginator.pageIndex = 0;
      
      // Paginator değişikliklerini dinle
      this.paginator.page.subscribe(() => {
        console.log('Paginator page changed:', this.paginator.pageSize, this.paginator.pageIndex);
      });
    } else {
      console.warn('Paginator is not available');
    }
    
    if (this.sort) {
      this.dataSource.sort = this.sort;
    } else {
      console.warn('Sort is not available');
    }
  }

  private setupPaginatorAfterDataLoad(): void {
    // Veri yüklendikten sonra paginator'u yeniden kur
    if (this.paginator && this.dataSource) {
      // Mevcut bağlantıyı kaldır
      this.dataSource.paginator = null;
      
      // Kısa bir gecikme sonrası yeniden bağla
      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
          this.paginator.pageSize = 10;
          this.paginator.pageIndex = 0;
          console.log('Paginator reconnected after data load');
        }
      }, 100);
    }
  }

  loadAllData(): void {
    console.log('Kullanıcı ID:', this.currentUserId);
    this.isLoading = true;

    forkJoin({
      documents: this.documentService.getUserDocuments(),
      invitations: this.documentService.getPendingInvitations()
    }).subscribe({
      next: (results) => {
        this.pendingInvitations = (results.invitations as InvitationDetailResponse[]) || [];

        const pendingDocumentIds = new Set(
          this.pendingInvitations.map(inv => inv.document_id).filter(Boolean)
        );

        const docData = results.documents;

        const acceptedSharedDocuments = (docData?.shared || [])
          .filter(doc => doc.id && !pendingDocumentIds.has(doc.id));

        this.allUserDocuments = [...(docData?.owned || []), ...acceptedSharedDocuments].map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));

        this.recentDocuments = (docData?.recent || [])
          .filter(doc => doc.id && !pendingDocumentIds.has(doc.id));
        
        // Veriyi ata
        this.dataSource.data = this.allUserDocuments;
        
        // Paginator'u yeniden bağla ve ayarla
        this.setupPaginatorAfterDataLoad();

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Veri yüklenirken bir hata oluştu:', err);
        this.allUserDocuments = [];
        this.recentDocuments = [];
        this.pendingInvitations = [];
        this.dataSource.data = [];
        this.isLoading = false;
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  new_document() {
    this.router.navigate(['/document']);
  }

  openDocument(doc: DocumentPayload) {
    if (doc.id) {
      this.router.navigate(['/document', doc.id]);
    }
  }

  editDocument(doc: DocumentPayload) {
    this.openDocument(doc);
  }

  deleteDocument(docId: string | undefined) {
    if (!docId) return;
    if (confirm('Bu dokümanı silmek istediğinizden emin misiniz?')) {
      this.documentService.deleteDocument(docId).subscribe({
        next: () => this.loadAllData(),
        error: (err) => alert(`Doküman silinirken bir hata oluştu: ${err.message}`)
      });
    }
  }

  toggleFavorite(doc: DocumentPayload) {
    (doc as any).favorite = !(doc as any).favorite;
    // Veriyi güncelle ve paginator ayarlarını koru
    this.dataSource.data = [...this.allUserDocuments];
  }

  get notificationCountDisplay(): string {
    const count = this.pendingInvitations.length;
    if (count === 0) {
      return '';
    }
    return count > 9 ? '9+' : count.toString();
  }

  toggleNotificationsSidebar(): void {
    this.isNotificationsSidebarOpen = !this.isNotificationsSidebarOpen;
  }

  onAccept(invitationId: string): void {
    this.isProcessingInvitation = true;
    this.documentService.acceptInvitation(invitationId).subscribe({
      next: (res) => {
        alert(res.message || 'Davetiye başarıyla kabul edildi!');
        this.loadAllData();
        if (this.pendingInvitations.length - 1 === 0) {
          this.isNotificationsSidebarOpen = false;
        }
      },
      error: (err) => {
        alert(`Bir hata oluştu: ${err.error?.error || 'Davetiye kabul edilemedi.'}`);
      },
      complete: () => this.isProcessingInvitation = false
    });
  }

  onReject(invitationId: string): void {
    this.isProcessingInvitation = true;
    this.documentService.rejectInvitation(invitationId).subscribe({
      next: (res) => {
        alert(res.message || 'Davetiye reddedildi.');
        this.loadAllData();
        if (this.pendingInvitations.length - 1 === 0) {
          this.isNotificationsSidebarOpen = false;
        }
      },
      error: (err) => {
        alert(`Bir hata oluştu: ${err.error?.error || 'Davetiye reddedilemedi.'}`);
      },
      complete: () => this.isProcessingInvitation = false
    });
  }

  openShareDialog(doc: DocumentPayload): void {
    if (!doc.id) {
      alert('Paylaşım için doküman kimliği bulunamadı.');
      return;
    }

    const dialogData: ShareDialogData = {
      documentId: doc.id,
      documentTitle: doc.title || 'Başlıksız Belge'
    };

    this.dialog.open(ShareDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: dialogData,
      autoFocus: false
    });
  }

  onLogout(): void {
    const confirmation = confirm('Oturumu kapatmak istediğinizden emin misiniz?');
    
    if (confirmation) {
      this.authService.logout();
    }
  }
}