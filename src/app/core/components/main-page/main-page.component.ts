// Path: dione-docs-frontend/src/app/core/components/main-page/main-page.component.ts
import { Component, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { DocumentService } from '../../services/document.service'; // Sadece DocumentService import ediliyor
import { DocumentPayload, CombinedDocumentList } from '../../dto/document.dto'; // CombinedDocumentList ve DocumentPayload dto dosyasından import ediliyor

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
export class MainPageComponent implements AfterViewInit, OnInit {
  displayedColumns: string[] = ['favorite', 'name', 'lastUpdate', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<DocumentPayload>;
  recentDocuments: DocumentPayload[] = [];
  allUserDocuments: DocumentPayload[] = [];
  isLoading: boolean = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private documentService: DocumentService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.dataSource = new MatTableDataSource<DocumentPayload>([]);
  }

  ngOnInit(): void {
    console.log('MainPageComponent OnInit çağrıldı.');
    this.loadUserDocuments();
  }

  loadUserDocuments(): void {
    console.log('loadUserDocuments çağrıldı.');
    this.isLoading = true;
    this.documentService.getUserDocuments().subscribe({
      next: (data: CombinedDocumentList) => { // CombinedDocumentList tipi dto'dan geliyor
        this.allUserDocuments = [...data.owned, ...data.shared].map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));
        
        this.recentDocuments = data.recent.map(doc => ({
          ...doc,
          favorite: (doc as any).favorite || false
        }));

        this.dataSource.data = this.allUserDocuments;
        if (this.paginator) { // Paginator'ın varlığını kontrol et
           this.dataSource.paginator = this.paginator;
           this.dataSource.paginator.firstPage();
        }
        if (this.sort) { // Sort'un varlığını kontrol et
            this.dataSource.sort = this.sort;
        }
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching user documents:', err);
        this.isLoading = false;
      }
    });
  }

  ngAfterViewInit() {
    // Paginator ve Sort'u burada dataSource'a atamak daha güvenli olabilir,
    // çünkü bu noktada ViewChild elemanlarının yüklendiği garantidir.
    // Ancak, veriler yüklenmeden önce atanmaları bir sorun yaratmaz,
    // veri geldiğinde MatTableDataSource bunları otomatik olarak kullanır.
    // Eğer veri yüklemesi sonrası paginator/sort'ta sorun yaşanırsa,
    // loadUserDocuments içindeki next bloğuna taşınabilirler.
    if (this.dataSource.data.length > 0) { // Sadece veri varsa ata
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }
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
    } else {
       console.warn('Document ID is missing. Cannot open.');
    }
  }

  editDocument(doc: DocumentPayload) {
     this.openDocument(doc);
  }

  deleteDocument(doc: DocumentPayload) {
     console.log('Deleting document:', doc.id);
     // TODO: Silme işlemi için servis çağrısı ve onay dialog'u eklenecek
  }

  toggleFavorite(doc: DocumentPayload) {
    (doc as any).favorite = !(doc as any).favorite;
    this.dataSource.data = [...this.dataSource.data]; // Trigger change detection for the table
    console.log('Toggled favorite for:', doc.id, 'to', (doc as any).favorite);
    // TODO: Backend'e favori durumunu kaydetmek için servis çağrısı
  }
}