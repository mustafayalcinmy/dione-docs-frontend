import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DocumentService } from '../../services/document.service';
import { PermissionResponseFromAPI } from '../../dto/permission.dto';

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
    MatIconModule,
  ],
  templateUrl: './share-dialog.component.html',
  styleUrls: ['./share-dialog.component.scss']
})
export class ShareDialogComponent implements OnInit {
  isLoading = true;
  isProcessing = false;
  sharedWith: PermissionResponseFromAPI[] = [];
  inviteEmail = '';
  inviteAccessType: 'viewer' | 'editor' = 'viewer';

  constructor(
    public dialogRef: MatDialogRef<ShareDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ShareDialogData,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.loadShares();
  }

  loadShares(): void {
    this.isLoading = true;
    this.documentService.getDocumentShares(this.data.documentId).subscribe({
      next: (shares) => {
        this.sharedWith = shares.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Paylaşımlar yüklenirken hata:', err);
        alert('Paylaşım bilgileri yüklenemedi.');
        this.isLoading = false;
      }
    });
  }

  sendInvitation(): void {
    if (!this.inviteEmail || !this.inviteAccessType) {
      return;
    }
    this.isProcessing = true;
    this.documentService.inviteUserToDocument(this.data.documentId, this.inviteEmail, this.inviteAccessType)
      .subscribe({
        next: () => {
          alert('Davetiye başarıyla gönderildi!');
          this.inviteEmail = '';
          this.loadShares();
          this.isProcessing = false;
        },
        error: (err) => {
          console.error('Davetiye gönderilirken hata:', err);
          alert(`Davetiye gönderilemedi: ${err.error?.error || err.message}`);
          this.isProcessing = false;
        }
      });
  }

  revokePermission(permission: PermissionResponseFromAPI): void {
    const actionText = permission.status === 'pending' ? 'davetiyeyi iptal etmek' : 'erişimi kaldırmak';
    if (!confirm(`${permission.user_email} kullanıcısının ${actionText} istediğinize emin misiniz?`)) {
      return;
    }
    this.isProcessing = true;
    this.documentService.revokePermission(this.data.documentId, permission.user_email)
      .subscribe({
        next: () => {
          alert('Erişim/davetiye başarıyla kaldırıldı.');
          this.loadShares();
          this.isProcessing = false;
        },
        error: (err) => {
          console.error('Erişim kaldırılırken hata:', err);
          alert(`Erişim kaldırılamadı: ${err.error?.error || err.message}`);
          this.isProcessing = false;
        }
      });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}