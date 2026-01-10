
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Book as BookIcon, Layers, Loader2, Sparkles, Sun, Moon, FileText, Upload, X, LogOut, Trash2, Github } from 'lucide-react';
import { Book, BookStatus, Chapter } from './types';
import { analyzeBook } from './geminiService';
import BookCard from './components/BookCard';
import Reader from './components/Reader';
import { getAllBooks, saveBook, deleteBook, getBookById } from './db';
import { auth } from './firebaseConfig';
import { loginWithGoogle, logoutUser } from './firebaseService';
import { onAuthStateChanged, User } from 'firebase/auth';

declare const pdfjsLib: any;
declare const ePub: any; 

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isImporting, setIsImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
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

  // 1. Check Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        loadBooks(currentUser.uid);
      } else {
        setBooks([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadBooks = async (userId: string) => {
    setIsLoadingBooks(true);
    try {
      const data = await getAllBooks(userId);
      setBooks(data);
    } catch (error) {
      console.error("Failed to load books from DB", error);
    } finally {
      setIsLoadingBooks(false);
    }
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

  const handleLogout = async () => {
    await logoutUser();
  };

  // --- PDF & EPUB Extraction Logic (Giữ nguyên) ---
  const extractTextFromPdf = async (file: File): Promise<{ text: string, coverUrl: string | null }> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let coverUrl: string | null = null;
    try {
        setImportStatus('Đang tạo ảnh bìa từ PDF...');
        const page1 = await pdf.getPage(1);
        const scale = 1.5; 
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
    const navigation = await book.loaded.navigation;
    const toc: Chapter[] = [];
    const processToc = (items: any[]) => {
      items.forEach(item => {
        toc.push({ title: item.label.trim(), id: item.href, index: 0 });
        if (item.subitems && item.subitems.length > 0) processToc(item.subitems);
      });
    };
    if (navigation.toc) processToc(navigation.toc);

    let fullText = "";
    const spine = book.spine;
    for (let i = 0; i < spine.length; i++) {
        const item = spine.get(i);
        setImportStatus(`Đang xử lý chương ${i + 1}/${spine.length}...`);
        try {
            let contentString = "";
            if (book.archive) {
                 try { contentString = await book.archive.getText(item.href); } catch (e) { }
            }
            if (!contentString) {
                const loaded = await book.load(item.href);
                if (typeof loaded === 'string') contentString = loaded;
                else if (loaded instanceof Document) contentString = loaded.documentElement.outerHTML;
            }
            if (contentString) {
                 const parser = new DOMParser();
                 const doc = parser.parseFromString(contentString, "text/html");
                 fullText += doc.body.innerText + "\n\n";
            }
        } catch (e) { console.error(e); }
    }
    return { text: fullText, chapters: toc, coverUrl };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      setNewBook(prev => ({ ...prev, title: fileName }));
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setIsImporting(true);
    setShowAddModal(false);

    try {
      let extractedText = "";
      let format: 'pdf' | 'epub' = 'pdf';
      let chapters: Chapter[] = [];
      let coverUrl: string | null = null;

      if (selectedFile.type === 'application/pdf') {
        const result = await extractTextFromPdf(selectedFile);
        extractedText = result.text;
        coverUrl = result.coverUrl;
        format = 'pdf';
      } else if (selectedFile.type === 'application/epub+zip') {
        const result = await extractDataFromEpub(selectedFile);
        extractedText = result.text;
        chapters = result.chapters;
        coverUrl = result.coverUrl;
        format = 'epub';
      }

      setImportStatus('Đang phân tích AI (bước cuối)...');
      const aiData = await analyzeBook(newBook.title, newBook.author, extractedText);

      const book: Book = {
        id: crypto.randomUUID(),
        userId: user.uid, // Gắn ID người dùng vào sách
        title: newBook.title,
        author: newBook.author || "Unknown",
        category: aiData.category || "General",
        description: aiData.description || "",
        coverUrl: coverUrl || "", 
        status: BookStatus.WANT_TO_READ,
        addedDate: new Date().toISOString(),
        summary: aiData.summary,
        insightHtml: aiData.insightHtml,
        fullText: extractedText,
        chapters: chapters,
        format: format,
        notes: [],
        progress: 0
      };

      await saveBook(book); // Lưu vào IndexedDB
      setBooks(prev => [book, ...prev]);

    } catch (error) {
      console.error("Error importing book:", error);
      alert("Có lỗi xảy ra khi nhập sách.");
    } finally {
      setIsImporting(false);
      setImportStatus('');
      setNewBook({ title: '', author: '' });
      setSelectedFile(null);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa sách này không?")) {
      await deleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleUpdateBookStatus = async (id: string, status: BookStatus) => {
    const book = books.find(b => b.id === id);
    if (book) {
      const updatedBook = { ...book, status };
      await saveBook(updatedBook);
      setBooks(prev => prev.map(b => b.id === id ? updatedBook : b));
    }
  };

  const handleUpdateBookContent = async (updatedBook: Book) => {
    await saveBook(updatedBook);
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    setReadingBook(updatedBook); 
  };

  // --- RENDER ---
  
  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-800">
           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Hyle Reader</h1>
           <p className="text-slate-500 dark:text-slate-400 mb-8">Ứng dụng đọc sách thông minh với công nghệ AI Insight.</p>
           
           <button 
             onClick={loginWithGoogle}
             className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-3 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-[1.02] shadow-sm"
           >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
             </svg>
             Đăng nhập với Google
           </button>
           
           <div className="mt-8 text-xs text-slate-400">
             <p>Dữ liệu sách sẽ được lưu trên trình duyệt này.</p>
           </div>
        </div>
      </div>
    );
  }

  // READER MODE
  if (readingBook) {
    return (
      <Reader 
        book={readingBook} 
        onClose={() => setReadingBook(null)} 
        onUpdateBook={handleUpdateBookContent}
      />
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                Hyle Reader
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800 ml-2">
                 {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" />
                 ) : (
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                        {user.email?.charAt(0).toUpperCase()}
                    </div>
                 )}
                 <button 
                   onClick={handleLogout}
                   className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                   title="Đăng xuất"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Thư viện của bạn</h1>
            <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> {books.length} cuốn sách • Dữ liệu lưu cục bộ
            </p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Thêm sách mới
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sách, tác giả..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        {/* Loading Indicator */}
        {isLoadingBooks ? (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-900 h-80 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800"></div>
                ))}
             </div>
        ) : (
            <>
                {/* Book Grid */}
                {filteredBooks.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-in fade-in duration-500">
                    {filteredBooks.map(book => (
                      <BookCard 
                        key={book.id} 
                        book={book} 
                        onUpdateStatus={handleUpdateBookStatus} 
                        onDelete={handleDeleteBook}
                        onOpenReader={setReadingBook}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Chưa có cuốn sách nào</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">Thư viện của bạn đang trống. Hãy thêm cuốn sách đầu tiên để trải nghiệm AI Insight.</p>
                    <button onClick={() => setShowAddModal(true)} className="text-indigo-600 font-bold hover:underline">Thêm sách ngay</button>
                  </div>
                )}
            </>
        )}

      </main>

      {/* Import Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Nhập sách mới</h2>
            
            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Chọn File (PDF/EPUB)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${selectedFile ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".pdf,.epub" 
                    className="hidden" 
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                      <FileText className="w-6 h-6" />
                      {selectedFile.name}
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <Upload className="w-10 h-10 text-slate-400 mx-auto" />
                       <p className="text-slate-500 dark:text-slate-400 text-sm">Nhấn để tải lên hoặc kéo thả file vào đây</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tên sách</label>
                    <input 
                      required
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newBook.title}
                      onChange={e => setNewBook({...newBook, title: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tác giả</label>
                    <input 
                      required
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newBook.author}
                      onChange={e => setNewBook({...newBook, author: e.target.value})}
                    />
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={!selectedFile || isImporting}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 mt-4 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                     <Loader2 className="w-5 h-5 animate-spin" />
                     {importStatus || 'Đang xử lý...'}
                  </>
                ) : (
                  'Bắt đầu phân tích & Nhập'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isImporting && (
         <div className="fixed inset-0 z-[60] bg-white/80 dark:bg-slate-900/90 backdrop-blur flex flex-col items-center justify-center text-center p-4">
             <div className="w-20 h-20 relative mb-6">
                <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto text-indigo-600 w-8 h-8 animate-pulse" />
             </div>
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Đang nhập thư viện</h3>
             <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">{importStatus}</p>
         </div>
      )}
    </div>
  );
};

export default App;
    