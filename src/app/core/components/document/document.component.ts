import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, HostListener, NgZone, Inject, PLATFORM_ID } from '@angular/core'; // Inject ve PLATFORM_ID eklendi
import { isPlatformBrowser, CommonModule } from '@angular/common'; // isPlatformBrowser eklendi
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject, fromEvent } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, throttleTime } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { ColorPickerDirective } from 'ngx-color-picker';
import { QuillModule } from 'ngx-quill';
// Quill importunu koşullu hale getirmek yerine, instance oluşturmayı koşullu yapacağız.
// import Quill from 'quill';
// import { Mention } from 'quill-mention';
// import 'quill-emoji/dist/quill-emoji.js';
// import QuillBetterTable from 'quill-better-table';

// Color picker module
import { NgxPrintModule } from 'ngx-print';

// --- Interface'ler ve diğer kodlar aynı kalacak ---
// Custom interfaces for Quill modules
interface BetterTableModule {
  insertTable(rows: number, columns: number): void;
}

interface EmojiModule {
  emojiBlot: {
    insertEmoji(index: number, emojiName: string): void;
  }
}

interface DocumentVersion {
  id: string;
  createdAt: Date;
  name: string;
  content: any;
}

interface DocumentMeta {
  id?: string;
  name: string;
  lastModified: Date | null;
  createdAt: Date;
  tags: string[];
  sharedWith: string[];
  isPublic: boolean;
  owner: string;
  size: number;
  versions: DocumentVersion[];
}

interface EditorFormatState {
  font?: string;
  size?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  background?: string;
  align?: string | boolean;
  list?: string | boolean;
  script?: string | boolean;
  header?: number | boolean;
  blockquote?: boolean;
  'code-block'?: boolean;
}

interface DocumentStats {
  words: number;
  chars: number;
  pages: number;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  createdAt: Date;
  text: string;
  markerId?: string;
}


// --- Component decorator ve diğer importlar aynı ---
@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    MatChipsModule,
    MatBadgeModule,
    MatDividerModule,
    MatListModule,
    MatSlideToggleModule,
    QuillModule, // QuillModule burada kalabilir
    NgxPrintModule,
    ColorPickerDirective
  ],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit, OnDestroy {
  @ViewChild('editor') editorInstance: any; // Tip olarak any veya QuillEditorComponent

  // Component State
  isLoading = true;
  isSaving = false;
  isSaved = true;
  scrollPosition = 0;
  showSidePanel = false;
  documentContent: any = '';
  quillEditor: any | null = null; // Tip Quill veya any
  isBrowser: boolean; // Tarayıcı kontrolü için flag

  // Document Data (aynı)
  documentMeta: DocumentMeta = {
    name: 'Başlıksız Doküman',
    lastModified: null,
    createdAt: new Date(),
    tags: [],
    sharedWith: [],
    isPublic: false,
    owner: 'currentUser',
    size: 0,
    versions: []
  };

  // User Info (aynı)
  userName = 'Kullanıcı Adı';
  userEmail = 'kullanici@example.com';
  currentUserId = 'currentUser';

  get userInitials(): string {
    return this.userName.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  // Editor Settings (aynı, quillModules başlangıçta boş olabilir veya sadece SSR-safe modüller içerebilir)
  quillModules: any = {}; // Başlangıçta boş bırakıp tarayıcıda dolduracağız
  editorFormats: EditorFormatState = {};
  stats: DocumentStats = { words: 0, chars: 0, pages: 0 };

  availableFonts = [
    { label: 'Arial', value: 'arial' },
    { label: 'Times New Roman', value: 'times' },
    { label: 'Verdana', value: 'verdana' },
    { label: 'Courier New', value: 'courier' },
    { label: 'Georgia', value: 'georgia' },
  ];
  availableSizes = [
    { label: '10px', value: '10px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '18px', value: '18px' },
    { label: '24px', value: '24px' },
    { label: '36px', value: '36px' },
  ];
  textColors: string[] = ['#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff', '#cccccc'];
  bgColors: string[] = ['#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff', '#cccccc'];
  customColor: string = '#000000';
  customBgColor: string = '#ffffff';

  // Side Panel Data (aynı)
  comments: Comment[] = [];
  newComment: string = '';
  newSharedUser: string = '';

  // RxJS Subjects (aynı)
  private destroy$ = new Subject<void>();
  private contentChanged$ = new Subject<any>();
  private selectionChanged$ = new Subject<any>();
  private metaChanged$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object // PLATFORM_ID inject edildi
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId); // Tarayıcıda mı çalışıyor kontrolü
    if (this.isBrowser) {
      this.setupQuillModules(); // Modülleri sadece tarayıcıda setup et
    }
  }

  ngOnInit(): void {
    this.loadInitialData();
    if (this.isBrowser) { // Sadece tarayıcıda dinlemeye başla
      this.subscribeToChanges();
      this.setupScrollListener();
    }
  }

  // ngAfterViewInit Quill instance'ını almak için daha uygun olabilir
  ngAfterViewInit(): void {
    // Quill instance'ı ViewChild ile set edildikten sonra erişilebilir olur.
    // Bu yüzden AfterViewInit içinde kontrol etmek daha güvenli olabilir.
    // Ancak onEditorCreated callback'i zaten editor hazır olduğunda tetiklenir.
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.isBrowser) { // Listener'ları sadece tarayıcıda kaldır
      // setupScrollListener'da eklenen event listener varsa burada kaldırılmalı
      // Ancak RxJS fromEvent kullandığımız için takeUntil yeterli olacaktır.
      // window.removeEventListener('scroll', this.onWindowScroll); // Eğer HostListener yerine bu kullanıldıysa
    }
  }

  // Data Loading and Saving (içerik aynı, saveDocument içinde quillEditor kontrolü eklenebilir)
  loadInitialData(): void {
    // ... (Mevcut kodun büyük kısmı aynı) ...
    this.isLoading = true;
    const docId = this.route.snapshot.paramMap.get('id');

    if (docId) {
      console.log(`Doküman ${docId} yükleniyor...`);
      // Gerçek API çağrısı simülasyonu
      setTimeout(() => {
        this.documentMeta = { /* ... Yüklenen veri ... */
          id: docId,
          name: `Yüklenmiş Doküman ${docId}`,
          lastModified: new Date(Date.now() - 600000),
          createdAt: new Date(Date.now() - 86400000),
          tags: ['önemli', 'proje'],
          sharedWith: ['test@example.com'],
          isPublic: false,
          owner: 'currentUser',
          size: 15000,
          versions: [
            { id: 'v1', createdAt: new Date(Date.now() - 90000000), name: 'İlk Taslak', content: { ops: [{ insert: 'İlk versiyon içeriği.\n' }] } }
          ]
         };
        this.documentContent = { ops: [{ attributes: { bold: true }, insert: 'Yüklenmiş' }, { insert: ' içerik.\n' }] };
        this.comments = [
             { id: 'c1', userId: 'otherUser', userName: 'Jane Doe', userInitials: 'JD', createdAt: new Date(), text: 'Bu kısım harika olmuş!' }
        ];

        this.isLoading = false;
        this.isSaved = true;
        if (this.isBrowser && this.quillEditor) { // Tarayıcıda ve editör varsa stats güncelle
           this.updateStats();
        }
        this.changeDetectorRef.detectChanges();
        console.log('Doküman yüklendi.');
      }, 1500);
    } else {
       // Yeni doküman durumu (aynı)
      this.documentMeta = {
        name: 'Başlıksız Doküman',
        lastModified: null,
        createdAt: new Date(),
        tags: [],
        sharedWith: [],
        isPublic: false,
        owner: this.currentUserId,
        size: 0,
        versions: []
      };
      this.documentContent = '';
      this.isLoading = false;
      this.isSaved = false; // Yeni doküman kaydedilmemiş başlar
    }
  }

  saveDocument(isAutoSave: boolean = false): void {
    if (this.isSaving || this.isLoading || !this.isBrowser) return; // Tarayıcı kontrolü eklendi

    this.isSaving = true;
    this.isSaved = false;
    this.changeDetectorRef.detectChanges();

    const saveData = {
      meta: this.documentMeta,
      content: this.documentContent // Quill içeriği zaten state'de
    };

    console.log('Kaydediliyor:', saveData);

    // Gerçek API çağrısı simülasyonu
    setTimeout(() => {
      this.isSaving = false;
      this.isSaved = true;
      this.documentMeta.lastModified = new Date();
      // Boyut hesaplaması documentContent üzerinden yapılabilir
      this.documentMeta.size = this.documentContent ? JSON.stringify(this.documentContent).length : 0;

      if (!isAutoSave) {
          this.showSnackbar('Doküman kaydedildi', false);
      } else {
           console.log("Otomatik kaydedildi.");
      }

      if (!this.documentMeta.id) {
        // Yeni ID oluştur ve URL'i güncelle (sadece tarayıcıda mantıklı)
        const newId = `doc_${Date.now()}`;
        this.documentMeta.id = newId;
        this.router.navigate(['/document', newId], { replaceUrl: true });
      }

      this.changeDetectorRef.detectChanges();
    }, 1000);
  }

  autoSave(): void {
    if (!this.isSaved && !this.isSaving && this.isBrowser) { // Tarayıcı kontrolü
      this.saveDocument(true);
    }
  }

  // Quill Editor Events and Functions
  setupQuillModules(): void {
    // Bu fonksiyon sadece tarayıcıda çağrılacak
    // Dinamik importlar SSR'da sorun çıkarabilir, bu yüzden direkt import edip
    // kullanımlarını isBrowser kontrolüne almak daha güvenli olabilir.
    Promise.all([
        import('quill'),
        import('quill-mention'),
        import('quill-emoji/dist/quill-emoji.js'),
        import('quill-better-table')
    ]).then(([QuillLib, MentionLib, EmojiLib, BetterTableLib]) => {
        const Quill = QuillLib.default; // default import olabilir
        const Mention = MentionLib.Mention; // Gerekirse .default kontrolü
        const QuillBetterTable = BetterTableLib.default; // default import

        // Gerekli Quill modüllerini register et
         Quill.register({
           'modules/better-table': QuillBetterTable,
           'modules/mention': Mention,
           // Emoji modülü genellikle Quill.import ile alınır veya direkt Quill'e eklenir
         }, true);

         // Quill modül konfigürasyonunu burada yap
         this.quillModules = {
           toolbar: false, // Toolbar'ı HTML'de kendimiz oluşturuyoruz
           history: { delay: 500, maxStack: 100, userOnly: true },
           mention: {
               allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
               mentionDenotationChars: ["@"],
               source: (searchTerm: string, renderList: (matches: any[], searchTerm: string) => void) => {
                   const users = [ /* ... kullanıcılar ... */ ];
                   // ... mention source mantığı ...
               },
               renderItem: (item: any) => `${item.value}`, // veya item.name
           },
           'emoji-toolbar': true, // Emoji modül seçenekleri
           'emoji-shortname': true,
           'better-table': { // BetterTable seçenekleri
               operationMenu: {
                   items: { /* ... tablo menü öğeleri ... */ },
                   color: { /* ... renk seçenekleri ... */ }
               }
           },
           clipboard: { matchVisual: false }
           // Gerekirse diğer modüller (örneğin syntax highlighting için 'syntax: true')
         };
         console.log("Quill modules configured for browser.");
         // Değişiklikleri algıla
         this.changeDetectorRef.detectChanges();

    }).catch(error => {
        console.error("Quill modülleri yüklenirken hata oluştu:", error);
    });
  }


  onEditorCreated(editor: any): void {
    if (!this.isBrowser) return; // Sadece tarayıcıda çalıştır
    this.quillEditor = editor;
    console.log('Quill Editor Oluşturuldu:', editor);

    // Gerekirse Better Table modülünü manuel kontrol et/ekle
    if (!editor.getModule('better-table') && window.hasOwnProperty('QuillBetterTable')) {
        console.warn("Better Table modülü otomatik yüklenmedi, manuel deneniyor.");
        try {
           // Global scope'dan QuillBetterTable alınıp register edilebilir veya
           // setupQuillModules içinde zaten register edilmiş olmalı.
           // new (window as any).QuillBetterTable(editor, this.quillModules['better-table']);
        } catch(e) {
            console.error("Better Table manuel eklenirken hata:", e);
        }
    }
     this.updateStats(); // Editör hazır olduğunda istatistikleri güncelle
     this.changeDetectorRef.detectChanges(); // Emin olmak için
  }

  onContentChanged(event: any): void {
    if (!this.isBrowser) return; // Sadece tarayıcıda
    // event.content yerine event.editor.getContents() kullanmak daha güvenli olabilir
    this.documentContent = this.quillEditor?.getContents(); // İçeriği state'e al
    this.contentChanged$.next(event); // Değişikliği yayınla
  }

  onSelectionChanged(event: any): void {
    if (!this.isBrowser || !this.quillEditor) return; // Sadece tarayıcıda ve editör varsa

    if (event.range) {
      this.updateEditorFormatState(this.quillEditor.getFormat(event.range));
    } else {
       // Seçim kaybolduğunda format state'ini sıfırlayabilir veya son durumu koruyabiliriz.
       // Şimdilik boş state gönderiyoruz.
       this.updateEditorFormatState({});
    }
    this.selectionChanged$.next(event); // Değişikliği yayınla (throttle edilecek)
  }

  applyFormat(format: string, value?: any): void {
    if (!this.isBrowser || !this.quillEditor) return;
    // Formatlamadan önce Quill instance'ının varlığını kontrol et
    try {
        this.quillEditor.format(format, value ?? !this.editorFormats[format as keyof EditorFormatState]);
        this.quillEditor.focus(); // Format uyguladıktan sonra editöre odaklan
    } catch (error) {
        console.error(`Format uygularken hata (${format}):`, error);
    }
  }

  clearFormatting(): void {
    if (!this.isBrowser || !this.quillEditor) return;
    const range = this.quillEditor.getSelection();
    if (range) {
      this.quillEditor.removeFormat(range.index, range.length);
    }
  }

  updateEditorFormatState(formats: any): void {
     if (!this.isBrowser) return; // Sadece tarayıcıda
     // ... (Mevcut format state güncelleme kodları aynı) ...
     const newState: EditorFormatState = {};
     newState.font = formats.font || 'arial';
     newState.size = formats.size || '12px';
     newState.bold = formats.bold || false;
     newState.italic = formats.italic || false;
     newState.underline = formats.underline || false;
     newState.strike = formats.strike || false;
     newState.color = formats.color || '#000000';
     newState.background = formats.background || '#ffffff';
     newState.align = formats.align || 'left';
     newState.list = formats.list || false;
     newState.script = formats.script || false;
     newState.header = formats.header || false;
     newState.blockquote = formats.blockquote || false;
     newState['code-block'] = formats['code-block'] || false;

     // NgZone dışında değişiklik yapılıyorsa detectChanges'i tetikle
     this.ngZone.run(() => {
       this.editorFormats = newState;
       // this.changeDetectorRef.detectChanges(); // Bu çok sık tetiklenebilir, dikkatli kullanılmalı
     });
  }

  // Helper Functions
  updateStats(): void {
    if (!this.isBrowser || !this.quillEditor) { // Tarayıcı ve editör kontrolü
       this.stats = { words: 0, chars: 0, pages: 0 };
       return;
    }
    const text = this.quillEditor.getText();
    // ... (Stat hesaplama kodları aynı) ...
    this.stats.chars = text.length ? text.length - 1 : 0; // Boş metin kontrolü
    this.stats.words = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    this.stats.pages = this.stats.words > 0 ? Math.ceil(this.stats.words / 300) : 0;

    this.changeDetectorRef.detectChanges(); // Güncelleme sonrası UI'ı yenile
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  showSnackbar(message: string, isError: boolean = false): void {
    this.snackBar.open(message, 'Kapat', {
      duration: isError ? 5000 : 3000,
      panelClass: isError ? 'error-snackbar' : 'success-snackbar',
    });
  }
  // UI Events
  subscribeToChanges(): void {
    if (!this.isBrowser) return; // Sadece tarayıcıda dinle

    // contentChanged$
    this.contentChanged$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500), // Biraz daha uzun süre beklenebilir
      distinctUntilChanged((prev, curr) => JSON.stringify(prev.content) === JSON.stringify(curr.content)) // İçerik değişimini kontrol et
    ).subscribe(event => {
      if (event.source === 'user' && !this.isLoading) {
        this.ngZone.run(() => { // NgZone içinde state güncelle
            this.isSaved = false;
            this.documentMeta.size = this.documentContent ? JSON.stringify(this.documentContent).length : 0;
            this.updateStats();
            console.log("Content changed by user, marked as unsaved.");
            this.changeDetectorRef.detectChanges(); // Değişiklikleri UI'a yansıt
        });
      }
    });

    // AutoSave Trigger
     this.contentChanged$.pipe(
        takeUntil(this.destroy$),
        debounceTime(3000) // Otomatik kaydetme için daha uzun süre
     ).subscribe(event => {
         if (event.source === 'user' && !this.isLoading && !this.isSaved) { // Sadece kaydedilmemişse otomatik kaydet
             console.log("Triggering auto-save...");
             this.autoSave();
         }
     });

    // selectionChanged$
    this.selectionChanged$.pipe(
      takeUntil(this.destroy$),
      throttleTime(150) // Format state güncellemesi için throttle yeterli
    ).subscribe(event => {
        // Format state zaten onSelectionChanged içinde güncelleniyor.
        // Burada ek bir işlem yapmaya gerek yok.
    });

    // metaChanged$
    this.metaChanged$.pipe(
        takeUntil(this.destroy$),
        debounceTime(500) // Meta verisi için debounce
    ).subscribe(() => {
        if (!this.isLoading) {
           this.isSaved = false;
           console.log("Meta data changed, marked as unsaved.");
           this.changeDetectorRef.detectChanges();
        }
    });
  }

  onMetaChange(): void {
      if (!this.isLoading) { // Yüklenmiyorsa meta değişikliğini yayınla
          this.metaChanged$.next();
      }
  }

  setupScrollListener(): void {
      if (!this.isBrowser) return; // Sadece tarayıcıda
      // fromEvent RxJS operatörü zaten takeUntil ile yönetiliyor, ekstra remove gerekmez
      fromEvent(window, 'scroll').pipe(
          takeUntil(this.destroy$),
          throttleTime(100) // Scroll olayını throttle et
      ).subscribe(() => {
          this.scrollPosition = window.scrollY;
          // Scroll pozisyonu değişikliği için detectChanges gerekli olmayabilir
          // Eğer toolbar'ın shadow'u gibi UI değişiklikleri varsa gerekli.
          this.changeDetectorRef.detectChanges();
      });
  }

  // HostListener SSR'da sorun çıkarabilir, fromEvent daha güvenli
  // @HostListener('window:scroll', ['$event'])
  // onWindowScroll(event: Event): void {
  //   if (this.isBrowser) {
  //     this.scrollPosition = window.scrollY;
  //   }
  // }

  toggleSidePanel(): void {
    this.showSidePanel = !this.showSidePanel;
  }

  // Side Panel Functions
  addComment(): void {
    if (!this.newComment.trim()) return;
    const newCommentData: Comment = {
      id: `c${Date.now()}`,
      userId: this.currentUserId,
      userName: this.userName,
      userInitials: this.userInitials,
      createdAt: new Date(),
      text: this.newComment.trim(),
    };
    this.comments.push(newCommentData);
    this.newComment = '';
    this.showSnackbar('Yorum eklendi', false);
  }

  editComment(comment: Comment): void {
    console.log('Yorum düzenle:', comment);
    const newText = prompt("Yeni yorum metni:", comment.text);
    if (newText !== null && newText.trim() !== comment.text) {
        comment.text = newText.trim();
        this.showSnackbar('Yorum güncellendi', false);
    }
  }

  deleteComment(comment: Comment): void {
    if (confirm("Bu yorumu silmek istediğinizden emin misiniz?")) {
        this.comments = this.comments.filter(c => c.id !== comment.id);
        this.showSnackbar('Yorum silindi', false);
    }
  }

  // Tags
  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && !this.documentMeta.tags.includes(value)) {
      this.documentMeta.tags.push(value);
      this.onMetaChange();
    }
    // TypeScript strictNullChecks fix
    if (event.chipInput) {
      event.chipInput.clear();
    }
  }

  removeTag(tag: string): void {
    const index = this.documentMeta.tags.indexOf(tag);
    if (index >= 0) {
      this.documentMeta.tags.splice(index, 1);
      this.onMetaChange();
    }
  }

  // Sharing
  addSharedUser(): void {
    const email = this.newSharedUser.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !this.documentMeta.sharedWith.includes(email)) {
      this.documentMeta.sharedWith.push(email);
      this.newSharedUser = '';
      this.onMetaChange();
      this.showSnackbar(`${email} ile paylaşıldı.`, false);
    } else if (this.documentMeta.sharedWith.includes(email)) {
        this.showSnackbar(`${email} zaten paylaşılmış.`, true);
    } else {
        this.showSnackbar('Geçerli bir e-posta adresi girin.', true);
    }
  }

  removeSharedUser(user: string): void {
    this.documentMeta.sharedWith = this.documentMeta.sharedWith.filter(u => u !== user);
    this.onMetaChange();
    this.showSnackbar(`${user} paylaşımı kaldırıldı.`, false);
  }

  // Versions
  createNewVersion(): void {
    const versionName = prompt("Yeni sürüm için bir ad girin (isteğe bağlı):");
    const newVersion: DocumentVersion = {
        id: `v${Date.now()}`,
        createdAt: new Date(),
        name: versionName || `Sürüm ${this.documentMeta.versions.length + 1}`,
        content: this.documentContent
    };
    this.documentMeta.versions.unshift(newVersion);
    this.onMetaChange();
    this.showSnackbar('Yeni sürüm oluşturuldu.', false);
  }

  restoreVersion(version: DocumentVersion): void {
    if (confirm(`"${version.name}" adlı sürüme geri dönmek istediğinizden emin misiniz? Mevcut kaydedilmemiş değişiklikler kaybolacaktır.`)) {
        this.documentContent = version.content;
        this.isSaved = false;
        this.showSnackbar(`"${version.name}" sürümüne geri dönüldü. Kaydetmeyi unutmayın.`, false);
    }
  }

  showVersionHistory(): void {
      this.showSidePanel = true;
      console.log('Sürüm geçmişi gösteriliyor...');
  }

  showShareOptions(): void {
    this.showSidePanel = true;
    console.log('Paylaşım seçenekleri gösteriliyor...');
  }

  // Other Operations
  exportAsPdf(): void {
    this.showSnackbar('PDF dışa aktarma henüz uygulanmadı.', true);
  }

  exportAsDocx(): void {
    this.showSnackbar('Word dışa aktarma henüz uygulanmadı.', true);
  }

  deleteDocument(): void {
    if (confirm("Bu dokümanı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
        console.log('Doküman siliniyor:', this.documentMeta.id);
        this.showSnackbar('Doküman silindi.', false);
        this.router.navigate(['/documents']);
    }
  }

  logout(): void {
      console.log("Çıkış yapılıyor...");
      this.router.navigate(['/login']);
  }

  // İleri Düzey Editör İşlevleri (Quill instance kontrolü eklendi)
  insertTable(): void {
    if (!this.isBrowser || !this.quillEditor) return;
    // 'better-table' modülünü alıp insertTable'ı çağır
    const tableModule = this.quillEditor.getModule('better-table');
    if (tableModule && typeof tableModule.insertTable === 'function') {
      tableModule.insertTable(3, 3);
    } else {
      this.showSnackbar('Tablo modülü yüklenemedi veya insertTable fonksiyonu bulunamadı.', true);
      console.error('Better Table Module:', tableModule);
    }
  }

  insertLink(): void {
    if (!this.isBrowser || !this.quillEditor) return;
    const url = prompt("Eklemek istediğiniz URL:", "https://");
    if (url) {
      // Seçili metin varsa onu link yap, yoksa URL'i direkt ekle
      const range = this.quillEditor.getSelection(true); // true -> focus editor
      this.quillEditor.format('link', url);
      // Kullanıcıya daha iyi bir deneyim sunmak için link metnini de sormak daha iyi olabilir.
    }
  }

  insertImage(): void {
    if (!this.isBrowser || !this.quillEditor) return;
    const url = prompt("Resim URL'si:");
    if (url) {
        const range = this.quillEditor.getSelection(true);
        // Embed olarak ekle, index kontrolü yap
        this.quillEditor.insertEmbed(range ? range.index : 0, 'image', url, 'user');
        // Resim eklendikten sonra imleci resmin sonrasına taşı
        if(range) this.quillEditor.setSelection(range.index + 1, 0);
    }
  }

  insertFormula(): void {
     if (!this.isBrowser || !this.quillEditor) return;
     const formulaModule = this.quillEditor.getModule('formula'); // Varsayılan formula modülü
     if (formulaModule) {
         const formula = prompt("Formül girin (KaTeX formatında):");
         if(formula) {
             const range = this.quillEditor.getSelection(true);
             this.quillEditor.insertEmbed(range ? range.index : 0, 'formula', formula, 'user');
             if(range) this.quillEditor.setSelection(range.index + 1, 0);
         }
     } else {
         this.showSnackbar('Matematik formülü modülü (formula) aktif değil.', true);
     }
   }

  insertChart(): void { this.showSnackbar('Grafik ekleme henüz desteklenmiyor.', true); }
  insertCode(): void { this.applyFormat('code-block'); } // Zaten applyFormat içinde kontrol var

  insertDatetime(): void {
      if (!this.isBrowser || !this.quillEditor) return;
      const now = new Date().toLocaleString();
      const range = this.quillEditor.getSelection(true);
      this.quillEditor.insertText(range ? range.index : 0, now, 'user');
      if(range) this.quillEditor.setSelection(range.index + now.length, 0); // İmleci sonuna taşı
  }

  insertHorizontalRule(): void {
      if (!this.isBrowser || !this.quillEditor) return;
      const range = this.quillEditor.getSelection(true);
      if (range) {
          // Özel bir HR blot'u register edilmediyse, HTML ile ekleme veya basit çizgi kullanılabilir.
          // Quill'de HR için standart bir format yok, genellikle custom blot ile yapılır.
          // Alternatif olarak, basit bir çizgi karakteri veya HTML embed kullanılabilir.
          // this.quillEditor.insertEmbed(range.index, 'divider', true, 'user'); // Eğer 'divider' blot'u varsa
          this.quillEditor.insertText(range.index, '\n---\n', { 'align': 'center', 'italic': true }, 'user'); // Basit çizgi
          this.quillEditor.setSelection(range.index + 5, 0); // İmleci taşı
          // this.showSnackbar('Yatay çizgi için özel Blot gerekir.', true);
      }
  }

  insertEmoji(): void {
     if (!this.isBrowser || !this.quillEditor) return;
     const emojiModule = this.quillEditor.getModule('emoji-toolbar'); // Emoji modülünü al
     if (emojiModule) {
         // Emoji paletini açmak için bir yöntem varsa (genellikle toolbar butonu ile tetiklenir)
         // emojiModule.openPalette(); // Örnek - gerçek API farklı olabilir
         // Veya direkt emoji ekle
         const selection = this.quillEditor.getSelection(true);
         if (selection) {
             // emojiModule.insertEmoji(selection.index, 'smile'); // Örnek - API farklı olabilir
             // Veya text olarak ekle
             this.quillEditor.insertText(selection.index, '😊', 'user');
             this.quillEditor.setSelection(selection.index + 2, 0);
         }
     } else {
         this.showSnackbar('Emoji modülü aktif değil.', true);
     }
   }
}