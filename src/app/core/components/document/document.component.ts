// dione-docs-frontend/src/app/core/components/document/document.component.ts
import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, ViewEncapsulation, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import Quill from 'quill';
import Delta, { Op } from 'quill-delta'; // Op tipini import etmeye devam et

import { DocumentService } from '../../services/document.service';
import { AuthService } from '../../services/auth.service';
import { QuillDelta, DocumentPayload } from '../../dto/document.dto';

interface QuillRange { index: number; length: number; }
type QuillSources = 'user' | 'api' | 'silent';

interface DocumentPage {
  id: string;
  initialContent?: QuillDelta;
}

const QUILL_FONT_SIZES_WHITELIST = ['8px', '9px', '10px', '12px', '14px', '16px', '20px', '24px', '32px', '42px', '54px', '68px', '84px', '98px'];

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
  title = 'Adsız Döküman';
  pages: DocumentPage[] = [];
  editorInstances = new Map<string, Quill>();
  public QuillLib: typeof Quill | null = null;
  private DeltaConstructor: typeof Delta | null = null;
  private Parchment: any = null;

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


  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private changeDetector: ChangeDetectorRef,
    private documentService: DocumentService,
    private authService: AuthService, // Kullanılıyorsa kalsın
    private route: ActivatedRoute,
    private router: Router // Router eklendi
  ) { }

  ngOnInit(): void {
    if (this.pages.length === 0 && !this.route.snapshot.paramMap.get('id')) {
      this.pages.push({ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } });
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

          if (this.QuillLib && this.DeltaConstructor) {
            this.Parchment = this.QuillLib.import('parchment');
            const SizeStyleAttributor = this.QuillLib.import('attributors/style/size') as any;
            if (SizeStyleAttributor) {
              SizeStyleAttributor.whitelist = QUILL_FONT_SIZES_WHITELIST;
              this.QuillLib.register(SizeStyleAttributor, true);
            } else {
              console.error("Failed to import 'attributors/style/size'");
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

            setTimeout(() => {
              if (this.pages.length > 0 && document.getElementById(this.pages[0].id)) { // Check if element exists
                const firstPageDiv = document.getElementById(this.pages[0].id);
                if (firstPageDiv) { // Redundant check, but safe
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
    this.editorInstances.forEach((editor) => {
      // Gerekirse olay dinleyicilerini kaldır veya Quill destroy metotlarını çağır
    });
    this.editorInstances.clear();
  }

  private loadDocumentData(docId: string): void {
    console.log(`loadDocumentData çağrıldı, docId: ${docId}`);
    this.documentService.getDocument(docId).subscribe({
      next: (doc: DocumentPayload) => {
        console.log('loadDocumentData - Alınan doküman:', doc);
        this.title = doc.title;
        this.currentDocumentId = doc.id ?? null;
        this.currentDocumentVersion = doc.version ?? 1;
        this.currentDocumentOwnerId = doc.owner_id ?? null;
        this.currentDocumentIsPublic = doc.is_public ?? false;
        this.currentDocumentStatus = doc.status ?? 'draft';
        this.currentDocumentDescription = doc.description ?? '';

        this.updateTitleInDOM();

        if (doc.content && this.DeltaConstructor && this.QuillLib) {
          // doc.content'in geçerli bir QuillDelta olduğundan emin olalım
          // mapResponseToPayload bunu zaten sağlamalı.
          console.log('loadDocumentData - Quill editörüne yüklenecek içerik:', doc.content);

          // Mevcut sayfaları ve editörleri temizle
          this.editorInstances.forEach(editor => editor.disable()); // Varsa disable et
          this.editorInstances.clear();
          this.pages = []; // Sayfaları temizle
          this.changeDetector.detectChanges(); // DOM'u temizlemek için

          // Yeni sayfayı ve içeriği ayarla
          // TODO: Çoklu sayfa mantığı burada daha detaylı ele alınmalı eğer backend tek bir delta gönderiyorsa.
          // Şimdilik, backend'den gelen tüm içeriği ilk sayfaya yüklüyoruz.
          // Eğer backend sayfa bazlı delta göndermiyorsa, sayfa bölme mantığı overflow'da çalışacak.
          const firstPageId = this.generatePageId();
          this.pages = [{ id: firstPageId, initialContent: doc.content }]; // doc.content zaten QuillDelta
          console.log('loadDocumentData - Yeni sayfa oluşturuldu:', this.pages[0]);

          this.changeDetector.detectChanges(); // Yeni sayfa elementinin DOM'a eklenmesi için

          setTimeout(() => {
            this.initializeVisiblePageEditors(); // Bu, yeni Quill örneğini oluşturur ve setContents yapar
            if (this.pages.length > 0 && this.editorInstances.has(this.pages[0].id)) {
              this.activeEditorInstanceId = this.pages[0].id;
              const firstEditor = this.editorInstances.get(this.pages[0].id);
              if (firstEditor) {
                console.log('loadDocumentData - İlk editöre odaklanılıyor.');
                firstEditor.focus();
                // İçerik zaten initializeVisiblePageEditors içinde set ediliyor.
                // Gerekirse burada tekrar set edilebilir ancak genellikle gerekmez.
                // firstEditor.setContents(new this.DeltaConstructor(doc.content.ops), this.QuillLib.sources.SILENT);
              } else {
                console.error('loadDocumentData - İlk editör örneği bulunamadı.');
              }
            } else {
              console.error('loadDocumentData - Sayfa veya editör örneği initialize edilemedi.');
            }
          }, 150); // DOM güncellemeleri ve Quill başlatma için biraz daha zaman tanı
        } else {
          console.warn('loadDocumentData - Doküman içeriği yok veya Quill/Delta kütüphaneleri yüklenemedi.');
          // İçerik yoksa veya yüklenemediyse, boş bir sayfa ile başlat
          if (this.pages.length === 0) {
            this.pages = [{ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } }];
            this.changeDetector.detectChanges();
            setTimeout(() => this.initializeVisiblePageEditors(), 50);
          }
        }
      },
      error: (err) => {
        console.error("Doküman yüklenirken hata:", err);
        alert(`Doküman yüklenirken bir sorun oluştu: ${err.message || err}`);
        // Hata durumunda kullanıcıyı ana sayfaya yönlendirebilir veya boş bir editör sunabilirsiniz.
        this.router.navigate(['/main-page']);
      }
    });
  }

  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private initializeVisiblePageEditors(): void {
    if (!isPlatformBrowser(this.platformId) || !this.QuillLib || !this.DeltaConstructor) {
      console.warn('initializeVisiblePageEditors - Tarayıcı ortamı değil veya Quill/Delta yüklenemedi.');
      return;
    }
    const quillSourcesUser = this.QuillLib.sources.USER;
    const quillSourcesSilent = this.QuillLib.sources.SILENT;

    console.log('initializeVisiblePageEditors - Başlatılıyor, sayfa sayısı:', this.pages.length);

    this.pages.forEach(page => {
      if (!this.editorInstances.has(page.id) && this.QuillLib && this.DeltaConstructor) {
        const container = document.getElementById(page.id);
        if (container) {
          console.log(`initializeVisiblePageEditors - Quill örneği oluşturuluyor, sayfa ID: ${page.id}`);
          const editor = new this.QuillLib(container, {
            modules: {
              toolbar: false, // ToolbarComponent kullanıldığı için false
              history: { delay: 2000, maxStack: 500, userOnly: true }
            },
            placeholder: `Sayfa ${this.pages.findIndex(p => p.id === page.id) + 1} içeriği...`,
            theme: 'snow'
          });

          if (page.initialContent && page.initialContent.ops && page.initialContent.ops.length > 0) {
            console.log(`initializeVisiblePageEditors - İçerik set ediliyor, sayfa ID: ${page.id}, içerik:`, JSON.stringify(page.initialContent));
            // Delta'nın geçerli bir Quill Delta objesi olduğundan emin ol
            try {
              const deltaToSet = new this.DeltaConstructor(page.initialContent.ops);
              editor.setContents(deltaToSet, quillSourcesSilent); // Başlangıç yüklemesi için SILENT kullanılabilir
            } catch (deltaError) {
              console.error(`initializeVisiblePageEditors - Hatalı Delta formatı, sayfa ID: ${page.id}`, deltaError, page.initialContent);
              editor.setContents(new this.DeltaConstructor([{ insert: '\n' }]), quillSourcesSilent); // Hata durumunda boş içerik
            }
          } else {
            console.log(`initializeVisiblePageEditors - Başlangıç içeriği boş veya tanımsız, sayfa ID: ${page.id}`);
            // Opsiyonel: Eğer initialContent yoksa, yine de boş bir satırla başlatmak iyi olabilir.
            editor.setContents(new this.DeltaConstructor([{ insert: '\n' }]), quillSourcesSilent);
          }
          this.editorInstances.set(page.id, editor);

          editor.on('editor-change', (eventName: string, ...args: any[]) => {
            // ... (mevcut editor-change listener kodu) ...
          });

        } else {
          console.error(`initializeVisiblePageEditors - Sayfa konteyneri bulunamadı, ID: ${page.id}`);
        }
      }
    });

    if (!this.activeEditorInstanceId && this.pages.length > 0) {
      const firstPageId = this.pages[0].id;
      if (this.editorInstances.has(firstPageId)) {
        this.activeEditorInstanceId = firstPageId;
        console.log(`initializeVisiblePageEditors - Aktif editör ID set edildi: ${firstPageId}`);
      }
    }
    this.changeDetector.detectChanges(); // Quill editörleri DOM'a eklendikten sonra view'ı güncelle
  }

  updateCurrentSelectionFormatState(editor: Quill, range: QuillRange | null): void {
    let formats = {};
    if (range) {
      formats = editor.getFormat(range);
      if (range.length > 0) {
        let commonSize: string | 'MIXED_VALUES' | undefined | null = undefined;
        let firstOp = true;
        const selectedDelta = editor.getContents(range.index, range.length);

        for (const op of selectedDelta.ops) { // `as Op[]` cast'i DTO doğruysa gereksiz
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
    const localQuillLib = this.QuillLib;

    if (editorToFormat && localQuillLib) {
      let targetRange = (this.lastKnownSelection?.editorId === editorToFormat.root.id)
        ? this.lastKnownSelection.range
        : editorToFormat.getSelection();

      if (!targetRange && editorToFormat.hasFocus()) {
        targetRange = editorToFormat.getSelection();
      }

      if (targetRange) {
        if (targetRange.length > 0) {
          editorToFormat.formatText(targetRange.index, targetRange.length, formatKey, value, localQuillLib.sources.USER);
        } else {
          editorToFormat.format(formatKey, value, localQuillLib.sources.USER);
        }
      } else {
        console.warn('No active editor or selection to apply format.');
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
      if (editor && editor.hasFocus()) return editor;
    }

    if (this.activeEditorInstanceId) {
      const editor = this.editorInstances.get(this.activeEditorInstanceId);
      if (editor && editor.hasFocus()) return editor;
    }

    for (const [id, editor] of this.editorInstances) {
      if (editor.hasFocus()) {
        this.activeEditorInstanceId = id;
        return editor;
      }
    }

    if (this.activeEditorInstanceId) {
      const editor = this.editorInstances.get(this.activeEditorInstanceId);
      if (editor) return editor;
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

    if (currentPageIndex < this.pages.length - 1 && editorContentHeight < this.PAGE_CONTENT_TARGET_HEIGHT_PX * 0.7) {
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
      this.changeDetector.detectChanges();
      if (this.activeEditorInstanceId === pageId || !this.editorInstances.has(this.activeEditorInstanceId!)) {
        const newActiveId = this.pages[Math.max(0, pageIndex - 1)]?.id || this.pages[0]?.id || null;
        this.activeEditorInstanceId = newActiveId;
        if (newActiveId) {
          this.editorInstances.get(newActiveId)?.focus();
        }
      }
    }
  }

  private async _checkAndHandlePageOverflow(currentPageId: string, currentEditor: Quill): Promise<void> {
    if (!this.QuillLib || !this.DeltaConstructor || this.PAGE_CONTENT_TARGET_HEIGHT_PX <= 0 || !currentEditor.root) return;

    const editorRoot = currentEditor.root as HTMLElement;
    let editorContentHeight = editorRoot.scrollHeight;

    while (editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX && currentEditor.getLength() > 1) {
      let splitIndex = 0;
      const linesIterator: Iterable<any> = currentEditor.scroll.lines();
      let lastLineBlotBeforeOverflow: any = null;

      for (const lineBlot of linesIterator) {
        const lineNode = lineBlot.domNode as HTMLElement;
        if (!lineNode) continue;
        const lineBottomInEditor = lineNode.offsetTop + lineNode.offsetHeight;

        if (lineBottomInEditor <= this.PAGE_CONTENT_TARGET_HEIGHT_PX) {
          lastLineBlotBeforeOverflow = lineBlot;
        } else {
          if (lastLineBlotBeforeOverflow) {
            splitIndex = currentEditor.getIndex(lastLineBlotBeforeOverflow) + lastLineBlotBeforeOverflow.length();
          } else {
            splitIndex = currentEditor.getIndex(lineBlot);
            if (splitIndex === 0 && lineBlot.length() < currentEditor.getLength() - 1) {
              splitIndex = lineBlot.length();
            } else if (splitIndex === 0 && lineBlot.length() >= currentEditor.getLength() - 1) {
              console.warn("Single very long line overflows, cannot split effectively.");
              return;
            }
          }
          break;
        }
      }
      if (splitIndex === 0 && editorContentHeight > this.PAGE_CONTENT_TARGET_HEIGHT_PX && lastLineBlotBeforeOverflow) {
        splitIndex = currentEditor.getIndex(lastLineBlotBeforeOverflow) + lastLineBlotBeforeOverflow.length();
      }

      if (splitIndex > 0 && splitIndex < currentEditor.getLength() - 1) {
        const overflowOps = currentEditor.getContents(splitIndex).ops;
        if (!overflowOps || overflowOps.length === 0) return; // DeltaConstructor kontrolü gereksiz
        const overflowDelta: QuillDelta = { ops: overflowOps };

        currentEditor.deleteText(splitIndex, currentEditor.getLength() - splitIndex, this.QuillLib.sources.SILENT);

        const currentPageIndex = this.pages.findIndex(p => p.id === currentPageId);
        if (currentPageIndex === -1) return;

        let nextPageId: string;
        let nextPageEditor: Quill | undefined;

        if (currentPageIndex === this.pages.length - 1) {
          nextPageId = this.generatePageId();
          this.pages.push({ id: nextPageId, initialContent: { ops: [] } });
          this.changeDetector.detectChanges();
          await new Promise(resolve => setTimeout(resolve, 50));
          this.initializeVisiblePageEditors();
          nextPageEditor = this.editorInstances.get(nextPageId);
        } else {
          nextPageId = this.pages[currentPageIndex + 1].id;
          nextPageEditor = this.editorInstances.get(nextPageId);
        }

        if (nextPageEditor && this.DeltaConstructor && this.QuillLib) {
          const currentNextPageContentOps = nextPageEditor.getContents().ops;
          const newDelta = new this.DeltaConstructor(overflowDelta.ops).concat(new this.DeltaConstructor(currentNextPageContentOps));
          nextPageEditor.setContents(newDelta, this.QuillLib.sources.SILENT);
          await this._checkAndHandlePageOverflow(nextPageId, nextPageEditor);
        }
      } else {
        break;
      }
      editorContentHeight = editorRoot.scrollHeight;
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

      this.pages = [{ id: this.generatePageId(), initialContent: { ops: [{ insert: '\n' }] } }];
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
    const localDeltaConstructor = this.DeltaConstructor;
    if (!localDeltaConstructor || !this.QuillLib) {
      console.error("Hata: Quill kütüphanesi yüklenemedi veya DeltaConstructor başlatılamadı.");
      alert("Kaydetme işlemi için gerekli bileşenler yüklenemedi. Lütfen sayfayı yenileyin.");
      return;
    }

    let fullDeltaOps: Op[] = [];
    this.pages.forEach((page) => {
      const instance = this.editorInstances.get(page.id);
      if (instance) {
        const contents = instance.getContents();
        if (contents && contents.ops) {
          fullDeltaOps = fullDeltaOps.concat(contents.ops);
        }
      }
    });

    const finalDelta: QuillDelta = { ops: fullDeltaOps };

    if (this.currentDocumentId) {
      // Mevcut dokümanı güncelle
      this.documentService.updateDocument(
        this.currentDocumentId,
        this.title,
        this.currentDocumentDescription,
        finalDelta,
        this.currentDocumentIsPublic,
        this.currentDocumentStatus
      ).subscribe({
        next: (updatedDoc: DocumentPayload) => {
          alert('Döküman başarıyla güncellendi!');
          this.currentDocumentVersion = updatedDoc.version ?? this.currentDocumentVersion;
        },
        error: (err) => {
          console.error("Döküman güncellenirken hata:", err);
          const errorMessage = typeof err === 'string' ? err : (err.message || "Bilinmeyen bir hata oluştu.");
          alert(`Döküman güncellenirken bir sorun oluştu: ${errorMessage}`);
        }
      });
    } else {
      // Yeni doküman oluştur
      this.documentService.createDocument(
        this.title,
        this.currentDocumentDescription,
        finalDelta,
        this.currentDocumentIsPublic
      ).subscribe({
        next: (createdDoc: DocumentPayload) => {
          console.log('DocumentService.createDocument başarılı, yanıt:', createdDoc);
          // Yanıtın ve ID'nin geçerli olduğunu kontrol et
          if (createdDoc && createdDoc.id && typeof createdDoc.id === 'string') {
            this.currentDocumentId = createdDoc.id;
            this.currentDocumentVersion = createdDoc.version ?? 1;
            this.currentDocumentOwnerId = createdDoc.owner_id ?? null;
            this.currentDocumentIsPublic = createdDoc.is_public ?? false;
            this.currentDocumentStatus = createdDoc.status ?? 'draft';
            this.currentDocumentDescription = createdDoc.description ?? '';
            this.title = createdDoc.title; // Başlığı da API'den gelenle güncelle
            this.updateTitleInDOM(); // DOM'daki başlığı da güncelle

            // Başarılı oluşturma sonrası dokümanın kendi sayfasına yönlendir
            // Bu, URL'yi güncelleyecek ve DocumentComponent'in veriyi ID ile yeniden yüklemesini tetikleyebilir (eğer route subscribe ediliyorsa)
            // veya kullanıcı sayfada kalmaya devam eder ve mevcut component state güncellenir.
            this.router.navigate(['/document', createdDoc.id], { replaceUrl: true }).then(navSuccess => {
              if (navSuccess) {
                console.log('Yeni dokümana yönlendirildi (veya URL güncellendi):', createdDoc.id);
                // Yönlendirme sonrası loadDocumentData'nın çağrıldığından emin olmak için
                // ngOnInit içinde veya route değişikliklerini dinleyen bir yapıda bu mantık olmalı.
                // Şimdilik sadece state'i güncelledik ve URL'yi değiştirdik.
                // Eğer component aynı kalıyorsa ve yeniden başlatılmıyorsa,
                // this.loadDocumentData(createdDoc.id); // gibi bir çağrı gerekebilir.
                // Ancak route değiştiği için Angular genellikle component'i yeniden başlatır veya
                // ActivatedRoute.paramMap aboneliği tetiklenir.
              } else {
                console.error('Yeni doküman URL\'sine yönlendirme/güncelleme başarısız oldu.');
                alert('Döküman oluşturuldu ancak sayfa güncellenirken bir sorun oluştu.');
              }
            }).catch(navError => {
              console.error('Yönlendirme/URL güncelleme hatası:', navError);
              alert('Döküman oluşturuldu ancak sayfa güncellenirken bir navigasyon hatası oluştu.');
            });
          } else {
            console.error("Döküman oluşturuldu ancak sunucudan dönen yanıtta geçerli bir ID bulunamadı veya diğer zorunlu alanlar eksik:", createdDoc);
            alert("Döküman oluşturuldu ancak sunucudan eksik veya hatalı bilgi döndü. Lütfen durumu kontrol edin.");
          }
        },
        error: (err) => {
          console.error("Döküman oluşturulurken hata (servis subscribe error bloğu):", err);
          // Hata mesajını err objesinden almaya çalış
          let userMessage = "Bilinmeyen bir hata oluştu.";
          if (err && typeof err === 'object' && err.message) {
            userMessage = err.message;
          } else if (typeof err === 'string') {
            userMessage = err;
          }
          alert(`Doküman oluşturulurken bir sorun oluştu: ${userMessage}. Detaylar için konsolu kontrol edin.`);
        }
      });
    }
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
    this.title = newTitle || 'Adsız Döküman';
    if (!newTitle && event.target.innerText.trim() !== this.title) {
      event.target.innerText = this.title;
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
}