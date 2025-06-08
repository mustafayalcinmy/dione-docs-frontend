// Path: dione-docs-frontend/src/app/core/components/main-page/main-page.component.ts

import { Component, ViewChild, OnInit } from '@angular/core';
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
import { forkJoin } from 'rxjs';
import { InvitationDetailResponse } from '../../dto/permission.dto';

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
  ],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit {
  displayedColumns: string[] = ['favorite', 'name', 'lastUpdate', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<DocumentPayload>;
  recentDocuments: DocumentPayload[] = [];
  allUserDocuments: DocumentPayload[] = [];
  pendingInvitations: InvitationDetailResponse[] = [];
  
  isLoading = true;
  isProcessingInvitation = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private router: Router,
    private documentService: DocumentService,
  ) {
    this.dataSource = new MatTableDataSource<DocumentPayload>([]);
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  /**
   * Hem kullanıcı dokümanlarını hem de bekleyen davetiyeleri paralel olarak yükler.
   * Yükleme tamamlandığında veya hata oluştuğunda arayüzü günceller.
   */
  loadAllData(): void {
    this.isLoading = true;

    forkJoin({
      documents: this.documentService.getUserDocuments(),
      invitations: this.documentService.getPendingInvitations()
    }).subscribe({
      next: (results) => {
        // Doküman verilerini işle
        const docData = results.documents;
        this.allUserDocuments = [...docData.owned, ...docData.shared].map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));
        this.recentDocuments = docData.recent;
        
        // Tablo verisini ayarla
        this.dataSource.data = this.allUserDocuments;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        
        // Davetiye verilerini işle
        this.pendingInvitations = results.invitations as InvitationDetailResponse[];
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Veri yüklenirken bir hata oluştu:', err);
        this.isLoading = false; // Hata durumunda yükleniyor ekranını kapat
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
    this.dataSource.data = [...this.allUserDocuments]; // Değişikliği yansıtmak için referansı güncelle
  }
  
  onAccept(invitationId: string): void {
    this.isProcessingInvitation = true;
    this.documentService.acceptInvitation(invitationId).subscribe({
      next: (res) => {
        alert(res.message || 'Davetiye başarıyla kabul edildi!');
        this.loadAllData(); // Tüm veriyi yenile
      },
      error: (err) => {
        alert(`Bir hata oluştu: ${err.error?.error || 'Davetiye kabul edilemedi.'}`);
      }
    }).add(() => this.isProcessingInvitation = false); // Her durumda (başarı/hata) butonu aktif et
  }

  onReject(invitationId: string): void {
    this.isProcessingInvitation = true;
    this.documentService.rejectInvitation(invitationId).subscribe({
      next: (res) => {
        alert(res.message || 'Davetiye reddedildi.');
        this.loadAllData(); // Tüm veriyi yenile
      },
      error: (err) => {
        alert(`Bir hata oluştu: ${err.error?.error || 'Davetiye reddedilemedi.'}`);
      }
    }).add(() => this.isProcessingInvitation = false); // Her durumda (başarı/hata) butonu aktif et
  }
}