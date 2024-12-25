import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table'; // MatTableModule
import { MatButtonModule } from '@angular/material/button'; // MatButtonModule
import { MatPaginatorModule } from '@angular/material/paginator';  // Paginator modülünü ekleyin

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [
    MatIconModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent {
  displayedColumns: string[] = ['favorite', 'name', 'lastUpdate', 'createdAt'];
  
  // Veriyi burada bir dizi olarak tanımlıyoruz
  dataSource = new MatTableDataSource([
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: true, name: 'Sample Name 1', lastUpdate: '2024-12-25', createdAt: '2024-01-01' },
    { favorite: false, name: 'Sample Name 2', lastUpdate: '2024-12-26', createdAt: '2024-02-01' },
    { favorite: false, name: 'Sample Name 3', lastUpdate: '2024-12-27', createdAt: '2024-03-01' },
    { favorite: false, name: 'Sample Name 4', lastUpdate: '2024-12-28', createdAt: '2024-04-01' },
    { favorite: false, name: 'Sample Name 5', lastUpdate: '2024-12-29', createdAt: '2024-05-01' },
    { favorite: false, name: 'Sample Name 6', lastUpdate: '2024-12-30', createdAt: '2024-06-01' }
  ]);

  // MatPaginator için ViewChild kullanıyoruz
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Paginator sayfa olaylarını yönetmek için
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  // Sayfa değişimi olayını yakalamak için
  pageEvent(event: any) {
    console.log('Page Changed', event);
  }
}
