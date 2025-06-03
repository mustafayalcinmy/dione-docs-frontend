// Path: dione-docs-frontend/src/app/core/components/main-page/main-page.component.ts
import { Component, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core'; // AfterViewInit'i kaldırdık, setter kullanacağız
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service'; // Kullanılmıyorsa kaldırılabilir
import { CommonModule } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { DocumentService } from '../../services/document.service';
import { DocumentPayload, CombinedDocumentList } from '../../dto/document.dto';

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
  isLoading: boolean = true; // Başlangıçta true

  // Paginator için ViewChild setter'ı
  private _paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginator(paginatorInstance: MatPaginator) {
    if (paginatorInstance) {
      this._paginator = paginatorInstance;
      this.dataSource.paginator = this._paginator;
      console.log('Paginator ViewChild setter ile atandı:', this._paginator);
      // Veri zaten yüklüyse ve paginator yeni ayarlandıysa ilk sayfaya git
      if (this.dataSource.data.length > 0) {
         // this._paginator.firstPage(); // Bu bazen change detection sorunlarına yol açabilir, subscribe içindeki daha iyi olabilir
      }
    }
  }
  get paginator(): MatPaginator {
    return this._paginator;
  }

  // Sort için ViewChild setter'ı
  private _sort!: MatSort;
  @ViewChild(MatSort) set sort(sortInstance: MatSort) {
    if (sortInstance) {
      this._sort = sortInstance;
      this.dataSource.sort = this._sort;
      console.log('Sort ViewChild setter ile atandı:', this._sort);
    }
  }
  get sort(): MatSort {
    return this._sort;
  }

  constructor(
    private router: Router,
    private documentService: DocumentService,
    private changeDetectorRef: ChangeDetectorRef // Gerekliyse kullanmaya devam et
  ) {
    this.dataSource = new MatTableDataSource<DocumentPayload>([]);
  }

  ngOnInit(): void {
    console.log('MainPageComponent OnInit çağrıldı.');
    this.loadUserDocuments();
  }

  loadUserDocuments(): void {
    console.log('loadUserDocuments çağrıldı.');
    this.isLoading = true; // Paginator ve tablo DOM'dan kalkar
    this.documentService.getUserDocuments().subscribe({
      next: (data: CombinedDocumentList) => {
        this.allUserDocuments = [...data.owned, ...data.shared].map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));
        
        this.recentDocuments = data.recent.map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));

        this.dataSource.data = this.allUserDocuments;
        this.isLoading = false; // Paginator ve tablo DOM'a eklenir, setter'lar tetiklenir

        // isLoading false olduktan ve DOM güncellendikten sonra paginator'ın ayarlanmış olması gerekir.
        // Bu noktada `firstPage` çağırmak daha güvenli olabilir.
        // Angular'ın değişiklikleri işlemesi için küçük bir gecikme gerekebilir.
        setTimeout(() => {
            if (this.dataSource.paginator && this.dataSource.data.length > 0) {
                this.dataSource.paginator.firstPage();
                console.log('Paginator.firstPage() çağrıldı (subscribe next içinde).');
            }
        }, 0);
        
        // changeDetectorRef.detectChanges(); // isLoading değiştiği için Angular zaten change detection çalıştırır. Genelde gerekmez.
      },
      error: (err) => {
        console.error('Error fetching user documents:', err);
        this.isLoading = false; // Hata durumunda da loading'i kapat
      }
    });
  }

  // ngAfterViewInit'i bu strateji için kaldırdık.

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
    } else {
       console.warn('Document ID is missing. Cannot open.');
    }
  }

  editDocument(doc: DocumentPayload) {
     this.openDocument(doc);
  }

  deleteDocument(docId: string) {
     console.log('Deleting document:', docId);
     this.documentService.deleteDocument(docId).subscribe({
       next: () => {
         console.log('Document deleted successfully:', docId);
         this.loadUserDocuments(); // Yenileme işlemi
       },
       error: (err) => {
         console.error('Error deleting document:', err);
        }
      });
  }

    toggleFavorite(doc: DocumentPayload) {
    (doc as any).favorite = !(doc as any).favorite;
    this.dataSource.data = [...this.dataSource.data]; // Trigger change detection for the table
    console.log('Toggled favorite for:', doc.id, 'to', (doc as any).favorite);
    // TODO: Backend'e favori durumunu kaydetmek için servis çağrısı
  }
}