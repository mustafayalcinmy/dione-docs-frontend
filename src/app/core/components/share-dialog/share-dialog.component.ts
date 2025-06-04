import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../services/document.service'; // Yolunuzu kontrol edin
import { PermissionResponseFromAPI, PermissionStatus } from '../../dto/permission.dto'; 
// Backend'deki PermissionResponse buna benziyor, onu kullanabiliriz veya frontend için özelleştirebiliriz.
// Şimdilik PermissionResponseFromAPI adında bir DTO varsayalım.

export interface ShareDialogData {
  documentId: string;
  documentTitle: string;
}

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './share-dialog.component.html',
  styleUrls: ['./share-dialog.component.scss']
})
export class ShareDialogComponent implements OnInit {
  isLoadingShares = false;
  isProcessing = false;
  sharedWith: PermissionResponseFromAPI[] = [];
  inviteEmail = '';
  inviteAccessType: 'viewer' | 'editor' = 'viewer';
  permissionStatus = PermissionStatus; // Enum'ı template'te kullanmak için

  constructor(
    public dialogRef: MatDialogRef<ShareDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ShareDialogData,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.loadShares();
  }

  loadShares(): void {
    this.isLoadingShares = true;
    // Backend'deki GetDocumentPermissions'ın admin için tüm statüleri (pending, accepted, rejected)
    // ve kimin paylaştığı bilgisini (SharedBy) döndürdüğünü varsayıyoruz.
    // Bu endpoint'in adı farklıysa veya parametre alıyorsa DocumentService'i ona göre güncelleyin.
    this.documentService.getDocumentShares(this.data.documentId).subscribe({
      next: (shares) => {
        this.sharedWith = shares;
        this.isLoadingShares = false;
      },
      error: (err) => {
        console.error('Paylaşımlar yüklenirken hata:', err);
        this.isLoadingShares = false;
        // Kullanıcıya hata mesajı gösterilebilir
      }
    });
  }

  sendInvitation(): void {
    if (!this.inviteEmail || !this.inviteAccessType) {
      alert('Lütfen e-posta ve erişim tipi girin.');
      return;
    }
    this.isProcessing = true;
    this.documentService.inviteUserToDocument(this.data.documentId, this.inviteEmail, this.inviteAccessType)
      .subscribe({
        next: () => {
          this.inviteEmail = '';
          this.inviteAccessType = 'viewer';
          this.loadShares(); // Listeyi yenile
          this.isProcessing = false;
          alert('Davetiye gönderildi!');
        },
        error: (err) => {
          console.error('Davetiye gönderilirken hata:', err);
          this.isProcessing = false;
          alert(`Davetiye gönderilemedi: ${err.error?.error || err.message}`);
        }
      });
  }

  updatePermission(permission: PermissionResponseFromAPI, newAccessType: 'viewer' | 'editor'): void {
    if (permission.status !== this.permissionStatus.Accepted) {
      alert('Sadece kabul edilmiş izinlerin yetkisi değiştirilebilir.');
      return;
    }
    this.isProcessing = true;
    this.documentService.updatePermission(permission.id, newAccessType)
      .subscribe({
        next: () => {
          this.loadShares();
          this.isProcessing = false;
          alert('İzin güncellendi.');
        },
        error: (err) => {
          console.error('İzin güncellenirken hata:', err);
          this.isProcessing = false;
          alert(`İzin güncellenemedi: ${err.error?.error || err.message}`);
        }
      });
  }

  revokePermission(permission: PermissionResponseFromAPI): void {
    const actionText = permission.status === this.permissionStatus.Pending ? 'davetiyeyi iptal etmek' : 'erişimi kaldırmak';
    if (!confirm(`${permission.user_email} kullanıcısının ${actionText} istediğinize emin misiniz?`)) {
      return;
    }
    this.isProcessing = true;
    // Backend'deki /documents/{id}/permissions/remove endpoint'i userEmail ile çalışıyor.
    this.documentService.revokePermission(this.data.documentId, permission.user_email)
      .subscribe({
        next: () => {
          this.loadShares();
          this.isProcessing = false;
          alert('Erişim/davetiye kaldırıldı.');
        },
        error: (err) => {
          console.error('Erişim kaldırılırken hata:', err);
          this.isProcessing = false;
          alert(`Erişim kaldırılamadı: ${err.error?.error || err.message}`);
        }
      });
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}