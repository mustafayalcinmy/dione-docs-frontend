// src/app/core/components/toolbar/toolbar.component.ts
import { Component, Output, EventEmitter, ViewChild, ElementRef, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const FONT_SIZES = ['8px','9px','10px','12px','14px','16px','20px','24px','32px','42px','54px','68px','84px','98px'];

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnChanges {
  public fontSizes: string[] = FONT_SIZES;
  
  @Input() currentSelectionFormat: any = {};

  public customSizeInputActive: boolean = false;
  public sizeInputValue: string = ''; 
  public isSizeDropdownOpen: boolean = false;

  @ViewChild('fontSizeInputEl') fontSizeInputEl!: ElementRef<HTMLInputElement>;

  menuOpen: string | null = null;

  // Eksik @Output'lar eklendi
  @Output() newClick = new EventEmitter<void>();
  @Output() saveClick = new EventEmitter<void>();
  @Output() downloadClick = new EventEmitter<void>();
  @Output() printClick = new EventEmitter<void>();
  @Output() undoClick = new EventEmitter<void>();
  @Output() redoClick = new EventEmitter<void>();
  @Output() addNewPage = new EventEmitter<void>();
  @Output() sizeSelected = new EventEmitter<string>();
  @Output() bold = new EventEmitter<void>();
  @Output() italic = new EventEmitter<void>();
  @Output() underline = new EventEmitter<void>();
  @Output() link = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentSelectionFormat']) {
      if (!this.customSizeInputActive) {
        const currentSize = this.currentSelectionFormat?.['size']; // Index signature ile erişim
        if (currentSize === 'MIXED_VALUES') {
          this.sizeInputValue = '';
        } else if (currentSize && typeof currentSize === 'string') {
          this.sizeInputValue = currentSize.replace('px', '');
        } else {
          this.sizeInputValue = ''; 
        }
      }
    }
  }

  displaySelectedFontSize(): string {
    const size = this.currentSelectionFormat?.['size']; // Index signature ile erişim
    if (size === 'MIXED_VALUES') {
        return ''; 
    }
    if (size && typeof size === 'string') {
      return size.replace('px', '');
    }
    return 'Size';
  }

  preventEditorBlur(event: MouseEvent): void {
    event.preventDefault(); 
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    const containerElement = this.elementRef.nativeElement.querySelector('.font-size-select-wrapper');

    if (containerElement && !containerElement.contains(target)) {
      // Input açıksa ve dışarı tıklandıysa, applyCustomSize blur'da zaten çalışacak.
      // Bu yüzden burada ek bir applyCustomSize() çağrısı yapmaya gerek yok.
      this.isSizeDropdownOpen = false;
      this.customSizeInputActive = false;
    }
  }

  toggleMenu(menu: string): void {
    const currentlyOpen = this.menuOpen;
    this.closeAllMenus();
    if (currentlyOpen !== menu) {
      this.menuOpen = menu;
    }
    this.isSizeDropdownOpen = false;
    this.customSizeInputActive = false;
  }

  closeAllMenus(): void {
    this.menuOpen = null;
  }

  onNewClick(): void { this.newClick.emit(); this.closeAllMenus(); }
  onSaveClick(): void { this.saveClick.emit(); this.closeAllMenus(); }
  onDownloadClick(): void { this.downloadClick.emit(); this.closeAllMenus(); }
  onPrintClick(): void { this.printClick.emit(); this.closeAllMenus(); }
  onUndoClick(): void { this.undoClick.emit(); this.closeAllMenus(); }
  onRedoClick(): void { this.redoClick.emit(); this.closeAllMenus(); }
  
  handleMenuOption(option: string): void {
    switch (option) {
        case 'insert-new-page': this.addNewPage.emit(); break;
        case 'format-bold': this.onBoldClick(); break; // @Output bold kullanılacak
        case 'format-italic': this.onItalicClick(); break; // @Output italic kullanılacak
        case 'format-underline': this.onUnderlineClick(); break; // @Output underline kullanılacak
        case 'insert-link': this.onLinkClick(); break; // @Output link kullanılacak
        default:
            break;
    }
    this.closeAllMenus();
  }

  handleFontSizeDisplayClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.customSizeInputActive) {
        this.isSizeDropdownOpen = !this.isSizeDropdownOpen;
    } else {
        const currentSize = this.currentSelectionFormat?.['size']; // Index signature
        if (currentSize === 'MIXED_VALUES') {
            this.sizeInputValue = '';
        } else if (currentSize && typeof currentSize === 'string') {
            this.sizeInputValue = currentSize.replace('px', '');
        } else {
            this.sizeInputValue = '';
        }
        this.customSizeInputActive = true;
        this.isSizeDropdownOpen = true;
        setTimeout(() => {
          this.fontSizeInputEl?.nativeElement.focus();
          this.fontSizeInputEl?.nativeElement.select();
        }, 0);
    }
  }
  
  toggleSizeDropdownOnly(event: MouseEvent): void {
    event.stopPropagation();
    this.isSizeDropdownOpen = !this.isSizeDropdownOpen;
    if (!this.customSizeInputActive && this.isSizeDropdownOpen) {
        const currentSize = this.currentSelectionFormat?.['size']; // Index signature
         if (currentSize === 'MIXED_VALUES') {
            this.sizeInputValue = '';
        } else if (currentSize && typeof currentSize === 'string') {
            this.sizeInputValue = currentSize.replace('px', '');
        } else {
            this.sizeInputValue = '';
        }
        this.customSizeInputActive = true;
        setTimeout(() => {
          this.fontSizeInputEl?.nativeElement.focus();
          this.fontSizeInputEl?.nativeElement.select();
        }, 0);
    }
  }

  selectPredefinedSize(sizeWithPx: string, event: MouseEvent): void {
    event.stopPropagation();
    this.sizeSelected.emit(sizeWithPx);
    this.customSizeInputActive = false;
    this.isSizeDropdownOpen = false;
  }

  applyCustomSize(): void {
    if (!this.customSizeInputActive) return;

    const numericSize = parseFloat(this.sizeInputValue);
    if (this.sizeInputValue.trim() === '') {
        this.sizeSelected.emit('');
    } else if (!isNaN(numericSize) && numericSize >= 1 && numericSize <= 200) {
        const newSize = `${numericSize}px`;
        this.sizeSelected.emit(newSize);
    } else {
        alert("Invalid size. Please enter a number between 1 and 200.");
        const currentSize = this.currentSelectionFormat?.['size']; // Index signature
        this.sizeInputValue = (currentSize && typeof currentSize === 'string' && currentSize !== 'MIXED_VALUES') ? currentSize.replace('px', '') : '';
    }
    this.customSizeInputActive = false;
    this.isSizeDropdownOpen = false;
  }

  cancelCustomSizeEdit(): void {
    this.customSizeInputActive = false;
    this.isSizeDropdownOpen = false;
    const currentSize = this.currentSelectionFormat?.['size']; // Index signature
    this.sizeInputValue = (currentSize && typeof currentSize === 'string' && currentSize !== 'MIXED_VALUES') ? currentSize.replace('px', '') : '';
  }
  
  onBoldClick(): void { this.bold.emit(); }
  onItalicClick(): void { this.italic.emit(); }
  onUnderlineClick(): void { this.underline.emit(); }
  onLinkClick(): void { this.link.emit(); }
}