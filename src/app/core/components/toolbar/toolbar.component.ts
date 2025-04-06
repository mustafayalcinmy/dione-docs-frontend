import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Application's main toolbar component. Emits events for parent component to handle.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  menuOpen: string | null = null;

  // --- Outputs ---
  @Output() newClick = new EventEmitter<void>();
  @Output() saveClick = new EventEmitter<void>();
  @Output() downloadClick = new EventEmitter<void>();
  @Output() printClick = new EventEmitter<void>();
  @Output() undoClick = new EventEmitter<void>();
  @Output() redoClick = new EventEmitter<void>();
  /** Emits when 'Add New Page' is selected from the Insert menu. */
  @Output() addNewPage = new EventEmitter<void>(); // Changed from insertPageBreak
  /** Emits when a custom font size is entered (if input exists). */
  @Output() fontSizeChange = new EventEmitter<string>();

  toggleMenu(menu: string): void {
    const currentlyOpen = this.menuOpen;
    this.closeAllMenus();
    if (currentlyOpen !== menu) {
      this.menuOpen = menu;
    }
  }

  closeAllMenus(): void {
    this.menuOpen = null;
  }

  // --- Emitters for Actions ---
  onNewClick(): void { this.newClick.emit(); this.closeAllMenus(); }
  onSaveClick(): void { this.saveClick.emit(); this.closeAllMenus(); }
  onDownloadClick(): void { this.downloadClick.emit(); this.closeAllMenus(); }
  onPrintClick(): void { this.printClick.emit(); this.closeAllMenus(); }
  onUndoClick(): void { this.undoClick.emit(); this.closeAllMenus(); }
  onRedoClick(): void { this.redoClick.emit(); this.closeAllMenus(); }

  /** Handles clicks on generic menu options or specific actions like adding a page. */
  handleMenuOption(option: string): void {
    console.log("Menu option clicked:", option);
    if (option === 'insert-new-page') { // Use correct identifier
      this.addNewPage.emit(); // Emit the event for adding a page div
    } else {
      // Handle other generic options if needed
    }
    this.closeAllMenus();
  }

  // --- Handler for Custom Font Size Input (if input exists in toolbar HTML) ---
  onSizeInputChange(value: string | number): void {
    const size = parseInt(value as string, 10);
    if (!isNaN(size) && size > 0 && size < 1000) {
        this.fontSizeChange.emit(`${size}px`);
    } else if (value === '' || value === null) {
        // this.fontSizeChange.emit(''); // Optional: signal to clear format
    }
    this.closeAllMenus();
  }
}