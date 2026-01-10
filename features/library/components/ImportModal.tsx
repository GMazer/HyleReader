
import React, { useState, useRef } from 'react';
import { X, FileText, Upload, Loader2, BookOpen } from 'lucide-react';
import { User } from 'firebase/auth';
import { Book, BookStatus, Chapter } from '../../../types';
import { analyzeBook } from '../../../geminiService';
import { saveBook } from '../../../db';

declare const pdfjsLib: any;
declare const ePub: any;

interface ImportModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (book: Book) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ user, onClose, onSuccess }) => {
  const [newBook, setNewBook] = useState({ title: '', author: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (Giữ nguyên logic extractTextFromPdf và extractDataFromEpub từ App.tsx cũ)
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
        if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page1.render({ canvasContext: context, viewport: viewport }).promise;
            coverUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
    } catch (e) { console.warn("Lỗi tạo ảnh bìa PDF:", e); }

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
    try { const cover = await book.coverUrl(); if (cover) coverUrl = cover; } catch (e) {}

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
            if (book.archive) { try { contentString = await book.archive.getText(item.href); } catch (e) { } }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsImporting(true);
    
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
        userId: user.uid,
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

      await saveBook(book);
      onSuccess(book);
      onClose();

    } catch (error) {
      console.error("Error importing book:", error);
      alert("Có lỗi xảy ra khi nhập sách.");
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Loading Overlay inside Modal context if needed, or Global */}
      {isImporting && (
         <div className="absolute inset-0 z-[60] bg-white/90 dark:bg-slate-900/90 flex flex-col items-center justify-center text-center p-4 rounded-2xl">
             <div className="w-20 h-20 relative mb-6">
                <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <BookOpen className="absolute inset-0 m-auto text-indigo-600 w-8 h-8 animate-pulse" />
             </div>
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Đang xử lý sách</h3>
             <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">{importStatus}</p>
         </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
        {!isImporting && (
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-6 h-6" />
            </button>
        )}
        
        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Nhập sách mới</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
                 Đang xử lý...
              </>
            ) : (
              'Bắt đầu phân tích & Nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportModal;
