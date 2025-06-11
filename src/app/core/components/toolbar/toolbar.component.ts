import { Component, Output, EventEmitter, ViewChild, ElementRef, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ShareDialogComponent, ShareDialogData } from '../../components/share-dialog/share-dialog.component';

const FONT_SIZES = ['8px', '9px', '10px', '12px', '14px', '16px', '20px', '24px', '32px', '42px', '54px', '68px', '84px', '98px'];

const FONT_STYLES_CONFIG = [
  { name: 'Arial', value: 'arial, sans-serif' },
  { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { name: 'Courier New', value: 'courier-new, monospace' },
  { name: 'Garamond', value: 'garamond, serif' },
  { name: 'Georgia', value: 'georgia, serif' },
  { name: 'Helvetica', value: 'helvetica, sans-serif' },
  { name: 'Impact', value: 'impact, sans-serif' },
  { name: 'Lato', value: 'lato, sans-serif' },
  { name: 'Montserrat', value: 'montserrat, sans-serif' },
  { name: 'Roboto', value: 'roboto, sans-serif' },
  { name: 'Times New Roman', value: 'times-new-roman, serif' },
  { name: 'Verdana', value: 'verdana, sans-serif' }
];

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, ShareDialogComponent],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnChanges {
  @Input() disabled: boolean = false;

  public fontSizes: string[] = FONT_SIZES;
  public fontStyles: { name: string, value: string }[] = FONT_STYLES_CONFIG;
  @Input() currentSelectionFormat: any = {};
  public customSizeInputActive: boolean = false;
  public sizeInputValue: string = '';
  public isSizeDropdownOpen: boolean = false;
  public pendingColor: string | null = null;
  public currentColor: string = '#000000';
  public isTableGridOpen: boolean = false;
  public hoveredRows: number = 0;
  public hoveredCols: number = 0;
  public rows = Array(10);
  public cols = Array(6);
  public isColorPickerOpen: boolean = false;

  @Output() shareDocumentClick = new EventEmitter<void>();

  @ViewChild('fontSizeInputEl') fontSizeInputEl!: ElementRef<HTMLInputElement>;

  menuOpen: string | null = null;

  @Output() colorSelected = new EventEmitter<string>();
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
  @Output() insertTable = new EventEmitter<void>();
  @Output() tableInsertWithSize = new EventEmitter<{ rows: number, cols: number }>();
  @Output() fontSelected = new EventEmitter<string>();
  @Output() downloadAsPdfClick = new EventEmitter<void>();
  @Output() exportClick = new EventEmitter<void>();
  @Output() importClick = new EventEmitter<void>();

  constructor(private elementRef: ElementRef, public dialog: MatDialog) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentSelectionFormat']) {
      if (!this.customSizeInputActive) {
        const currentSize = this.currentSelectionFormat?.['size'];
        if (currentSize === 'MIXED_VALUES') {
          this.sizeInputValue = '';
        } else if (currentSize && typeof currentSize === 'string') {
          const numericPart = currentSize.replace('px', '');
          if (!isNaN(parseFloat(numericPart))) {
            this.sizeInputValue = numericPart;
          } else {
            this.sizeInputValue = '';
          }
        } else {
          this.sizeInputValue = '';
        }
      }
    }
  }

  displaySelectedFontSize(): string {
    const size = this.currentSelectionFormat?.['size'];
    if (size === 'MIXED_VALUES') {
      return '';
    }
    if (size && typeof size === 'string') {
      const numericPart = size.replace('px', '');
      if (!isNaN(parseFloat(numericPart))) {
        return numericPart;
      }
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
    const colorContainer = this.elementRef.nativeElement.querySelector('.color-picker-container');
    if (colorContainer && !colorContainer.contains(target)) {
      this.isColorPickerOpen = false;
    }
    if (containerElement && !containerElement.contains(target)) {
      this.isSizeDropdownOpen = false;
      if (this.customSizeInputActive) {
        this.customSizeInputActive = false;
      }
    }
  }

  toggleMenu(menu: string): void {
    if (this.disabled) return;
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
  onExportClick(): void { this.exportClick.emit(); this.closeAllMenus(); }
  onImportClick(): void { this.importClick.emit(); this.closeAllMenus(); }

  handleMenuOption(option: string): void {
    switch (option) {
      case 'insert-new-page': this.addNewPage.emit(); break;
      case 'format-bold': this.onBoldClick(); break;
      case 'format-italic': this.onItalicClick(); break;
      case 'format-underline': this.onUnderlineClick(); break;
      case 'insert-link': this.onLinkClick(); break;
      case 'insert-table': this.insertTable.emit(); break;
      case 'download-pdf': this.downloadAsPdfClick.emit(); break;
      case 'export-d1': this.onExportClick(); break;
      case 'import-d1': this.onImportClick(); break;
      case 'share':
        console.log('ToolbarComponent: Share menu option clicked, emitting shareDocumentClick event.');
        this.shareDocumentClick.emit();
        break;
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
      const currentSize = this.currentSelectionFormat?.['size'];
      if (currentSize === 'MIXED_VALUES') {
        this.sizeInputValue = '';
      } else if (currentSize && typeof currentSize === 'string') {
        const numericPart = currentSize.replace('px', '');
        if (!isNaN(parseFloat(numericPart))) {
          this.sizeInputValue = numericPart;
        } else {
          this.sizeInputValue = '';
        }
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
    if (this.isSizeDropdownOpen && !this.customSizeInputActive) {
      const currentSize = this.currentSelectionFormat?.['size'];
      if (currentSize === 'MIXED_VALUES') {
        this.sizeInputValue = '';
      } else if (currentSize && typeof currentSize === 'string') {
        const numericPart = currentSize.replace('px', '');
        if (!isNaN(parseFloat(numericPart))) {
          this.sizeInputValue = numericPart;
        } else {
          this.sizeInputValue = '';
        }
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
      const currentSize = this.currentSelectionFormat?.['size'];
      if (currentSize === 'MIXED_VALUES') {
        this.sizeInputValue = '';
      } else if (currentSize && typeof currentSize === 'string') {
        const numericPart = currentSize.replace('px', '');
        if (!isNaN(parseFloat(numericPart))) {
          this.sizeInputValue = numericPart;
        } else {
          this.sizeInputValue = '';
        }
      } else {
        this.sizeInputValue = '';
      }
    }
  }

  cancelCustomSizeEdit(): void {
    this.customSizeInputActive = false;
    this.isSizeDropdownOpen = false;
    const currentSize = this.currentSelectionFormat?.['size'];
    if (currentSize === 'MIXED_VALUES') {
      this.sizeInputValue = '';
    } else if (currentSize && typeof currentSize === 'string' && currentSize !== 'MIXED_VALUES') {
      const numericPart = currentSize.replace('px', '');
      if (!isNaN(parseFloat(numericPart))) {
        this.sizeInputValue = numericPart;
      } else {
        this.sizeInputValue = '';
      }
    } else {
      this.sizeInputValue = '';
    }
  }
  onColorInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentColor = input.value;
  }

  handleGridMouseOver(row: number, col: number): void {
    this.hoveredRows = row;
    this.hoveredCols = col;
  }

  resetHovered(): void {
    this.hoveredRows = 0;
    this.hoveredCols = 0;
  }

  onSizeChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newSize = selectElement.value;
    if (newSize) {
      this.sizeSelected.emit(newSize);
    }
  }

  handleGridClick(rows: number, cols: number): void {
    this.tableInsertWithSize.emit({ rows, cols });
    this.isTableGridOpen = false;
    this.resetHovered();
  }

  toggleColorPicker(): void {
    if (this.disabled) return;
    this.isColorPickerOpen = !this.isColorPickerOpen;
    this.isTableGridOpen = false;
  }

  onApplyColorClick(): void {
    this.colorSelected.emit(this.currentColor);
    this.isColorPickerOpen = false;
  }

  toggleTableGrid(): void {
    if (this.disabled) return;
    this.isTableGridOpen = !this.isTableGridOpen;
    this.isColorPickerOpen = false;
  }

  onFontChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.fontSelected.emit(selectElement.value);
  }
  onBoldClick(): void { this.bold.emit(); }
  onItalicClick(): void { this.italic.emit(); }
  onUnderlineClick(): void { this.underline.emit(); }
  onLinkClick(): void { this.link.emit(); }

}