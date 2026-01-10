
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Book as BookIcon, Filter, Layers, Import, Loader2, Sparkles, Sun, Moon, FileText, Upload, X, LogIn, LogOut, User, AlertTriangle, Copy, Check } from 'lucide-react';
import { Book, BookStatus, Chapter } from './types';
import { analyzeBook } from './geminiService';
import BookCard from './components/BookCard';
import Reader from './components/Reader';
import { auth, googleProvider } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { addBookToFirebase, getUserBooks, updateBookInFirebase, deleteBookFromFirebase, fetchTextFromStorage } from './firebaseService';

declare const pdfjsLib: any;
declare const ePub: any; // Khai báo ePub từ thư viện global

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isImporting, setIsImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false); // Loading state khi mở sách
  const [importStatus, setImportStatus] = useState<string>(''); 
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const [newBook, setNewBook] = useState({ title: '', author: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadBooks();
      } else {
        setBooks([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const data = await getUserBooks();
      setBooks(data);
    } catch (error) {
      console.error("Failed to load books", error);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      alert(`Đăng nhập thất bại: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const categories = useMemo(() => {
    const cats = new Set(books.map(b => b.category));
    return ['All', ...Array.from(cats)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            b.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterCategory === 'All' || b.category === filterCategory;
      return matchesSearch && matchesFilter;
    });
  }, [books, searchTerm, filterCategory]);

  const extractTextFromPdf = async (file: File): Promise<{ text: string, coverUrl: string | null }> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // --- Logic trích xuất ảnh bìa từ trang 1 ---
    let coverUrl: string | null = null;
    try {
        setImportStatus('Đang tạo ảnh bìa từ PDF...');
        const page1 = await pdf.getPage(1);
        const scale = 1.5; // Scale lớn hơn chút để ảnh rõ nét
        const viewport = page1.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page1.render({ canvasContext: context, viewport: viewport }).promise;
            coverUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
    } catch (e) {
        console.warn("Lỗi tạo ảnh bìa PDF:", e);
    }
    // ------------------------------------------

    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      setImportStatus(`Đang đọc trang ${i}/${pdf.numPages} (PDF)...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n\n";
    }
    
    return { text: fullText, coverUrl };
  };

  const extractTextFromDoc = (doc: Document): string => {
    let text = "";
    
    // Helper duyệt DOM đệ quy
    const walk = (node: Node) => {
      if (node.nodeType === 3) { // Node.TEXT_NODE
        const val = node.nodeValue?.trim();
        if (val) text += val + " ";
      } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        // Bỏ qua Metadata và Script
        if (['head', 'script', 'style', 'svg', 'meta', 'link', 'noscript'].includes(tagName)) return;

        // Các thẻ block tạo dòng mới
        const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'hr', 'blockquote', 'section', 'article', 'header', 'footer', 'title', 'tr', 'td'];
        
        if (tagName === 'br') text += "\n";
        
        // Xử lý ảnh
        if (tagName === 'img') {
             const alt = el.getAttribute('alt');
             if (alt) text += `[Ảnh: ${alt}] `;
        }

        // Duyệt con
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
        
        if (blockElements.includes(tagName)) {
           text += "\n\n";
        }
      }
    };
    
    // Bắt đầu từ body, nếu không có body (XML) thì dùng documentElement
    const root = doc.body || doc.documentElement;
    if (root) {
        walk(root);
    }
    
    // Fallback: Nếu walk thất bại (do cấu trúc lạ), dùng textContent
    if (!text.trim() && root) {
        text = root.textContent || "";
    }
    
    // Xử lý khoảng trắng thừa
    return text.replace(/\n\s+\n/g, '\n\n').trim();
  };

  const extractDataFromEpub = async (file: File): Promise<{ text: string, chapters: Chapter[], coverUrl: string | null }> => {
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;
    
    setImportStatus('Đang trích xuất ảnh bìa...');
    let coverUrl = null;
    try {
        const cover = await book.coverUrl();
        if (cover) coverUrl = cover;
    } catch (e) {
        console.warn("Không lấy được ảnh bìa:", e);
    }

    setImportStatus('Đang đọc cấu trúc EPUB...');
    
    // Trích xuất mục lục (TOC)
    const navigation = await book.loaded.navigation;
    const toc: Chapter[] = [];
    
    const processToc = (items: any[]) => {
      items.forEach(item => {
        toc.push({ 
          title: item.label.trim(), 
          id: item.href, 
          index: 0 
        });
        if (item.subitems && item.subitems.length > 0) {
          processToc(item.subitems);
        }
      });
    };
    
    if (navigation.toc) {
      processToc(navigation.toc);
    }

    let fullText = "";
    let currentParagraphIndex = 0;
    
    const spine = book.spine;
    
    for (let i = 0; i < spine.length; i++) {
        const item = spine.get(i);
        setImportStatus(`Đang xử lý chương ${i + 1}/${spine.length}...`);
        
        try {
            let contentString = "";
            
            if (book.archive) {
                 try {
                    contentString = await book.archive.getText(item.href);
                 } catch (e) { }
            }
            
            if (!contentString) {
                const loaded = await book.load(item.href);
                if (typeof loaded === 'string') {
                    contentString = loaded;
                } else if (loaded instanceof Document) {
                    contentString = loaded.documentElement.outerHTML;
                }
            }

            if (contentString) {
                 const parser = new DOMParser();
                 const doc = parser.parseFromString(contentString, 'text/html');
                 const textContent = extractTextFromDoc(doc);
                 
                 const cleanItemHref = item.href; 
                 toc.forEach(t => {
                    if (t.id) {
                        const tocFile = t.id.split('#')[0];
                        if (cleanItemHref.endsWith(tocFile) || tocFile.endsWith(cleanItemHref)) {
                           if (t.index === 0) t.index = currentParagraphIndex;
                        }
                    }
                 });

                 const finalContent = textContent || "";
                 const paragraphs = finalContent.split(/\n\s*\n/);
                 
                 if (finalContent.trim()) {
                    currentParagraphIndex += paragraphs.length;
                    fullText += finalContent + "\n\n";
                 }
            }
        } catch (err) {
            console.warn(`Lỗi khi đọc section ${i}:`, err);
        }
    }
    
    const uniqueToc = toc.filter((t, index, self) => 
       index === self.findIndex((x) => x.title === t.title && x.index === t.index)
    );
    const cleanToc = uniqueToc.filter(t => t.title).sort((a, b) => a.index - b.index);

    return { text: fullText, chapters: cleanToc, coverUrl };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileType = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 
                       file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : null;

      if (!fileType) {
        alert('Vui lòng tải tệp PDF hoặc EPUB.');
        return;
      }
      setSelectedFile(file);
      if (!newBook.title) {
        setNewBook(prev => ({ ...prev, title: file.name.replace(/\.(pdf|epub)$/i, '') }));
      }
    }
  };

  const handleUpdateBook = async (updatedBook: Book) => {
    // Cập nhật UI ngay lập tức
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    if (readingBook && readingBook.id === updatedBook.id) {
      setReadingBook(updatedBook);
    }
    // Sync lên Firebase
    await updateBookInFirebase(updatedBook);
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm('Xoá bản phân tích này? Hành động này sẽ xoá sách khỏi Cloud.')) {
        setBooks(prev => prev.filter(b => b.id !== id));
        await deleteBookFromFirebase(id);
    }
  };

  const handleOpenBook = async (book: Book) => {
      // Nếu đã có text, mở ngay
      if (book.fullText) {
          setReadingBook(book);
          return;
      }

      // Nếu chưa có text (do lazy load từ firebase), phải tải về
      if (book.textStorageUrl) {
          setIsLoadingContent(true);
          try {
              const text = await fetchTextFromStorage(book.textStorageUrl);
              const fullBook = { ...book, fullText: text };
              setReadingBook(fullBook);
              // Cập nhật lại books state để lần sau không phải load lại trong phiên này
              setBooks(prev => prev.map(b => b.id === book.id ? fullBook : b));
          } catch (e) {
              alert("Không thể tải nội dung sách. Vui lòng kiểm tra kết nối mạng.");
          } finally {
              setIsLoadingContent(false);
          }
      } else {
          // Trường hợp sách lỗi hoặc sách cũ local
          setReadingBook(book);
      }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.title) return;
    if (!user) {
        alert("Vui lòng đăng nhập để lưu sách.");
        return;
    }

    setIsImporting(true);
    setImportStatus('Đang khởi động...');
    
    try {
      let extractedText = "";
      let chapters: Chapter[] = [];
      let format: 'pdf' | 'epub' = 'pdf';
      let extractedCoverUrl: string | null = null;

      if (selectedFile) {
        if (selectedFile.name.toLowerCase().endsWith('.epub')) {
            format = 'epub';
            const epubData = await extractDataFromEpub(selectedFile);
            extractedText = epubData.text;
            chapters = epubData.chapters;
            extractedCoverUrl = epubData.coverUrl;
        } else {
            const pdfData = await extractTextFromPdf(selectedFile);
            extractedText = pdfData.text;
            extractedCoverUrl = pdfData.coverUrl;
        }
      }

      setImportStatus('AI đang phân tích tri thức...');
      const aiData = await analyzeBook(newBook.title, newBook.author, extractedText);
      
      const tempBook: Book = {
        id: "", // Firebase sẽ tạo
        title: newBook.title,
        author: newBook.author || 'Ẩn danh',
        category: aiData.category || 'Khác',
        description: aiData.description || '',
        summary: aiData.summary || '',
        insightHtml: aiData.insightHtml || '',
        fullText: extractedText,
        format: format,
        coverUrl: extractedCoverUrl || `https://picsum.photos/seed/${newBook.title}/400/600`,
        status: BookStatus.WANT_TO_READ,
        addedDate: new Date().toISOString(),
        pdfData: selectedFile ? "FILE_ATTACHED" : undefined,
        notes: [],
        chapters: chapters, 
        progress: 0,
        lastScrollPosition: 0
      };

      setImportStatus('Đang đồng bộ lên Cloud...');
      const savedBook = await addBookToFirebase(tempBook);

      setBooks(prev => [savedBook, ...prev]);
      setNewBook({ title: '', author: '' });
      setSelectedFile(null);
      setIsImporting(false);
      setImportStatus('');
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding book:", error);
      setIsImporting(false);
      setImportStatus('Có lỗi xảy ra!');
      alert('Không thể xử lý sách hoặc lỗi upload Firebase.');
    }
  };

  // --- Render Login Screen if not logged in ---
  if (!user) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
             <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
                 
                 {/* Decorative background element */}
                 <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
                 <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>

                 <div className="relative z-10">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mx-auto mb-6">
                        <BookIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Lumiere Insight</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Nền tảng đọc sách & giải phẫu tri thức hỗ trợ bởi AI. Đăng nhập để đồng bộ thư viện của bạn.</p>
                    
                    <button 
                        onClick={handleLogin}
                        className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-sm group"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                        <span className="text-slate-700 dark:text-white">Tiếp tục với Google</span>
                    </button>
                    
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center items-center gap-2">
                        <button 
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 transition-colors"
                        >
                            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <span className="text-xs text-slate-400">Giao diện</span>
                    </div>
                 </div>
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      
      {/* Loading Overlay when Fetching Content */}
      {isLoadingContent && (
          <div className="fixed inset-0 z-[70] bg-white/80 dark:bg-slate-900/80 backdrop-blur flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="font-bold text-slate-700 dark:text-slate-300">Đang tải nội dung sách từ Cloud...</p>
          </div>
      )}

      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BookIcon className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white hidden sm:block">Lumiere Insight</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                    {user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium max-w-[100px] truncate">{user.displayName}</span>
            </div>

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/30 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-md active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Phân tích sách</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Tìm kiếm trí thức..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              className="pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl outline-none appearance-none shadow-sm cursor-pointer"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'Tất cả thể loại' : cat}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingBooks ? (
             <div className="flex justify-center py-20">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
             </div>
        ) : filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredBooks.map(book => (
              <BookCard 
                key={book.id} 
                book={book} 
                onUpdateStatus={(id, status) => handleUpdateBook({ ...book, status })} 
                onDelete={handleDeleteBook}
                onOpenReader={handleOpenBook}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 bg-white dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Layers className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Chưa có bản giải phẫu tri thức nào</p>
          </div>
        )}
      </main>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-8">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Giải phẫu tri thức mới
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tải lên sách/tài liệu</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedFile ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}
                >
                  <input type="file" accept=".pdf,.epub" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400 text-center">
                      <FileText className="w-10 h-10" />
                      <span className="text-xs font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500 font-medium text-center">Chọn file PDF hoặc EPUB</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <input required type="text" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tên sách/Tài liệu..." value={newBook.title} onChange={(e) => setNewBook(prev => ({ ...prev, title: e.target.value }))} />
                <input type="text" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tác giả..." value={newBook.author} onChange={(e) => setNewBook(prev => ({ ...prev, author: e.target.value }))} />
              </div>
              
              <button disabled={isImporting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all">
                {isImporting ? <><Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">{importStatus}</span></> : <><Sparkles className="w-5 h-5" /> Bắt đầu giải phẫu</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {readingBook && (
        <Reader 
          book={readingBook} 
          onClose={() => setReadingBook(null)} 
          onUpdateBook={handleUpdateBook}
        />
      )}
    </div>
  );
};

export default App;
