import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, ViewEncapsulation, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import Quill from 'quill';
// Use Quill's Delta type if @types/quill is installed
// import Delta from 'quill-delta';

// Define Page interface and Delta type
interface DocumentPage {
  id: string;
  initialContent?: any;
}
// Use Quill's Delta type if @types/quill is installed, otherwise simplify
declare var Delta: { new (ops?: any[]): any; prototype: any; };

/**
 * Component managing multiple Quill instances, one per page.
 * NOTE: Does NOT implement automatic content flow between pages.
 */
@Component({
  selector: 'app-document',
  standalone: true,
  imports: [ CommonModule, ToolbarComponent ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DocumentComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Untitled Document';
  pages: DocumentPage[] = [{ id: this.generatePageId() }];
  editorInstances = new Map<string, Quill>();
  private QuillLib: any = null;
  private DeltaLib: any = null; // Use specific Delta type if imported
  private initialSetupDone = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void { }

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId) && !this.QuillLib) {
      try {
        this.QuillLib = (await import('quill')).default;
        this.DeltaLib = this.QuillLib.import('delta');

        const Size = this.QuillLib.import('attributors/style/size');
        this.QuillLib.register('attributors/style/size', Size, true);

        // Define and Register PageBreakBlot if using manual breaks
        // const BlockEmbed: any = this.QuillLib.import('blots/block/embed');
        // class PageBreakBlot extends BlockEmbed { /* ... */ static create(): Node { return super.create(); } }
        // this.QuillLib.register(PageBreakBlot);

        this.initializeVisiblePageEditors();
        this.initialSetupDone = true;

      } catch (error) {
        console.error("Error loading Quill or Delta:", error);
      }
    }
  }

  ngOnDestroy(): void {
    this.editorInstances.forEach(instance => { /* Basic cleanup */ });
    this.editorInstances.clear();
  }

  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private initializeVisiblePageEditors(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib) return;
    this.pages.forEach(page => {
      if (!this.editorInstances.has(page.id)) {
        const container = document.getElementById(page.id);
        if (container) {
          const editor = new this.QuillLib(container, {
            modules: { toolbar: [ /* Your Toolbar Config */ ] },
            placeholder: `Start typing on page ${this.pages.findIndex(p => p.id === page.id) + 1}...`,
            theme: 'snow'
          });
          if (page.initialContent) editor.setContents(page.initialContent, 'silent');
          this.editorInstances.set(page.id, editor);
        } else { console.warn(`Container element not found for page ID: ${page.id} during init attempt.`); }
      }
    });
  }

  addPage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib) return;
    const newPageId = this.generatePageId();
    this.pages.push({ id: newPageId });
    this.changeDetector.detectChanges();
    setTimeout(() => this.initializeVisiblePageEditors(), 10);
  }

  handleAddNewPage(): void { this.addPage(); }

  applyFontSize(size: string): void {
    const activeEditor = this.getActiveEditor();
    if (activeEditor) {
        if (size?.endsWith('px')) activeEditor.format('size', size);
        else if (size === '') activeEditor.format('size', false);
    } else { console.warn("Cannot apply font size, no active editor detected."); }
  }

  handleNew(): void {
     if (confirm('Are you sure? This will clear the entire document.')) {
        this.editorInstances.clear();
        this.pages = [{ id: this.generatePageId() }];
        this.title = 'Untitled Document';
        this.changeDetector.detectChanges();
        setTimeout(() => this.initializeVisiblePageEditors(), 10);
      }
  }

  /** Handles the 'Save' action (combines content from all pages) */
  handleSave(): void {
    console.log('Handling Save Document across pages...');
    if (!this.DeltaLib) {
        alert("Delta library not loaded.");
        return;
    }
    let fullDelta = new this.DeltaLib(); // Start with empty Delta
    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        const contents = instance.getContents();
        fullDelta = fullDelta.concat(contents);

        // Add separator logic (corrected)
        if (index < this.pages.length - 1) {
            const ops = contents.ops || [];
            let alreadyEndsWithNewline = false;
            // --- Start TypeScript Fix ---
            if (ops.length > 0) {
                const lastOp = ops[ops.length - 1];
                // Check if lastOp exists, has an insert property, AND that property is a string
                if (lastOp && typeof lastOp.insert === 'string') {
                    // Only call endsWith if it's definitely a string
                    if (lastOp.insert.endsWith('\n')) {
                        alreadyEndsWithNewline = true;
                    }
                }
                // If lastOp.insert is not a string (e.g., image, custom blot),
                // it doesn't end with a newline, so alreadyEndsWithNewline remains false.
            }
            // --- End TypeScript Fix ---

            if (!alreadyEndsWithNewline) {
                // Add a newline separator if the page content didn't end with one
                fullDelta = fullDelta.insert('\n');
            }
        }
      }
    });

    const json = JSON.stringify(fullDelta);
    console.log("Combined Delta for save:", json);
    localStorage.setItem('multi-page-doc-' + Date.now(), json);
    alert('Document saved (Combined)!');
  }


  handlePrint(): void {
     if (isPlatformBrowser(this.platformId)) { window.print(); }
     else { console.warn("Cannot print from server."); }
  }


  handleDownload(): void {
    console.log('Handling Download Document across pages...');
    let fullText = '';
    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        fullText += instance.getText();
        if (index < this.pages.length - 1) {
            fullText += '\n\n--- Page Break ---\n\n';
        }
      }
    });

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.title || 'document') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  updateTitle(event: any): void {
    const newTitle = event.target.innerText.trim();
    this.title = newTitle || 'Untitled Document';
  }

  private getActiveEditor(): Quill | null {
      if (!isPlatformBrowser(this.platformId)) return null;
      let activeElement = document.activeElement;
      while (activeElement) {
          if (activeElement.classList.contains('ql-editor')) {
             const editorContainer = activeElement.closest('.editor-instance-container');
             if (editorContainer?.id) return this.editorInstances.get(editorContainer.id) || null;
          }
          activeElement = activeElement.parentElement;
      }
      if (this.pages.length > 0) return this.editorInstances.get(this.pages[this.pages.length - 1].id) || null;
      return null;
  }

  handleUndo(): void {
    const activeEditor = this.getActiveEditor();
    if (activeEditor) activeEditor.history.undo();
    else console.warn("Undo: No active editor detected.");
  }

  handleRedo(): void {
     const activeEditor = this.getActiveEditor();
     if (activeEditor) activeEditor.history.redo();
     else console.warn("Redo: No active editor detected.");
  }
}