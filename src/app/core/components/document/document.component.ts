// dione-docs-frontend/src/app/core/components/document/document.component.ts
import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, ViewEncapsulation, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import Quill from 'quill'; // Quill'i doğrudan import et
import Delta from 'quill-delta'; // Delta'yı doğrudan import et

// Quill tipleri için arayüzler ve takma adlar
interface QuillRange { index: number; length: number; }
type QuillSources = 'user' | 'api' | 'silent';
type QuillDeltaOperation = any;
interface QuillDelta { ops: QuillDeltaOperation[]; }

type QuillBlockBlot = any;

interface DocumentPage {
  id: string;
  initialContent?: QuillDelta;
}

const QUILL_FONT_SIZES_WHITELIST = ['8px','9px','10px','12px','14px','16px','20px','24px','32px','42px','54px','68px','84px','98px'];

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent
  ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DocumentComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Untitled Document';
  pages: DocumentPage[] = [{ id: this.generatePageId() }];
  editorInstances = new Map<string, Quill>();
  public QuillLib: typeof Quill | null = null;
  private DeltaConstructor: typeof Delta | null = null; // Delta constructor'ını saklamak için
  private Parchment: any = null;

  private activeEditorInstanceId: string | null = null;
  private lastKnownSelection: { editorId: string, range: QuillRange } | null = null;
  public currentSelectionFormatState: any = {};

  private PAGE_CONTENT_TARGET_HEIGHT_PX = 864;
  private overflowCheckScheduled = false;
  private reflowCheckScheduled = false;
  private currentlyCheckingOverflow = false;


  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void { }

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.QuillLib) {
        try {
          const QuillImport = await import('quill');
          this.QuillLib = QuillImport.default;
          this.DeltaConstructor = Delta; 
          
          if (this.QuillLib && this.DeltaConstructor) {
            this.Parchment = this.QuillLib.import('parchment');

            const SizeStyleAttributor = this.QuillLib.import('attributors/style/size') as any;
            if (SizeStyleAttributor) {
              SizeStyleAttributor.whitelist = QUILL_FONT_SIZES_WHITELIST;
              this.QuillLib.register(SizeStyleAttributor, true);
            } else {
              console.error("Failed to import 'attributors/style/size'");
            }
            
            this.initializeVisiblePageEditors();

            setTimeout(() => {
              if (this.pages.length > 0) {
                const firstPageDiv = document.getElementById(this.pages[0].id);
                if (firstPageDiv) {
                  const editorInstanceContainer = firstPageDiv.querySelector('.editor-instance-container') as HTMLElement;
                  if (editorInstanceContainer) {
                    const inchesToPx = (inches: number) => inches * 96;
                    this.PAGE_CONTENT_TARGET_HEIGHT_PX = inchesToPx(11 - 2);
                  }
                }
              }
            }, 200);
          } else {
             console.error("Failed to load Quill library or Delta constructor!");
          }
        } catch (error) {
          console.error("Error loading Quill or related modules:", error);
        }
      } else {
        this.initializeVisiblePageEditors();
      }
    }
  }

  ngOnDestroy(): void {
    this.editorInstances.forEach((editor) => {});
    this.editorInstances.clear();
  }

  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private initializeVisiblePageEditors(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib || !this.DeltaConstructor) return;
    const quillSourcesUser = this.QuillLib.sources.USER as QuillSources;

    this.pages.forEach(page => {
      if (!this.editorInstances.has(page.id) && this.QuillLib) { // QuillLib kontrolü eklendi
        const container = document.getElementById(page.id);
        if (container) {
          const editor = new this.QuillLib(container, {
            modules: {
                toolbar: false,
                history: { delay: 2000, maxStack: 500, userOnly: true }
            },
            placeholder: `Page ${this.pages.findIndex(p => p.id === page.id) + 1} content...`,
            theme: 'snow'
          });

          if (page.initialContent && this.DeltaConstructor) { // DeltaConstructor kontrolü
             editor.setContents(new this.DeltaConstructor(page.initialContent.ops) as any, quillSourcesUser);
          }
          this.editorInstances.set(page.id, editor);

          editor.on('editor-change', (eventName: string, ...args: any[]) => {
            if (!this.QuillLib) return; // QuillLib kontrolü
            if (eventName === 'selection-change') {
              const range = args[0] as QuillRange | null;
              if (editor.hasFocus()) {
                this.activeEditorInstanceId = page.id;
                if (range) {
                  this.lastKnownSelection = { editorId: page.id, range: range };
                  this.updateCurrentSelectionFormatState(editor, range);
                } else {
                  const cursorRange = editor.getSelection();
                  this.updateCurrentSelectionFormatState(editor, cursorRange); 
                  this.lastKnownSelection = cursorRange ? { editorId: page.id, range: cursorRange } : null;
                }
              }
            } else if (eventName === 'text-change') {
              const source = args[2] as QuillSources; 
              if (source === quillSourcesUser) {
                if (editor.hasFocus()) this.activeEditorInstanceId = page.id;
                this._scheduleOverflowCheck(page.id, editor);
                this.scheduleReflowCheck(page.id, editor);
                const currentSelection = editor.getSelection();
                if (currentSelection) {
                    this.updateCurrentSelectionFormatState(editor, currentSelection);
                }
              }
            }
          });
          
          editor.root.addEventListener('blur', () => {
            setTimeout(() => {
              const activeElement = document.activeElement;
              const toolbarElement = document.querySelector('app-toolbar');
              if (!toolbarElement || (activeElement && !toolbarElement.contains(activeElement))) {
                // Odak toolbar dışındaysa isteğe bağlı olarak formatı temizle
              }
            }, 0);
          });
        }
      }
    });

    if (!this.activeEditorInstanceId && this.pages.length > 0) {
        const firstPageId = this.pages[0].id;
        if (this.editorInstances.has(firstPageId)) {
            this.activeEditorInstanceId = firstPageId;
        }
    }
  }
  
  updateCurrentSelectionFormatState(editor: Quill, range: QuillRange | null): void {
    let formats = {};
    if (range) {
      formats = editor.getFormat(range); 
      if (range.length > 0) {
        let commonSize: string | 'MIXED_VALUES' | undefined | null = undefined;
        let firstOp = true;
        const selectedDelta = editor.getContents(range.index, range.length);

        for (const op of selectedDelta.ops) {
          const opSize: any = op.attributes?.['size'];
          if (firstOp) {
            commonSize = opSize;
            firstOp = false;
          } else if (commonSize !== opSize) {
            commonSize = 'MIXED_VALUES';
            break;
          }
        }
        
        if (commonSize === 'MIXED_VALUES') {
          (formats as any)['size'] = 'MIXED_VALUES';
        } else if (commonSize != null) {
          (formats as any)['size'] = commonSize;
        } else {
          delete (formats as any)['size'];
        }
      }
    }
    this.currentSelectionFormatState = { ...formats };
    this.changeDetector.detectChanges();
  }

  private _scheduleOverflowCheck(pageId: string, editor: Quill): void {
    if (this.overflowCheckScheduled) return;
    this.overflowCheckScheduled = true;
    setTimeout(() => {
      if (this.editorInstances.get(pageId) === editor && !this.currentlyCheckingOverflow) {
        this.currentlyCheckingOverflow = true;
        this._checkAndHandlePageOverflow(pageId, editor).finally(() => {
            this.currentlyCheckingOverflow = false;
        });
      }
      this.overflowCheckScheduled = false;
    }, 300);
  }

  applyFormat(formatKey: string, value: any): void {
    const editorToFormat = this.getEditorToFormat();
    const localQuillLib = this.QuillLib; // Yerel değişkene ata

    if (editorToFormat && localQuillLib) { // localQuillLib kontrolü eklendi
      let targetRange = (this.lastKnownSelection?.editorId === editorToFormat.root.id)
                        ? this.lastKnownSelection.range 
                        : editorToFormat.getSelection();

      if (targetRange) {
        if (targetRange.length > 0) {
          editorToFormat.formatText(targetRange.index, targetRange.length, formatKey, value, localQuillLib.sources.USER as QuillSources);
        } else { 
          editorToFormat.format(formatKey, value, localQuillLib.sources.USER as QuillSources);
        }
      } else {
        editorToFormat.focus(); 
        targetRange = editorToFormat.getSelection();
        if (targetRange) {
           if (targetRange.length > 0) {
             editorToFormat.formatText(targetRange.index, targetRange.length, formatKey, value, localQuillLib.sources.USER as QuillSources);
           } else {
             editorToFormat.format(formatKey, value, localQuillLib.sources.USER as QuillSources);
           }
        } else {
            console.warn('Still no selection after focus to apply format.');
        }
      }
      const currentSelectionAfterFormat = editorToFormat.getSelection();
      if (currentSelectionAfterFormat) {
          this.updateCurrentSelectionFormatState(editorToFormat, currentSelectionAfterFormat);
      }
    } else {
      console.warn('No target editor found or QuillLib not loaded to apply format.');
    }
  }

  private getEditorToFormat(): Quill | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    
    const lastSelectedEditorId = this.lastKnownSelection?.editorId;
    if (lastSelectedEditorId) {
      const editor = this.editorInstances.get(lastSelectedEditorId);
      if (editor) return editor;
    }
    
    if (this.activeEditorInstanceId) {
      const editor = this.editorInstances.get(this.activeEditorInstanceId);
      if (editor) return editor;
    }

    if (isPlatformBrowser(this.platformId)) {
        for (const editor of this.editorInstances.values()) {
            if (editor.hasFocus()) {
                this.activeEditorInstanceId = editor.root.id;
                return editor;
            }
        }
    }
    if (this.editorInstances.size > 0) {
        return this.editorInstances.values().next().value || null;
    }
    return null;
  }
  
  private getFormatForToggle(formatName: string): any {
    const editor = this.getEditorToFormat();
    if (!editor) return undefined;

    const range = (this.lastKnownSelection && this.lastKnownSelection.editorId === editor.root.id)
                  ? this.lastKnownSelection.range
                  : editor.getSelection();
                  
    if (range) {
      return !!editor.getFormat(range)[formatName]; // !! ile boolean'a çevirme
    }
    const currentFormats = editor.getFormat(editor.getSelection()?.index || 0);
    return !!currentFormats[formatName]; // !! ile boolean'a çevirme
  }

  applyFontSize(size: string): void { this.applyFormat('size', size ? size : false); }
  
  toggleBold(): void { this.applyFormat('bold', !this.getFormatForToggle('bold')); }
  toggleItalic(): void { this.applyFormat('italic', !this.getFormatForToggle('italic')); }
  toggleUnderline(): void { this.applyFormat('underline', !this.getFormatForToggle('underline')); }

  insertLink(): void {
      const editor = this.getEditorToFormat();
      const localQuillLib = this.QuillLib; // Yerel değişkene ata
      if (editor && localQuillLib) { // localQuillLib kontrolü
          const url = prompt("Enter link URL:");
          if (url) {
            const selectionToUse = (this.lastKnownSelection && this.lastKnownSelection.editorId === editor.root.id)
                                   ? this.lastKnownSelection.range
                                   : editor.getSelection();
            if (selectionToUse) {
              editor.format('link', url, localQuillLib.sources.USER as QuillSources);
              this.updateCurrentSelectionFormatState(editor, editor.getSelection());
            }
          }
      }
  }
  handleUndo(): void { 
    const editor = this.getEditorToFormat();
    if (editor) editor.history.undo(); 
  }
  handleRedo(): void { 
    const editor = this.getEditorToFormat();
    if (editor) editor.history.redo(); 
  }

  private scheduleReflowCheck(pageId: string, editor: Quill): void {
    if (this.reflowCheckScheduled) return;
    this.reflowCheckScheduled = true;
    setTimeout(() => {
        if (this.editorInstances.get(pageId) === editor && !this.currentlyCheckingOverflow) {
            this._checkAndHandleReflow(pageId, editor);
        }
        this.reflowCheckScheduled = false;
    }, 450);
  }

  private async _checkAndHandleReflow(currentPageId: string, currentEditor: Quill): Promise<void> {
    if (!this.QuillLib || !this.DeltaConstructor || this.PAGE_CONTENT_TARGET_HEIGHT_PX <= 0 || this.currentlyCheckingOverflow || !currentEditor.root) return;

    const editorRoot = currentEditor.root as HTMLElement;
    const editorContentHeight = editorRoot.scrollHeight;
    const currentPageIndex = this.pages.findIndex(p => p.id === currentPageId);

    if (currentPageIndex < this.pages.length - 1 && editorContentHeight < this.PAGE_CONTENT_TARGET_HEIGHT_PX * 0.7) {
        const nextPageId = this.pages[currentPageIndex + 1].id;
        const nextPageEditor = this.editorInstances.get(nextPageId);

        if (nextPageEditor && nextPageEditor.getLength() > 1) {
            const firstLineInfo = this.getFirstLineInfo(nextPageEditor);
            if (!firstLineInfo || !this.DeltaConstructor) return;

            const { delta: lineDelta, length: lineLength } = firstLineInfo;
            const originalContent = currentEditor.getContents();
            const currentLength = originalContent.length();

            let tempDelta = new this.DeltaConstructor(); 
            if (currentLength > 1 && originalContent.ops[originalContent.ops.length-1]?.insert !== '\n') {
                tempDelta = tempDelta.retain(currentLength).insert('\n');
            } else {
                tempDelta = tempDelta.retain(currentLength > 0 ? currentLength -1 : 0);
            }
            tempDelta = tempDelta.concat(lineDelta); // lineDelta zaten bir Delta instance olmalı
            
            currentEditor.updateContents(tempDelta as any, this.QuillLib.sources.SILENT as QuillSources);
            const newEditorRoot = currentEditor.root as HTMLElement;

            if (newEditorRoot.scrollHeight <= this.PAGE_CONTENT_TARGET_HEIGHT_PX + 30) {
                nextPageEditor.deleteText(0, lineLength, this.QuillLib.sources.SILENT as QuillSources);
                if (nextPageEditor.getLength() <=1 && this.pages.length > 1 && currentPageIndex + 1 < this.pages.length) {
                  this.removePage(nextPageId);
                }
            } else {
                currentEditor.setContents(originalContent as any, this.QuillLib.sources.SILENT as QuillSources);
            }
        } else if (nextPageEditor && nextPageEditor.getLength() <= 1 && this.pages.length > 1 && currentPageIndex + 1 < this.pages.length) {
            this.removePage(nextPageId);
        }
    }
  }
  
  private getFirstLineInfo(editor: Quill): { delta: Delta, length: number } | null {
      if (!this.DeltaConstructor || !editor.scroll || !editor.scroll.children.head) return null;
      const firstLineBlot = editor.scroll.children.head as any; 
      if (firstLineBlot) {
          const lineIndex = editor.getIndex(firstLineBlot);
          const lineLengthWithNewline = firstLineBlot.length(); 
          if (lineLengthWithNewline > 0) {
            const lineDeltaContents = editor.getContents(lineIndex, lineLengthWithNewline);
            return { delta: new this.DeltaConstructor(lineDeltaContents.ops), length: lineLengthWithNewline };
          }
      }
      return null;
    }
  addPage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib) { return; }
    const newPageId = this.generatePageId();
    this.pages.push({ id: newPageId });
    this.changeDetector.detectChanges();
    setTimeout(() => {
      this.initializeVisiblePageEditors();
      const newEditorInstance = this.editorInstances.get(newPageId);
      if (newEditorInstance) {
        this.activeEditorInstanceId = newPageId;
        setTimeout(() => { newEditorInstance.focus(); }, 0);
      }
    }, 50);
  }
  private removePage(pageId: string): void {
    const pageIndex = this.pages.findIndex(p => p.id === pageId);
    if (pageIndex > -1 && this.pages.length > 1) {
        this.pages.splice(pageIndex, 1);
        this.editorInstances.delete(pageId);
        this.changeDetector.detectChanges();
        if (this.activeEditorInstanceId === pageId || !this.editorInstances.has(this.activeEditorInstanceId!)) {
            const newActiveId = this.pages[Math.max(0, pageIndex -1)]?.id || this.pages[0]?.id || null;
            this.activeEditorInstanceId = newActiveId;
        }
    }
  }
  private async _checkAndHandlePageOverflow(currentPageId: string, currentEditor: Quill): Promise<void> {
    if (!this.QuillLib || !this.DeltaConstructor || this.PAGE_CONTENT_TARGET_HEIGHT_PX <= 0 || !currentEditor.root) return;
    const editorRoot = currentEditor.root as HTMLElement;
    const editorContentHeight = editorRoot.scrollHeight;
    if (editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
      await this.splitAndMoveContent(currentPageId, currentEditor, this.PAGE_CONTENT_TARGET_HEIGHT_PX);
    }
  }
  private async splitAndMoveContent(sourcePageId: string, sourceEditor: Quill, maxHeight: number): Promise<void> {
    if (!this.QuillLib || !this.DeltaConstructor || !sourceEditor.scroll) return;
    let splitIndex = 0;
    const linesIterator: Iterable<QuillBlockBlot> = sourceEditor.scroll.lines();
    for (const lineBlot of linesIterator) {
        const lineNode = (lineBlot as any).domNode as HTMLElement; 
        if (!lineNode) continue;
        const lineBottomInEditor = lineNode.offsetTop + lineNode.offsetHeight;
        if (lineBottomInEditor <= maxHeight) {
            splitIndex = sourceEditor.getIndex(lineBlot as any) + (lineBlot as any).length();
        } else {
            if (splitIndex === 0) { 
                splitIndex = sourceEditor.getIndex(lineBlot as any);
            }
            break;
        }
    }
    if (splitIndex === 0 && sourceEditor.getLength() > 1) {
        const firstLineBlot = sourceEditor.scroll.children.head as QuillBlockBlot | null; 
        if (firstLineBlot && sourceEditor.getIndex(firstLineBlot) + (firstLineBlot as any).length() >= sourceEditor.getLength() -1 ) {
             return; 
        }
        if (firstLineBlot) {
           splitIndex = (firstLineBlot as any).length();
        } else {
           return; 
        }
    }

    if (splitIndex > 0 && splitIndex < sourceEditor.getLength()) {
        const overflowDeltaOps = sourceEditor.getContents(splitIndex).ops;
        if (!overflowDeltaOps || overflowDeltaOps.length === 0 || !this.DeltaConstructor) return;
        const overflowDelta = new this.DeltaConstructor(overflowDeltaOps);

        sourceEditor.deleteText(splitIndex, sourceEditor.getLength() - splitIndex, this.QuillLib.sources.SILENT as QuillSources);
        const currentPageIndex = this.pages.findIndex(p => p.id === sourcePageId);
        if (currentPageIndex === -1) return;
        let nextPageId: string;
        let nextPageEditor: Quill | undefined;
        if (currentPageIndex === this.pages.length - 1) {
            nextPageId = this.generatePageId();
            this.pages.push({ id: nextPageId });
            this.changeDetector.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 50)); 
            this.initializeVisiblePageEditors(); 
            nextPageEditor = this.editorInstances.get(nextPageId);
            if (nextPageEditor) {
                nextPageEditor.setContents(overflowDelta as any, this.QuillLib.sources.SILENT as QuillSources);
                await this._checkAndHandlePageOverflow(nextPageId, nextPageEditor);
            }
        } else {
            nextPageId = this.pages[currentPageIndex + 1].id;
            nextPageEditor = this.editorInstances.get(nextPageId);
            if (nextPageEditor && this.DeltaConstructor) { // DeltaConstructor kontrolü
                const currentNextPageContentOps = nextPageEditor.getContents().ops;
                const newDelta = overflowDelta.concat(new this.DeltaConstructor(currentNextPageContentOps));
                nextPageEditor.setContents(newDelta as any, this.QuillLib.sources.SILENT as QuillSources);
                await this._checkAndHandlePageOverflow(nextPageId, nextPageEditor);
            }
        }
    }
  }
  handleAddNewPage(): void { this.addPage(); }

  handleNew(): void {
    const localQuillLib = this.QuillLib;
    const localDeltaConstructor = this.DeltaConstructor;

    if (!localQuillLib || !localDeltaConstructor) {
        console.error("QuillLib or DeltaConstructor not initialized for handleNew");
        return;
    }
    if (confirm('Are you sure? This will clear the entire document and cannot be undone.')) {
        this.editorInstances.forEach(editor => editor.setContents(new localDeltaConstructor() as any, localQuillLib.sources.SILENT as QuillSources));
        this.editorInstances.clear();
        this.activeEditorInstanceId = null;
        this.lastKnownSelection = null;
        this.currentSelectionFormatState = {};
        this.pages = [{ id: this.generatePageId() }];
        this.title = 'Untitled Document';
        const titleElement = document.querySelector('.document-title');
        if (titleElement) titleElement.textContent = this.title;
        this.changeDetector.detectChanges();
        setTimeout(() => {
            this.initializeVisiblePageEditors();
            if (this.pages.length > 0 && this.editorInstances.has(this.pages[0].id)) {
                this.activeEditorInstanceId = this.pages[0].id;
            }
        }, 50);
      }
  }

  handleSave(): void {
    const localDeltaConstructor = this.DeltaConstructor; // Yerel değişkene ata
    if (!localDeltaConstructor || !this.QuillLib) { 
        alert("Error: Delta or Quill library not loaded."); 
        return; 
    }
    let fullDelta = new localDeltaConstructor(); // Yerel değişkeni kullan
    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        const contents = instance.getContents();
        if (contents && contents.ops && localDeltaConstructor) { // localDeltaConstructor kontrolü
            fullDelta = fullDelta.concat(new localDeltaConstructor(contents.ops));
        }
        if (index < this.pages.length - 1) {
            const ops = contents.ops || [];
            let alreadyEndsWithNewline = false;
            if (ops.length > 0) {
                const lastOp = ops[ops.length - 1];
                if (lastOp && typeof lastOp.insert === 'string' && lastOp.insert.endsWith('\n')) {
                    alreadyEndsWithNewline = true;
                }
            }
            if (!alreadyEndsWithNewline) {
                fullDelta = fullDelta.insert('\n');
            }
        }
      }
    });
    const json = JSON.stringify(fullDelta.ops);
    localStorage.setItem('multi-page-doc-' + Date.now(), json);
    alert('Document saved (Combined to localStorage)!');
  }
  handlePrint(): void { if (isPlatformBrowser(this.platformId)) window.print(); }
  handleDownload(): void {
    let fullText = '';
    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        fullText += instance.getText();
        if (index < this.pages.length - 1 && !fullText.endsWith('\n\n')) {
             if(fullText.endsWith('\n')) fullText += '\n--- Page Break ---\n\n';
             else fullText += '\n\n--- Page Break ---\n\n';
        } else if (index < this.pages.length - 1) {
            fullText += '--- Page Break ---\n\n';
        }
      }
    });
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.title || 'document') + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  updateTitle(event: any): void {
    const newTitle = event.target.innerText.trim();
    this.title = newTitle || 'Untitled Document';
    if (!newTitle && event.target.innerText.trim() !== this.title) {
        event.target.innerText = this.title;
    }
  }
}