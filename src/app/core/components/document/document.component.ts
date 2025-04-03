import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToolbarComponent } from '../toolbar/toolbar.component';

/**
 * Component responsible for displaying and interacting with the Quill rich text editor.
 */
@Component({
  selector: 'app-document',
  standalone: true,
  imports: [ToolbarComponent],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss'],
  // Disable encapsulation to allow global Quill theme styles to apply correctly.
  encapsulation: ViewEncapsulation.None
})
export class DocumentComponent implements OnInit, AfterViewInit {
  /** The Quill editor instance. Initialized dynamically on the browser only. */
  editor: any; // Consider creating a Quill typings interface if needed
  /** The current title of the document. */
  title = 'Untitled Document';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  ngOnInit(): void {
    // Lifecycle hook for initial component setup (non-DOM related).
  }

  /**
   * Lifecycle hook called after the component's view has been fully initialized.
   * Used here to initialize the Quill editor only when running in a browser environment,
   * preventing errors during Server-Side Rendering (SSR).
   */
  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      try {
        // Dynamically import Quill to avoid loading it on the server.
        const Quill = (await import('quill')).default;
        this.initializeEditor(Quill);
      } catch (error) {
        console.error("Error loading or initializing Quill:", error);
        // Optionally display a user-friendly error message here
      }
    }
  }

  /**
   * Initializes the Quill editor instance on the designated container element.
   * @param Quill The Quill constructor obtained from the dynamic import.
   */
  initializeEditor(Quill: any): void {
    const container = document.getElementById('editor-container');
    if (container) {
       this.editor = new Quill(container, {
         modules: {
           // Uses the toolbar defined in the corresponding HTML template.
           toolbar: '#toolbar'
         },
         placeholder: 'Start writing...',
         theme: 'snow' // Use the 'snow' theme for styling
       });
    } else {
       console.error("Quill editor container '#editor-container' not found in the DOM.");
    }
  }

  /** Handles the 'New' action, clearing the editor and resetting the title. */
  handleNew(): void {
    console.log('Handling New Document...');
    // User confirmation before discarding potential changes.
    if (confirm('Are you sure you want to create a new document? Unsaved changes will be lost.')) {
      if (this.editor) {
        // Set content to a single newline, which represents an empty document in Quill.
        this.editor.setContents([{ insert: '\n' }]);
      }
      this.title = 'Untitled Document';
      // Manually update the H1 element if necessary (though [(ngModel)] would be more Angular-idiomatic).
      const titleElement = document.querySelector('.document-title');
      if (titleElement) {
         titleElement.textContent = this.title;
      }
    }
  }

  /** Handles the 'Save' action, retrieving content and saving (currently to localStorage). */
  handleSave(): void {
    console.log('Handling Save Document...');
    if (this.editor) {
      const content = this.editor.getContents(); // Get content as Quill Delta object.
      const json = JSON.stringify(content);
      // TODO: Replace localStorage with a proper backend API call for saving.
      localStorage.setItem('document-' + Date.now(), json);
      alert('Document saved! (to localStorage)');
    } else {
      console.warn("Editor not initialized, cannot save.");
      alert("Editor not ready, cannot save.");
    }
  }

  /** Handles the 'Print' action using the browser's print functionality. */
  handlePrint(): void {
    console.log('Handling Print Document...');
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    } else {
       console.warn("Print functionality is only available in the browser.");
    }
  }

  /** Handles the 'Download' action, exporting the editor content as a plain text file. */
  handleDownload(): void {
    console.log('Handling Download Document...');
    if (this.editor) {
      const text = this.editor.getText(); // Get content as plain text.
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // Use a temporary anchor element to trigger the download.
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.title || 'document') + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Clean up the object URL.
    } else {
       console.warn("Editor not initialized, cannot download.");
       alert("Editor not ready, cannot download.");
    }
  }

  /**
   * Updates the component's title property when the editable H1 element loses focus.
   * @param event The blur event from the contenteditable element.
   */
  updateTitle(event: any): void {
    const newTitle = event.target.innerText.trim();
    if (newTitle) {
      this.title = newTitle;
      console.log('Document title updated to:', this.title);
    } else {
       // Revert to the current title if the user clears the H1.
       event.target.innerText = this.title || 'Untitled Document';
    }
  }
}