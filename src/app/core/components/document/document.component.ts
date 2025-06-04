import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, ViewEncapsulation, ChangeDetectorRef, OnDestroy, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import Quill from 'quill';
import Delta, { Op } from 'quill-delta';
import { Observable, Subject, Subscription, of } from 'rxjs';
import { debounceTime, filter, switchMap, tap, catchError } from 'rxjs/operators';

import { DocumentService } from '../../services/document.service';
import { AuthService } from '../../services/auth.service';
import { QuillDelta, DocumentPayload } from '../../dto/document.dto';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ShareDialogComponent, ShareDialogData } from '../share-dialog/share-dialog.component';


interface QuillRange { index: number; length: number; }
type QuillSources = 'user' | 'api' | 'silent';

interface DocumentPage {
  id: string;
  initialContent?: QuillDelta;
}
interface BetterTableModule {
  insertTable(rows: number, columns: number): void;
}

const QUILL_FONT_SIZES_WHITELIST = ['8px', '9px', '10px', '12px', '14px', '16px', '20px', '24px', '32px', '42px', '54px', '68px', '84px', '98px'];
const QUILL_FONT_STYLES_WHITELIST = [
  'arial, sans-serif',
  'Comic Sans MS, cursive',
  'courier-new, monospace',
  'garamond, serif',
  'georgia, serif',
  'helvetica, sans-serif',
  'impact, sans-serif',
  'lato, sans-serif',
  'montserrat, sans-serif',
  'roboto, sans-serif',
  'times-new-roman, serif',
  'verdana, sans-serif'
];
@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DocumentComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Untited Document';
  pages: DocumentPage[] = [];
  editorInstances = new Map<string, Quill>();
  public QuillLib: typeof Quill | null = null;
  private DeltaConstructor: typeof Delta | null = null;
  private Parchment: any = null;
  private activeTypingFormats: any = {};
  public saveIconState: 'hidden' | 'unsaved' | 'saving' | 'saved' | 'error' = 'hidden';
  private saveTimeout: any;
  private activeEditorInstanceId: string | null = null;
  private lastKnownSelection: { editorId: string, range: QuillRange } | null = null;
  public currentSelectionFormatState: any = {};

  private PAGE_CONTENT_TARGET_HEIGHT_PX = 864;
  private overflowCheckScheduled = false;
  private reflowCheckScheduled = false;
  private currentlyCheckingOverflow = false;

  private currentDocumentId: string | null = null;
  private currentDocumentVersion: number = 1;
  private currentDocumentOwnerId: string | null = null;
  private currentDocumentIsPublic: boolean = false;
  private currentDocumentStatus: string = 'draft';
  private currentDocumentDescription: string = '';
  private isDirty = false;
  public saveStatus: string = 'Tüm değişiklikler kaydedildi';
  private autoSaveSubject = new Subject<void>();
  private autoSaveSubscription: Subscription | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private changeDetector: ChangeDetectorRef,
    private documentService: DocumentService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    public dialog: MatDialog
  ) { }

  ngOnInit(): void {
    if (this.pages.length === 0 && !this.route.snapshot.paramMap.get('id')) {
      this.pages.push({ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } });
    }
    this.initializeAutoSave();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.isDirty) {
      $event.returnValue = true;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.QuillLib) {
        try {
          const QuillImport = await import('quill');
          this.QuillLib = QuillImport.default;
          const DeltaImport = await import('quill-delta');
          this.DeltaConstructor = DeltaImport.default;
          const QuillBetterTable = (await import('quill-better-table')).default;

          if (this.QuillLib && this.DeltaConstructor) {
            this.QuillLib.register({
              'modules/better-table': QuillBetterTable
            }, true);
            this.Parchment = this.QuillLib.import('parchment');
            const FontStyle = this.QuillLib.import('attributors/style/font') as any;

            FontStyle.whitelist = QUILL_FONT_STYLES_WHITELIST;
            this.QuillLib.register(FontStyle, true);
            const SizeStyleAttributor = this.QuillLib.import('attributors/style/size') as any;
            if (SizeStyleAttributor) {
              SizeStyleAttributor.whitelist = QUILL_FONT_SIZES_WHITELIST;
              this.QuillLib.register(SizeStyleAttributor, true);
            }

            const inchesToPx = (inches: number) => inches * 96;
            this.PAGE_CONTENT_TARGET_HEIGHT_PX = inchesToPx(11 - 1 - 1);

            const ColorStyleAttributor = this.QuillLib.import('attributors/style/color') as any;
            if (ColorStyleAttributor) {
              this.QuillLib.register(ColorStyleAttributor, true);
            }
            this.route.paramMap.subscribe(params => {
              const id = params.get('id');
              if (id) {
                this.loadDocumentData(id);
              } else {
                this.title = 'Adsız Döküman';
                this.updateTitleInDOM();
                this.initializeVisiblePageEditors();
                if (this.pages.length > 0 && this.editorInstances.has(this.pages[0].id)) {
                  this.activeEditorInstanceId = this.pages[0].id;
                  setTimeout(() => this.editorInstances.get(this.pages[0].id)?.focus(), 0);
                }
              }
            });
          }
        } catch (error) {
        }
      } else {
        this.route.paramMap.subscribe(params => {
          const id = params.get('id');
          if (id) {
            this.loadDocumentData(id);
          } else {
            this.initializeVisiblePageEditors();
          }
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.editorInstances.forEach((editor) => { });
    this.editorInstances.clear();
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
  }

  private initializeAutoSave(): void {
    this.autoSaveSubscription = this.autoSaveSubject.pipe(
      debounceTime(500),
      filter(() => this.isDirty && !!this.currentDocumentId),
      tap(() => {
        this.saveIconState = 'saving';
        this.changeDetector.detectChanges();
      }),
      switchMap(() => this._autoSaveDocument().pipe(
        catchError((err) => {
          this.saveIconState = 'error';
          this.isDirty = true;
          this.changeDetector.detectChanges();
          console.error("Otomatik kaydetme hatası:", err);
          return of(null);
        })
      ))
    ).subscribe(result => {
      if (result) {
        this.saveIconState = 'saved';
        this.isDirty = false;
        this.currentDocumentVersion = result.version ?? this.currentDocumentVersion;
        this.changeDetector.detectChanges();
      }
    });
  }

  private _autoSaveDocument(): Observable<DocumentPayload | null> {
    if (!this.currentDocumentId) {
      return of(null);
    }

    const finalDelta = this.getCombinedDelta();
    if (!finalDelta) return of(null);

    return this.documentService.updateDocument(
      this.currentDocumentId,
      this.title ?? null,
      this.currentDocumentDescription ?? null,
      finalDelta,
      this.currentDocumentIsPublic,
      this.currentDocumentStatus ?? null
    );
  }

  private getCombinedDelta(): QuillDelta | null {
    const localDeltaConstructor = this.DeltaConstructor;
    if (!localDeltaConstructor || !this.QuillLib) {
      return null;
    }

    let combinedOps: Op[] = [];
    const explicitPageBreakOp: Op = { insert: '\n', attributes: { 'explicitPageBreak': true } };

    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      const content = instance ? instance.getContents() : page.initialContent;
      if (content && content.ops) {
        combinedOps = combinedOps.concat(content.ops);
        if (index < this.pages.length - 1) {
          combinedOps.push(explicitPageBreakOp);
        }
      }
    });

    return { ops: combinedOps };
  }


  preventEnterKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const currentText = target.innerText || '';
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
    if (allowedKeys.includes(event.key)) return;
    if (event.key === 'Enter' || currentText.length >= 50) {
      event.preventDefault();
    }
  }

  goBackToMainPage(): void {
    if (this.isDirty) {
      const userConfirmed = confirm('Kaydedilmemiş değişiklikler var. Yine de sayfadan ayrılmak istediğinize emin misiniz?');
      if (userConfirmed) {
        this.router.navigate(['/main-page']);
      }
    } else {
      this.router.navigate(['/main-page']);
    }
  }

  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private initializeVisiblePageEditors(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib || !this.DeltaConstructor) {
      return;
    }
    const quillSourcesUser = this.QuillLib.sources.USER;
    const quillSourcesSilent = this.QuillLib.sources.SILENT;

    this.pages.forEach(page => {
      if (!this.editorInstances.has(page.id) && this.QuillLib && this.DeltaConstructor) {
        const container = document.getElementById(page.id);
        if (container) {

          const editor = new this.QuillLib(container, {
            modules: {
              toolbar: false,
              history: { delay: 500, maxStack: 20, userOnly: true },
              table: true,
              'better-table': {
                operationMenu: {
                  items: {
                    unmergeCells: { text: 'Unmerge cells' },
                    toolTip: { text: 'Actions' }
                  },
                  color: {
                    colors: ['#000000', '#ffffff', '#ff0000', '#008000'],
                    text: 'Border Colors'
                  }
                }
              }
            },
            placeholder: `Sayfa ${this.pages.findIndex(p => p.id === page.id) + 1} içeriği...`,
            theme: 'snow'
          });

          if (page.initialContent && page.initialContent.ops && page.initialContent.ops.length > 0) {
            try {
              const deltaToSet = new this.DeltaConstructor(page.initialContent.ops);
              editor.setContents(deltaToSet, quillSourcesSilent);
            } catch (e) { }
          } else { editor.setContents(new this.DeltaConstructor([{ insert: '\n' }]), quillSourcesSilent); }

          this.editorInstances.set(page.id, editor);

          editor.on('text-change', (delta: Delta, oldDelta: Delta, source: QuillSources) => {
            if (source === quillSourcesUser) {
              this.isDirty = true;
              this.saveIconState = 'unsaved';
              if (this.saveTimeout) clearTimeout(this.saveTimeout);

              if (!this.currentDocumentId) {
              } else {
                this.autoSaveSubject.next();
              }
              this.lastKnownSelection = { editorId: page.id, range: editor.getSelection(true) as QuillRange };
              this.updateCurrentSelectionFormatState(editor, this.lastKnownSelection.range);
              this._scheduleOverflowCheck(page.id, editor);
              this.scheduleReflowCheck(page.id, editor);

              const currentPageId = page.id;
              const editorContentLength = editor.getLength();
              const currentPageIndex = this.pages.findIndex(p => p.id === currentPageId);

              if (editorContentLength <= 1 && currentPageIndex > 0) {
                setTimeout(() => {
                  if (currentPageIndex > 0 && this.pages[currentPageIndex - 1]) {
                    const previousPageId = this.pages[currentPageIndex - 1].id;
                    const previousEditorInstance = this.editorInstances.get(previousPageId);

                    if (previousEditorInstance && this.QuillLib) {
                      const prevEditorLength = previousEditorInstance.getLength();
                      const targetSelectionIndex = prevEditorLength > 0 ? prevEditorLength - 1 : 0;

                      this.activeEditorInstanceId = previousPageId;
                      previousEditorInstance.setSelection(targetSelectionIndex, 0, this.QuillLib.sources.USER);
                      previousEditorInstance.focus();
                      this.changeDetector.detectChanges();

                      this.removePage(currentPageId);
                    } else {
                      this.removePage(currentPageId);
                    }
                  } else {
                    this.removePage(currentPageId);
                  }
                }, 0);

                return;
              }
            }
          });

          editor.on('selection-change', (range: QuillRange | null, oldRange: QuillRange | null, source: QuillSources) => {
            if (range) {
              this.activeEditorInstanceId = page.id;
              if (source === 'user') {
                this.lastKnownSelection = { editorId: page.id, range: range };
              }
              this.updateCurrentSelectionFormatState(editor, range);

              if (range.length > 0) {
                this.activeTypingFormats = {};
              } else {
                if (Object.keys(this.activeTypingFormats).length > 0) {
                  for (const key in this.activeTypingFormats) {
                    editor.format(key, this.activeTypingFormats[key], 'silent');
                  }
                }
              }
            }

            if (range && editor.hasFocus()) {
              this.activeEditorInstanceId = page.id;
            }
          });
        } else { }
      }
    });
    if (!this.activeEditorInstanceId && this.pages.length > 0) {
      const firstPageId = this.pages[0].id;
      if (this.editorInstances.has(firstPageId)) { this.activeEditorInstanceId = firstPageId; }
    }
    this.changeDetector.detectChanges();
  }

  handleInsertTable(size?: { rows: number, cols: number }): void {
    const editor = this.getEditorToFormat();
    if (editor) {
      const tableModule = editor.getModule('better-table') as BetterTableModule;

      const rows = size ? size.rows : 3;
      const cols = size ? size.cols : 3;

      tableModule.insertTable(rows, cols);
    }
  }

  updateCurrentSelectionFormatState(editor: Quill, range: QuillRange | null): void {
    let formats = {};
    if (range) {
      formats = editor.getFormat(range);

      if (range.length > 0) {
        const selectedDelta = editor.getContents(range.index, range.length);
        let commonSize: string | 'MIXED_VALUES' | undefined | null = undefined;
        let firstOp = true;

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
    const localQuillLib = this.QuillLib;

    if (editorToFormat && localQuillLib) {
      this.activeTypingFormats[formatKey] = value;

      editorToFormat.focus();

      setTimeout(() => {
        const currentSelection = editorToFormat.getSelection();

        if (currentSelection) {
          if (currentSelection.length > 0) {
            editorToFormat.formatText(currentSelection.index, currentSelection.length, formatKey, value, localQuillLib.sources.USER);
          } else {
            editorToFormat.format(formatKey, value, localQuillLib.sources.USER);
          }
          this.updateCurrentSelectionFormatState(editorToFormat, editorToFormat.getSelection());
        } else if (this.lastKnownSelection?.editorId === editorToFormat.root.id) {
          editorToFormat.format(formatKey, value, localQuillLib.sources.USER);
          this.updateCurrentSelectionFormatState(editorToFormat, this.lastKnownSelection.range);
        }
        this.changeDetector.detectChanges();
      }, 0);
    }
  }

  private getEditorToFormat(): Quill | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    if (this.lastKnownSelection?.editorId) {
      const editor = this.editorInstances.get(this.lastKnownSelection.editorId);
      if (editor) {
        return editor;
      }
    }

    for (const [_id, editor] of this.editorInstances) {
      if (editor.hasFocus()) {
        this.activeEditorInstanceId = _id;
        return editor;
      }
    }

    if (this.activeEditorInstanceId) {
      const editor = this.editorInstances.get(this.activeEditorInstanceId);
      if (editor) {
        return editor;
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

    const range = (this.lastKnownSelection && this.lastKnownSelection.editorId === editor.root.id && editor.hasFocus())
      ? this.lastKnownSelection.range
      : editor.getSelection();

    if (range) {
      return !!editor.getFormat(range)[formatName];
    }
    const currentFormats = editor.getFormat(editor.getSelection()?.index || 0);
    return !!currentFormats[formatName];
  }

  applyFontSize(size: string): void { this.applyFormat('size', size ? size : false); }

  toggleBold(): void { this.applyFormat('bold', !this.getFormatForToggle('bold')); }
  toggleItalic(): void { this.applyFormat('italic', !this.getFormatForToggle('italic')); }
  toggleUnderline(): void { this.applyFormat('underline', !this.getFormatForToggle('underline')); }

  insertLink(): void {
    const editor = this.getEditorToFormat();
    const localQuillLib = this.QuillLib;
    if (editor && localQuillLib) {
      const url = prompt("Link URL'sini girin:");
      if (url) {
        const selectionToUse = (this.lastKnownSelection && this.lastKnownSelection.editorId === editor.root.id && editor.hasFocus())
          ? this.lastKnownSelection.range
          : editor.getSelection();
        if (selectionToUse && selectionToUse.length > 0) {
          editor.format('link', url, localQuillLib.sources.USER);
        } else if (selectionToUse) {
          editor.insertText(selectionToUse.index, url, 'link', url, localQuillLib.sources.USER);
          editor.setSelection(selectionToUse.index + url.length, 0, localQuillLib.sources.SILENT);
        }
        this.updateCurrentSelectionFormatState(editor, editor.getSelection());
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

    if (currentPageIndex < this.pages.length - 1 && editorContentHeight < this.PAGE_CONTENT_TARGET_HEIGHT_PX * 0.1) {
      const nextPageId = this.pages[currentPageIndex + 1].id;
      const nextPageEditor = this.editorInstances.get(nextPageId);

      if (nextPageEditor && nextPageEditor.getLength() > 1) {
        const firstLineInfo = this.getFirstLineInfo(nextPageEditor);
        if (!firstLineInfo || !this.DeltaConstructor || !this.QuillLib) return;

        const { delta: lineDelta, length: lineLength } = firstLineInfo;
        const originalCurrentPageContent = currentEditor.getContents();
        const currentLength = originalCurrentPageContent.length();

        let tempDelta = new this.DeltaConstructor().retain(currentLength > 0 ? currentLength - 1 : 0);

        if (currentLength > 1 && originalCurrentPageContent.ops[originalCurrentPageContent.ops.length - 1]?.insert !== '\n') {
          tempDelta = tempDelta.insert('\n');
        }

        tempDelta = tempDelta.concat(new Delta(lineDelta.ops));

        currentEditor.updateContents(tempDelta, this.QuillLib.sources.SILENT);

        const newEditorRoot = currentEditor.root as HTMLElement;
        if (newEditorRoot.scrollHeight <= this.PAGE_CONTENT_TARGET_HEIGHT_PX + 30) {
          nextPageEditor.deleteText(0, lineLength, this.QuillLib.sources.SILENT);
          if (nextPageEditor.getLength() <= 1 && this.pages.length > 1 && currentPageIndex + 1 < this.pages.length) {
            this.removePage(nextPageId);
          }
          this.scheduleReflowCheck(currentPageId, currentEditor);
        } else {
          currentEditor.setContents(originalCurrentPageContent, this.QuillLib.sources.SILENT);
        }
      } else if (nextPageEditor && nextPageEditor.getLength() <= 1 && this.pages.length > 1 && currentPageIndex + 1 < this.pages.length) {
        this.removePage(nextPageId);
        this.scheduleReflowCheck(currentPageId, currentEditor);
      }
    }
  }

  private getFirstLineInfo(editor: Quill): { delta: QuillDelta, length: number } | null {
    if (!this.DeltaConstructor || !editor.scroll || !editor.scroll.children.head) return null;
    const firstLineBlot = editor.scroll.children.head as any;
    if (firstLineBlot) {
      const lineIndex = editor.getIndex(firstLineBlot);
      const lineLengthWithNewline = firstLineBlot.length() as number;
      if (lineLengthWithNewline > 0) {
        const lineDeltaContents = editor.getContents(lineIndex, lineLengthWithNewline);
        return { delta: { ops: lineDeltaContents.ops }, length: lineLengthWithNewline };
      }
    }
    return null;
  }

  addPage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib) { return; }
    const newPageId = this.generatePageId();
    this.pages.push({ id: newPageId, initialContent: { ops: [{ insert: '\n' }] } });
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

      let newActiveFocusIsNeeded = false;

      if (this.activeEditorInstanceId === pageId) {
        newActiveFocusIsNeeded = true;
      } else if (!this.activeEditorInstanceId || !this.editorInstances.has(this.activeEditorInstanceId)) {
        newActiveFocusIsNeeded = true;
      }

      if (newActiveFocusIsNeeded) {
        const newActivePageIndex = Math.max(0, pageIndex - 1);
        const newActivePage = this.pages[newActivePageIndex];

        if (newActivePage && newActivePage.id) {
          this.activeEditorInstanceId = newActivePage.id;
          const editorToFocus = this.editorInstances.get(newActivePage.id);
          if (editorToFocus && this.QuillLib) {
            setTimeout(() => {
              const len = editorToFocus.getLength();
              const targetSelection = len > 0 ? len - 1 : 0;
              editorToFocus.setSelection(targetSelection, 0, this.QuillLib!.sources.USER);
              editorToFocus.focus();
              this.changeDetector.detectChanges();
            }, 0);
          } else {
            this.activeEditorInstanceId = null;
          }
        } else {
          this.activeEditorInstanceId = this.pages.length > 0 ? this.pages[0].id : null;
          if (this.activeEditorInstanceId) {
            setTimeout(() => this.editorInstances.get(this.activeEditorInstanceId!)?.focus(), 0);
          }
        }
      } else {
        const currentActiveEditor = this.editorInstances.get(this.activeEditorInstanceId!);
        if (currentActiveEditor) {
          if (!currentActiveEditor.hasFocus()) {
            setTimeout(() => {
              currentActiveEditor.focus();
              this.changeDetector.detectChanges();
            }, 0);
          }
        } else {
          if (this.pages.length > 0) {
            this.activeEditorInstanceId = this.pages[0].id;
            setTimeout(() => this.editorInstances.get(this.activeEditorInstanceId!)?.focus(), 0);
          } else {
            this.activeEditorInstanceId = null;
          }
        }
      }
      this.changeDetector.detectChanges();
    } else if (pageIndex > -1 && this.pages.length === 1 && this.pages[0].id === pageId) {
    }
  }


  private getFittingCharsInBlotHeuristic(
    editor: Quill,
    blot: any,
    availableHeightPx: number,
    blotDomNode: HTMLElement
  ): number {
    if (availableHeightPx <= 0) return 0;

    const blotFullHeight = blotDomNode.offsetHeight;
    const blotQuillLength = blot.length() - 1;
    if (blotFullHeight <= availableHeightPx + 5) {
      return blotQuillLength;
    }

    const fitRatio = Math.max(0, Math.min(1, availableHeightPx / blotFullHeight));
    let estimatedChars = Math.floor(blotQuillLength * fitRatio);
    if (estimatedChars > 0 && estimatedChars < blotQuillLength) {
      const blotText = editor.getText(editor.getIndex(blot), blotQuillLength);
      let adjustedChars = estimatedChars;

      while (adjustedChars > 0 && blotText[adjustedChars - 1] !== ' ' && blotText[adjustedChars - 1] !== '\n') {
        adjustedChars--;
      }

      if (adjustedChars > 0) {
        return adjustedChars;
      } else {
        const approxLineHeight = parseFloat(window.getComputedStyle(blotDomNode).lineHeight) || 20;
        if (availableHeightPx < approxLineHeight * 0.8) {
          return 0;
        }
        return estimatedChars;
      }
    } else if (estimatedChars <= 0) {
      return 0;
    }
    return estimatedChars;
  }

  private async _checkAndHandlePageOverflow(currentPageId: string, currentEditor: Quill): Promise<void> {
    if (!this.QuillLib || !this.DeltaConstructor || this.PAGE_CONTENT_TARGET_HEIGHT_PX <= 0 || !currentEditor.root) {
      return;
    }

    let editorRoot = currentEditor.root as HTMLElement;
    let editorContentHeight = editorRoot.scrollHeight;
    let initialOverflowDetectedOnEntry = editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX;

    while (editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX && currentEditor.getLength() > 1) {

      let determinedSplitIndex = -1;
      let lastLineBlotThatFits: any = null;
      let firstLineBlotThatOverlaps: any = null;
      const linesIterator: Iterable<any> = currentEditor.scroll.lines();
      for (const lineBlot of linesIterator) {
        const lineNode = lineBlot.domNode as HTMLElement;
        if (!lineNode) continue;
        const lineTop = lineNode.offsetTop;
        const lineBottom = lineTop + lineNode.offsetHeight;
        if (lineBottom <= this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
          lastLineBlotThatFits = lineBlot;
        } else {
          firstLineBlotThatOverlaps = lineBlot;
          break;
        }
      }
      if (firstLineBlotThatOverlaps) {
        const baseIndexOfOverlappingBlot = currentEditor.getIndex(firstLineBlotThatOverlaps);
        const domNodeOfOverlappingBlot = firstLineBlotThatOverlaps.domNode as HTMLElement;
        let availableHeightForThisBlot: number;
        if (lastLineBlotThatFits) {
          const endOfLastFitBlotY = (lastLineBlotThatFits.domNode as HTMLElement).offsetTop + (lastLineBlotThatFits.domNode as HTMLElement).offsetHeight;
          availableHeightForThisBlot = this.PAGE_CONTENT_TARGET_HEIGHT_PX - endOfLastFitBlotY;
        } else {
          availableHeightForThisBlot = this.PAGE_CONTENT_TARGET_HEIGHT_PX - domNodeOfOverlappingBlot.offsetTop;
        }
        let charsToKeepInOverlappingBlot = this.getFittingCharsInBlotHeuristic(currentEditor, firstLineBlotThatOverlaps, availableHeightForThisBlot, domNodeOfOverlappingBlot);
        if (charsToKeepInOverlappingBlot === 0 && !lastLineBlotThatFits && firstLineBlotThatOverlaps.length() >= currentEditor.getLength() - 1) {
          return;
        }
        determinedSplitIndex = baseIndexOfOverlappingBlot + charsToKeepInOverlappingBlot;
      } else if (lastLineBlotThatFits) {
        determinedSplitIndex = currentEditor.getIndex(lastLineBlotThatFits) + lastLineBlotThatFits.length();
        if (determinedSplitIndex >= currentEditor.getLength() - 1 && editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
          break;
        }
      } else {
        break;
      }
      if (determinedSplitIndex >= 0 && determinedSplitIndex < currentEditor.getLength()) {
        const originalOverflowLength = currentEditor.getLength() - determinedSplitIndex;
        const originalOverflowContents = currentEditor.getContents(determinedSplitIndex, originalOverflowLength);
        let originalOverflowOps = originalOverflowContents.ops;
        if (!originalOverflowOps || originalOverflowOps.length === 0) {
          break;
        }
        let opsForNextPage = JSON.parse(JSON.stringify(originalOverflowOps)) as Op[];
        let leadingNewlineTrimmed = false;
        let trailingNewlineTrimmed = false;
        if (opsForNextPage.length > 0 && opsForNextPage[0] && typeof opsForNextPage[0].insert === 'string' && (opsForNextPage[0].insert as string).startsWith('\n')) {
          const firstOpInsertStr = opsForNextPage[0].insert as string;
          if (firstOpInsertStr === '\n') {
            if (Object.keys(opsForNextPage[0].attributes || {}).length === 0) {
              opsForNextPage.shift(); leadingNewlineTrimmed = true;
            }
          } else {
            opsForNextPage[0].insert = firstOpInsertStr.substring(1); leadingNewlineTrimmed = true;
          }
        }
        while (opsForNextPage.length > 0) {
          const lastOpIndex = opsForNextPage.length - 1;
          const lastOp = opsForNextPage[lastOpIndex];

          if (lastOp && typeof lastOp.insert === 'string') {
            let opInsertStr = lastOp.insert as string;
            if (opInsertStr.endsWith('\n')) {
              opInsertStr = opInsertStr.substring(0, opInsertStr.length - 1);
              opsForNextPage[lastOpIndex].insert = opInsertStr;
              trailingNewlineTrimmed = true;
              if (opInsertStr.length === 0 && Object.keys(lastOp.attributes || {}).length === 0) {
                opsForNextPage.pop();
              }
            } else {
              break;
            }
          } else {
            break;
          }
        }

        const lengthToDelete = new this.DeltaConstructor(originalOverflowOps).length();
        currentEditor.deleteText(determinedSplitIndex, lengthToDelete, this.QuillLib.sources.SILENT);
        if (opsForNextPage.length === 0 && (leadingNewlineTrimmed || trailingNewlineTrimmed)) {
          editorContentHeight = (currentEditor.root as HTMLElement).scrollHeight;
          if (editorContentHeight <= this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
            break;
          }
          continue;
        }
        const overflowDeltaForNextPage: QuillDelta = { ops: opsForNextPage };
        const currentPageIndex = this.pages.findIndex(p => p.id === currentPageId);
        if (currentPageIndex === -1) {
          return;
        }
        let nextPageId: string;
        let nextPageEditor: Quill | undefined;
        let isNewPageCreated = false;
        if (currentPageIndex === this.pages.length - 1) {
          nextPageId = this.generatePageId();
          this.pages.push({ id: nextPageId, initialContent: { ops: [] } });
          isNewPageCreated = true;
          this.changeDetector.detectChanges();
          await new Promise(resolve => setTimeout(resolve, 50));
          this.initializeVisiblePageEditors();
          nextPageEditor = this.editorInstances.get(nextPageId);
        } else {
          nextPageId = this.pages[currentPageIndex + 1].id;
          nextPageEditor = this.editorInstances.get(nextPageId);
        }

        if (nextPageEditor && this.DeltaConstructor && this.QuillLib) {
          if (overflowDeltaForNextPage.ops && overflowDeltaForNextPage.ops.length > 0) {
            const currentNextPageContentBeforeInsert = nextPageEditor.getContents();
            const newDeltaForNextPage = new this.DeltaConstructor(overflowDeltaForNextPage.ops)
              .concat(currentNextPageContentBeforeInsert);
            nextPageEditor.setContents(newDeltaForNextPage, this.QuillLib.sources.SILENT);
          }

          const shouldFocusAndScroll = (isNewPageCreated || initialOverflowDetectedOnEntry) && (overflowDeltaForNextPage.ops && overflowDeltaForNextPage.ops.length > 0);
          if (shouldFocusAndScroll) {
            const newPageElement = document.getElementById(nextPageId);
            if (newPageElement) {
              this.activeEditorInstanceId = nextPageId;
              nextPageEditor.focus();

              const effectivelyMovedContentDelta = new this.DeltaConstructor(overflowDeltaForNextPage.ops);
              let targetCursorIndex = effectivelyMovedContentDelta.length();
              targetCursorIndex = Math.max(0, targetCursorIndex);

              nextPageEditor.setSelection(targetCursorIndex, 0, this.QuillLib.sources.USER);
              newPageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              this.changeDetector.detectChanges();
            }
          }
          initialOverflowDetectedOnEntry = false;

          if (overflowDeltaForNextPage.ops.length > 0) {
            await this._checkAndHandlePageOverflow(nextPageId, nextPageEditor);
          }
        } else {
          return;
        }
      } else {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      editorRoot = currentEditor.root as HTMLElement;
      editorContentHeight = editorRoot.scrollHeight;
      if (editorContentHeight <= this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
        break;
      }
    }
  }

  handleAddNewPage(): void { this.addPage(); }

  handleNew(): void {
    const localQuillLib = this.QuillLib;
    const localDeltaConstructor = this.DeltaConstructor;

    if (!localQuillLib || !localDeltaConstructor) {
      return;
    }
    if (confirm('Emin misiniz? Bu işlem tüm dökümanı temizler ve geri alınamaz.')) {
      this.editorInstances.forEach(editor => editor.setContents(new localDeltaConstructor(), localQuillLib.sources.SILENT));
      this.editorInstances.clear();
      this.activeEditorInstanceId = null;
      this.lastKnownSelection = null;
      this.currentSelectionFormatState = {};
      this.title = 'Adsız Döküman';
      this.currentDocumentId = null;
      this.currentDocumentVersion = 1;
      this.currentDocumentDescription = '';
      this.currentDocumentIsPublic = false;
      this.currentDocumentStatus = 'draft';
      this.currentDocumentOwnerId = null;

      this.pages = [{ id: this.generatePageId(), initialContent: { ops: [{ insert: ' ' }] } }];
      this.updateTitleInDOM();
      this.changeDetector.detectChanges();
      setTimeout(() => {
        this.initializeVisiblePageEditors();
        if (this.pages.length > 0 && this.editorInstances.has(this.pages[0].id)) {
          this.activeEditorInstanceId = this.pages[0].id;
          this.editorInstances.get(this.pages[0].id)?.focus();
        }
      }, 50);
    }
  }

  handleSave(): void {
    const finalDelta = this.getCombinedDelta();
    if (!finalDelta) {
      alert("Kaydedilecek içerik oluşturulamadı.");
      return;
    }

    this.saveIconState = 'saving';
    this.changeDetector.detectChanges();

    if (this.currentDocumentId) {
      this.documentService.updateDocument(
        this.currentDocumentId,
        this.title ?? null,
        this.currentDocumentDescription ?? null,
        finalDelta,
        this.currentDocumentIsPublic,
        this.currentDocumentStatus ?? null
      ).subscribe({
        next: (updatedDoc: DocumentPayload) => {
          this.isDirty = false;
          this.saveIconState = 'saved';
          this.currentDocumentVersion = updatedDoc.version ?? this.currentDocumentVersion;
          this.changeDetector.detectChanges();
        },
        error: (err) => {
          this.saveIconState = 'error';
          this.changeDetector.detectChanges();
          console.error("Döküman güncellenirken hata:", err);
          alert(`Güncelleme hatası: ${err.message}`);
        }
      });
    } else {
      this.documentService.createDocument(
        this.title, this.currentDocumentDescription, finalDelta, this.currentDocumentIsPublic
      ).subscribe({
        next: (createdDoc: DocumentPayload) => {
          if (createdDoc && createdDoc.id) {
            this.isDirty = false;
            this.saveIconState = 'saved';
            this.currentDocumentId = createdDoc.id;
            this.currentDocumentVersion = createdDoc.version ?? 1;
            this.currentDocumentOwnerId = createdDoc.owner_id ?? null;
            this.currentDocumentIsPublic = createdDoc.is_public ?? false;
            this.changeDetector.detectChanges();
            this.router.navigate(['/document', createdDoc.id], { replaceUrl: true });
            alert('Döküman başarıyla oluşturuldu!');
          }
        },
        error: (err) => {
          this.saveIconState = 'error';
          this.changeDetector.detectChanges();
          console.error("Döküman oluşturulurken hata:", err);
          alert(`Oluşturma hatası: ${err.message}`);
        }
      });
    }
  }


  applyColor(color: string): void {
    this.applyFormat('color', color);
  }

  private async loadDocumentData(docId: string): Promise<void> {
    this.documentService.getDocument(docId).subscribe({
      next: async (doc: DocumentPayload) => {
        this.title = doc.title;
        this.currentDocumentId = doc.id ?? null;
        this.currentDocumentVersion = doc.version ?? 1;
        this.currentDocumentOwnerId = doc.owner_id ?? null;
        this.currentDocumentIsPublic = doc.is_public ?? false;
        this.currentDocumentStatus = doc.status ?? 'draft';
        this.currentDocumentDescription = doc.description ?? '';
        this.updateTitleInDOM();

        if (doc.content && doc.content.ops && this.DeltaConstructor && this.QuillLib) {
          this.editorInstances.forEach(editor => editor.disable());
          this.editorInstances.clear();
          this.pages = [];
          this.activeEditorInstanceId = null;
          this.changeDetector.detectChanges();

          let currentOpsForPage: Op[] = [];
          const allOps = doc.content.ops;

          for (let i = 0; i < allOps.length; i++) {
            const op = allOps[i];
            if (op.insert === '\n' && op.attributes && op.attributes['explicitPageBreak'] === true) {
              this.pages.push({
                id: this.generatePageId(),
                initialContent: { ops: currentOpsForPage.length > 0 ? currentOpsForPage : [{ insert: '\n' }] }
              });
              currentOpsForPage = [];
            } else {
              currentOpsForPage.push(op);
            }
          }
          if (currentOpsForPage.length > 0 || this.pages.length === 0) {
            this.pages.push({
              id: this.generatePageId(),
              initialContent: { ops: currentOpsForPage.length > 0 ? currentOpsForPage : [{ insert: '\n' }] }
            });
          }
          if (this.pages.length === 0) {
            this.pages.push({ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } });
          }

          this.changeDetector.detectChanges();

          await new Promise(resolve => setTimeout(resolve, 50));
          this.initializeVisiblePageEditors();

          if (this.pages.length > 0) {
            this.activeEditorInstanceId = this.pages[0].id;
            this.editorInstances.get(this.pages[0].id)?.focus();
          }

          if (!this.currentlyCheckingOverflow) {
            this.currentlyCheckingOverflow = true;
            try {
              for (const page of this.pages) {
                const editor = this.editorInstances.get(page.id);
                if (editor) {
                  await new Promise(resolve => setTimeout(resolve, 30));
                  const editorRoot = editor.root as HTMLElement;
                  if (editor.getLength() > 1 && editorRoot.scrollHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
                    await this._checkAndHandlePageOverflow(page.id, editor);
                  }
                }
              }
              const editorToFocus = this.activeEditorInstanceId ? this.editorInstances.get(this.activeEditorInstanceId) : (this.pages.length > 0 ? this.editorInstances.get(this.pages[0].id) : null);
              editorToFocus?.focus();
            } catch (e) {
            } finally {
              this.currentlyCheckingOverflow = false;
            }
          }
        } else {
          if (this.pages.length === 0) {
            this.pages = [{ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } }];
            this.changeDetector.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 50));
            this.initializeVisiblePageEditors();
            if (this.pages.length > 0) this.editorInstances.get(this.pages[0].id)?.focus();
          }
        }
      },
      error: (err) => {
        alert(`Doküman yüklenirken bir sorun oluştu: ${err.message || err}`);
        this.goBackToMainPage();
      }
    });
  }

  handlePrint(): void { if (isPlatformBrowser(this.platformId)) window.print(); }

  handleDownload(): void {
    let fullText = '';
    this.pages.forEach((page, index) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        fullText += instance.getText();
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
    if (this.title !== newTitle) {
      this.title = newTitle || 'Adsız Döküman';
      this.isDirty = true;
      this.saveIconState = 'unsaved';
      if (this.saveTimeout) clearTimeout(this.saveTimeout);

      if (this.currentDocumentId) {
        this.autoSaveSubject.next();
      }
      if (!newTitle && event.target.innerText.trim() !== this.title) {
        event.target.innerText = this.title;
      }
    }
  }

  private updateTitleInDOM(): void {
    if (isPlatformBrowser(this.platformId)) {
      const titleElement = document.querySelector('.document-title');
      if (titleElement) {
        titleElement.textContent = this.title;
      }
    }
  }

  openShareDialog(): void {
    console.log('DocumentComponent: openShareDialog method called.'); // Kontrol için log
    if (!this.currentDocumentId) {
      console.error('DocumentComponent: currentDocumentId is null or undefined. Cannot open share dialog.');
      alert('Paylaşım için lütfen önce belgeyi kaydedin veya mevcut bir belgeyi açın.');
      return;
    }
    if (!this.title) {
      console.warn('DocumentComponent: Document title is not set. Using a default title for share dialog.');
    }

    const dialogData: ShareDialogData = {
      documentId: this.currentDocumentId,
      documentTitle: this.title || 'Başlıksız Belge' // Eğer title boşsa varsayılan bir başlık ata
    };

    console.log('DocumentComponent: Opening share dialog with data:', dialogData);
    this.dialog.open(ShareDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: dialogData,
      autoFocus: false
    });
  }


}