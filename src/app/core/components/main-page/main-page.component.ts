import { Component, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table'; // MatTableModule import edildi
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'; // MatPaginatorModule import edildi
import { MatSort, MatSortModule } from '@angular/material/sort'; // MatSortModule import edildi
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router'; // RouterModule import edildi
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common'; // CommonModule import edildi
import { MatRippleModule } from '@angular/material/core'; // MatRippleModule import edildi (template'de kullanılıyor)


// Veri modelin için interface (Değişiklik yok)
export interface DocumentData {
  id?: string;
  favorite: boolean;
  name: string;
  lastUpdate: string;
  createdAt: string;
}

@Component({
  selector: 'app-main-page',
  standalone: true, // standalone eklendi
  imports: [
    CommonModule,
    RouterModule, // RouterModule eklendi
    MatIconModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule, // MatRippleModule eklendi
  ],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements AfterViewInit, OnInit {
  displayedColumns: string[] = ['favorite', 'name', 'lastUpdate', 'createdAt', 'actions']; // Actions sütunu eklenebilir
  dataSource: MatTableDataSource<DocumentData>;
  recentDocuments: DocumentData[] = [];

  // Örnek Veri (Gerçek API'den gelmeli)
  private ELEMENT_DATA: DocumentData[] = [
    // ... (veri aynı kalabilir)
     { id: 'doc1', favorite: true, name: 'Rapor Q1', lastUpdate: '2024-12-25', createdAt: '2024-01-15' },
     { id: 'doc2', favorite: false, name: 'Sunum Proje X', lastUpdate: '2024-11-10', createdAt: '2024-02-01' },
     { id: 'doc3', favorite: false, name: 'Teklif Revize', lastUpdate: '2025-01-20', createdAt: '2024-03-10' },
     { id: 'doc4', favorite: true, name: 'Analiz Raporu', lastUpdate: '2025-03-01', createdAt: '2024-01-05' },
     { id: 'doc5', favorite: false, name: 'Kullanıcı Kılavuzu', lastUpdate: '2024-10-05', createdAt: '2024-05-01' },
     { id: 'doc6', favorite: false, name: 'Pazarlama Planı', lastUpdate: '2025-02-15', createdAt: '2024-06-20' },
     { id: 'doc7', favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
     { id: 'doc8', favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
     { id: 'doc9', favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
     { id: 'doc10', favorite: false, name: 'Sample Name 4', lastUpdate: '2024-12-28', createdAt: '2024-04-01' },
     { id: 'doc11', favorite: false, name: 'Sample Name 5', lastUpdate: '2024-12-29', createdAt: '2024-05-01' },
     { id: 'doc12', favorite: false, name: 'Sample Name 6', lastUpdate: '2024-12-30', createdAt: '2024-06-01' }
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    // private authService: AuthService // Eğer kullanıcı bilgisi vs. gerekirse aktif edin
  ) {
    // DataSource constructor içinde oluşturulmalı
    this.dataSource = new MatTableDataSource(this.ELEMENT_DATA);
  }

  ngOnInit(): void {
    // Gerçekte burada bir servis çağrısı ile dokümanlar yüklenmeli
    this.loadRecentDocuments();
    this.dataSource.data = this.ELEMENT_DATA; // Veriyi tekrar ata (veya servis çağrısı yap)
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadRecentDocuments(): void {
    // Gerçek API çağrısı yerine örnek veri kullanılıyor
    const sortedData = [...this.ELEMENT_DATA].sort((a, b) => {
      const dateA = new Date(a.lastUpdate);
      const dateB = new Date(b.lastUpdate);
      return dateB.getTime() - dateA.getTime();
    });
    this.recentDocuments = sortedData.slice(0, 4);
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // clearSearch fonksiyonu HTML'de tanımlı değil, gerekirse ekleyin veya kaldırın
  // clearSearch(inputElement: HTMLInputElement) { ... }

  new_document() {
    console.log('Navigating to new document editor');
    // Yeni doküman için ID olmadan document/:id yerine /document'a gitmeli
    this.router.navigate(['/document']);
  }

  openDocument(doc: DocumentData) {
    console.log('Navigating to existing document:', doc.id);
    if (doc.id) {
      this.router.navigate(['/document', doc.id]);
    } else {
       console.warn('Document ID is missing. Cannot open.');
       // Belki bir hata mesajı gösterilebilir
    }
  }

  // Örnek aksiyonlar (tabloya eklenecekse)
  editDocument(doc: DocumentData) {
     this.openDocument(doc);
  }

  deleteDocument(doc: DocumentData) {
     console.log('Deleting document:', doc.id);
     // Burada silme işlemi için servis çağrısı ve onay dialog'u olmalı
  }

  toggleFavorite(doc: DocumentData) {
    doc.favorite = !doc.favorite;
    // Burada favori durumu güncellemek için servis çağrısı olmalı
  }
}