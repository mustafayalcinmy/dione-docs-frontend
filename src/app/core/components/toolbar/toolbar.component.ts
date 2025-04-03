import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Application's main toolbar component, handling top-level menus and quick actions.
 * Emits events for actions that need to be handled by the parent component (e.g., DocumentComponent).
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule], // Needed for *ngIf directive
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  /** Tracks which dropdown menu is currently open ('file', 'edit', etc.) */
  menuOpen: string | null = null;

  // --- Event Outputs for Parent Component ---

  /** Emits when the 'New' action is triggered. */
  @Output() newClick = new EventEmitter<void>();
  /** Emits when the 'Save' action is triggered. */
  @Output() saveClick = new EventEmitter<void>();
  /** Emits when the 'Download' action is triggered. */
  @Output() downloadClick = new EventEmitter<void>();
  /** Emits when the 'Print' action is triggered. */
  @Output() printClick = new EventEmitter<void>();
  /** Emits when the user requests an Undo action. */
  @Output() undoClick = new EventEmitter<void>(); // Renamed for clarity
  /** Emits when the user requests a Redo action. */
  @Output() redoClick = new EventEmitter<void>(); // Renamed for clarity

  /**
   * Toggles the visibility of a specific dropdown menu.
   * Closes any other currently open menu.
   * @param menu The identifier ('file', 'edit', etc.) of the menu to toggle.
   */
  toggleMenu(menu: string): void {
    const currentlyOpen = this.menuOpen;
    this.closeAllMenus(); // Close any open menu first
    // Open the new menu only if it wasn't the one already open
    if (currentlyOpen !== menu) {
      this.menuOpen = menu;
    }
  }

  /** Closes any currently open dropdown menu. */
  closeAllMenus(): void {
    this.menuOpen = null;
  }

  // --- Action Emitter Methods ---

  onNewClick(): void { this.newClick.emit(); this.closeAllMenus(); }
  onSaveClick(): void { this.saveClick.emit(); this.closeAllMenus(); }
  onDownloadClick(): void { this.downloadClick.emit(); this.closeAllMenus(); }
  onPrintClick(): void { this.printClick.emit(); this.closeAllMenus(); }
  onUndoClick(): void { console.log("Undo clicked in toolbar"); this.undoClick.emit(); this.closeAllMenus(); }
  onRedoClick(): void { console.log("Redo clicked in toolbar"); this.redoClick.emit(); this.closeAllMenus(); }

  /**
   * Handles clicks on generic menu options.
   * Placeholder for future functionality (e.g., Cut, Copy, Paste implementations).
   * @param option Identifier for the clicked menu option.
   */
  handleMenuOption(option: string): void {
    console.log("Menu option clicked:", option);
    // TODO: Implement logic or emit events for specific menu options (Cut, Copy, Paste, etc.)
    this.closeAllMenus();
  }
}