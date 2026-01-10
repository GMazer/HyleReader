
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Bookmark, ArrowLeft, Sparkles, AlignLeft, MessageSquare, Trash2, Check, List, ChevronRight, ChevronLeft, Type, Minus, Plus, Languages, Loader2, ArrowRight, BookA, Save, Send, Bot, User as UserIcon, MessageCircleQuestion } from 'lucide-react';
import { Book, Note, Chapter, BookStatus, ReaderSettings, VocabularyItem } from '../../types';
import { translateText, lookupDictionary, createBookChat, handleGeminiError } from '../../geminiService';
import { saveVocabulary } from '../../db';
import { Chat, GenerateContentResponse } from '@google/genai';

interface ReaderProps {
  book: Book;
  onClose: () => void;
  onUpdateBook?: (book: Book) => void;
}

type ViewMode = 'insight' | 'read';
type SidebarView = 'notes' | 'translation' | 'dictionary' | 'chat';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const Reader: React.FC<ReaderProps> = ({ book, onClose, onUpdateBook }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('insight');
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('notes');
  const [showTOC, setShowTOC] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // State quản lý chương hiện tại (Pagination)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  // Settings State
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    fontFamily: 'bookerly',
    theme: 'light',
    lineHeight: 1.6
  });

  // Selection & Note States
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInputValue, setNoteInputValue] = useState('');
  
  // Translation & Dictionary States
  const [translationCache, setTranslationCache] = useState<Record<number, string>>({});
  const [isTranslatedMode, setIsTranslatedMode] = useState(false);
  const [isTranslatingChapter, setIsTranslatingChapter] = useState(false);
  
  const [selectedTranslation, setSelectedTranslation] = useState<{original: string, translated: string, isLoading: boolean} | null>(null);
  const [dictionaryResult, setDictionaryResult] = useState<(Partial<VocabularyItem> & { isLoading: boolean, isSaved: boolean }) | null>(null);

  // Chat AI States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Mình là trợ lý AI. Bạn có thắc mắc gì về cuốn sách này không?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // State để điều khiển việc cuộn đến ghi chú
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  
  const contentRef = useRef<HTMLDivElement>(null); 

  // Derived Data: Paragraphs toàn bộ sách
  const allParagraphs = useMemo(() => {
    return book.fullText ? book.fullText.split(/\n\s*\n/) : [];
  }, [book.fullText]);

  // Derived Data: Danh sách chương đã sắp xếp
  const chapters = useMemo(() => {
    let rawChapters = book.chapters || [];
    if (rawChapters.length === 0) {
      return [{ title: "Nội dung sách", index: 0 }];
    }
    return [...rawChapters].sort((a, b) => a.index - b.index);
  }, [book.chapters]);

  // Derived Data: Paragraphs của chương hiện tại (Original)
  const currentChapterParagraphs = useMemo(() => {
    if (allParagraphs.length === 0) return [];
    const safeChapterIndex = Math.min(currentChapterIndex, chapters.length - 1);
    const startIdx = chapters[safeChapterIndex]?.index || 0;
    const endIdx = chapters[safeChapterIndex + 1]?.index || allParagraphs.length;
    return allParagraphs.slice(startIdx, endIdx);
  }, [allParagraphs, chapters, currentChapterIndex]);

  // Logic hiển thị nội dung: Gốc hoặc Dịch
  const displayedParagraphs = useMemo(() => {
    if (isTranslatedMode && translationCache[currentChapterIndex]) {
        return translationCache[currentChapterIndex].split(/\n\s*\n/);
    }
    return currentChapterParagraphs;
  }, [isTranslatedMode, translationCache, currentChapterIndex, currentChapterParagraphs]);

  // --- Styles & Effects ---
  const getThemeStyles = () => {
    switch(settings.theme) {
      case 'sepia': return 'bg-[#fbf0d9] text-[#5f4b32]';
      case 'dark': return 'bg-[#1a1a1a] text-[#e5e5e5]';
      default: return 'bg-white text-slate-900';
    }
  };

  const getFontFamily = () => {
    switch(settings.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      case 'bookerly': return 'font-serif font-bookerly';
      default: return 'font-serif';
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSettings && !(e.target as HTMLElement).closest('.settings-panel') && !(e.target as HTMLElement).closest('.settings-btn')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
    if (scrollTarget) {
        const timer = setTimeout(() => {
            const el = document.querySelector(`[id^="highlight-${scrollTarget}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all', 'duration-500');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-indigo-500/50');
                }, 1500);
            }
            setScrollTarget(null);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [scrollTarget, currentChapterIndex]);

  useEffect(() => {
    // Scroll to bottom of chat
    if (sidebarView === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, sidebarView]);

  useEffect(() => {
    // Initialize Chat Session when book changes
    const context = book.summary || book.description || allParagraphs.slice(0, 20).join('\n');
    chatSessionRef.current = createBookChat(book.title, book.author, context);
  }, [book.id]); // Re-create if book ID changes

  useEffect(() => {
    if (book.fullText && (!book.chapters || book.chapters.length === 0) && onUpdateBook) {
      const detectedChapters: Chapter[] = [];
      allParagraphs.forEach((p, index) => {
        const text = p.trim();
        if (text.length < 150 && text.length > 3) {
           const isHeaderPattern = /^(Chapter|Chương|Part|Phần|Mục|Episode)\s+\d+/i.test(text);
           const isAllCaps = text === text.toUpperCase() && /[A-ZÀ-Ỹ]/.test(text) && text.length > 5 && !/[!?.]{2,}/.test(text);
           if (isHeaderPattern || isAllCaps) {
             detectedChapters.push({ title: text, index });
           }
        }
      });
      if (detectedChapters.length === 0) {
        const PARAGRAPHS_PER_CHUNK = 80;
        const total = allParagraphs.length;
        if (total > PARAGRAPHS_PER_CHUNK) {
            const chunkCount = Math.ceil(total / PARAGRAPHS_PER_CHUNK);
            for (let i = 0; i < chunkCount; i++) {
                const start = i * PARAGRAPHS_PER_CHUNK;
                const end = Math.min((i + 1) * PARAGRAPHS_PER_CHUNK, total);
                detectedChapters.push({
                    title: `Phần ${i + 1} (${Math.round((i/chunkCount)*100)}% - ${Math.round(((i+1)/chunkCount)*100)}%)`,
                    index: start
                });
            }
        } else {
             detectedChapters.push({ title: "Nội dung đầy đủ", index: 0 });
        }
      }
      onUpdateBook({ ...book, chapters: detectedChapters });
    }
  }, [book.fullText]);

  useEffect(() => {
    if (viewMode === 'read' && book.progress && book.progress > 0 && chapters.length > 1) {
       const estimatedChapter = Math.floor((book.progress / 100) * chapters.length);
       if (currentChapterIndex === 0 && estimatedChapter > 0) {
           setCurrentChapterIndex(Math.min(estimatedChapter, chapters.length - 1));
       }
    }
  }, [viewMode]);

  // --- Handlers ---
  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(prev => prev + 1);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      updateProgress(currentChapterIndex + 1);
      setIsTranslatedMode(false);
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(prev => prev - 1);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      updateProgress(currentChapterIndex - 1);
      setIsTranslatedMode(false);
    }
  };

  const jumpToChapter = (idx: number) => {
    setCurrentChapterIndex(idx);
    setShowTOC(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    updateProgress(idx);
    setIsTranslatedMode(false);
  };

  const updateProgress = (chapterIdx: number) => {
    if (!onUpdateBook) return;
    const progress = Math.round(((chapterIdx + 1) / chapters.length) * 100);
    onUpdateBook({
      ...book,
      progress,
      lastReadDate: new Date().toISOString(),
      status: progress > 90 ? BookStatus.FINISHED : BookStatus.READING
    });
  };

  // --- Chat Logic ---
  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !chatSessionRef.current) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const result: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'model', text: result.text || "Xin lỗi, mình không trả lời được câu này." }]);
    } catch (error) {
      // Sử dụng hàm handleGeminiError để lấy thông báo lỗi thân thiện
      const errorMsg = handleGeminiError(error, "trả lời tin nhắn");
      setChatMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ... (Translation, Note, Selection handlers) ...
  const handleTranslateChapter = async () => {
      if (isTranslatedMode) {
          setIsTranslatedMode(false);
          return;
      }
      if (translationCache[currentChapterIndex]) {
          setIsTranslatedMode(true);
          return;
      }
      setIsTranslatingChapter(true);
      const textToTranslate = currentChapterParagraphs.join('\n\n');
      const safeText = textToTranslate.substring(0, 15000); 
      const translated = await translateText(safeText);
      setTranslationCache(prev => ({ ...prev, [currentChapterIndex]: translated }));
      setIsTranslatedMode(true);
      setIsTranslatingChapter(false);
  };

  const handleAnalyzeSelection = async () => {
      if (!selectedText) return;
      setSelectionPosition(null); 
      window.getSelection()?.removeAllRanges();
      const wordCount = selectedText.trim().split(/\s+/).length;
      
      if (wordCount <= 3) {
          setSidebarView('dictionary');
          setShowRightSidebar(true);
          setDictionaryResult({ isLoading: true, isSaved: false });
          try {
              let contextSentence = "";
              for (const p of currentChapterParagraphs) {
                  if (p.includes(selectedText)) {
                      contextSentence = p;
                      break;
                  }
              }
              const result = await lookupDictionary(selectedText, contextSentence);
              setDictionaryResult({ ...result, isLoading: false, isSaved: false });
          } catch (e) {
              setDictionaryResult(null);
          }
      } else {
          setSidebarView('translation');
          setShowRightSidebar(true);
          setSelectedTranslation({ original: selectedText, translated: '', isLoading: true });
          const result = await translateText(selectedText);
          setSelectedTranslation(prev => prev ? { ...prev, translated: result, isLoading: false } : null);
      }
  };

  const handleSaveWord = async () => {
      if (!dictionaryResult || !dictionaryResult.word || !book.userId) return;
      const vocabItem: VocabularyItem = {
          id: crypto.randomUUID(),
          userId: book.userId,
          word: dictionaryResult.word!,
          phonetic: dictionaryResult.phonetic || '',
          partOfSpeech: dictionaryResult.partOfSpeech || '',
          meaning: dictionaryResult.meaning || '',
          synonyms: dictionaryResult.synonyms || [],
          exampleOriginal: dictionaryResult.exampleOriginal || '',
          exampleTranslated: dictionaryResult.exampleTranslated || '',
          learnedAt: new Date().toISOString(),
          contextSentence: selectedText 
      };
      try {
          await saveVocabulary(vocabItem);
          setDictionaryResult(prev => prev ? { ...prev, isSaved: true } : null);
      } catch (e) { console.error("Failed to save vocab", e); }
  };

  // Selection & Note helpers
  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!showNoteInput) setSelectionPosition(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 1) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPosition({ top: rect.top - 50, left: rect.left + (rect.width / 2) - 60 });
    setSelectedText(text);
  };

  const addHighlight = (color: Note['color'] = 'yellow') => {
    if (!selectedText || !onUpdateBook) return;
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      color,
      createdAt: new Date().toISOString()
    };
    const updatedNotes = [...(book.notes || []), newNote];
    onUpdateBook({ ...book, notes: updatedNotes });
    setSelectionPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const addNote = () => {
    if (!selectedText || !onUpdateBook || !noteInputValue.trim()) return;
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      content: noteInputValue,
      color: 'blue',
      createdAt: new Date().toISOString()
    };
    const updatedNotes = [...(book.notes || []), newNote];
    onUpdateBook({ ...book, notes: updatedNotes });
    setNoteInputValue('');
    setShowNoteInput(false);
    setSelectionPosition(null);
    window.getSelection()?.removeAllRanges();
    setSidebarView('notes');
    setShowRightSidebar(true);
  };

  const deleteNote = (noteId: string) => {
    if (!onUpdateBook) return;
    const updatedNotes = (book.notes || []).filter(n => n.id !== noteId);
    onUpdateBook({ ...book, notes: updatedNotes });
  };
  
  const handleNoteClick = (note: Note) => {
    let targetChapterIndex = -1;
    for (let i = 0; i < chapters.length; i++) {
        const start = chapters[i].index;
        const end = chapters[i + 1]?.index || allParagraphs.length;
        for (let j = start; j < end; j++) {
            if (allParagraphs[j] && allParagraphs[j].includes(note.text)) {
                targetChapterIndex = i;
                break;
            }
        }
        if (targetChapterIndex !== -1) break;
    }
    if (targetChapterIndex !== -1) {
        if (targetChapterIndex !== currentChapterIndex) {
            setCurrentChapterIndex(targetChapterIndex);
            if (contentRef.current) contentRef.current.scrollTop = 0;
        }
        setScrollTarget(note.id);
        setSidebarView('notes');
        setShowRightSidebar(true);
    }
  };

  const toggleRightSidebar = () => {
      if (showRightSidebar) {
          setShowRightSidebar(false);
      } else {
          setSidebarView('notes');
          setShowRightSidebar(true);
      }
  };
  
  const toggleChatSidebar = () => {
      setSidebarView('chat');
      setShowRightSidebar(true);
  };

  // --- Components ---
  const HighlightedText = ({ text, notes }: { text: string; notes?: Note[] }) => {
    if (isTranslatedMode) return <span>{text}</span>;
    if (!notes || notes.length === 0) return <span>{text}</span>;
    let parts: (string | React.ReactNode)[] = [text];
    notes.forEach(note => {
      const newParts: (string | React.ReactNode)[] = [];
      parts.forEach(part => {
        if (typeof part === 'string') {
          const split = part.split(note.text);
          for (let i = 0; i < split.length; i++) {
            newParts.push(split[i]);
            if (i < split.length - 1) {
              const bgColors = {
                yellow: 'bg-yellow-200 dark:bg-yellow-900/50',
                green: 'bg-green-200 dark:bg-green-900/50',
                blue: 'bg-blue-200 dark:bg-blue-900/50',
                red: 'bg-red-200 dark:bg-red-900/50',
              };
              newParts.push(
                <span 
                  key={`${note.id}-${i}`} 
                  id={`highlight-${note.id}-${i}`}
                  className={`${bgColors[note.color]} px-0.5 rounded cursor-pointer border-b-2 border-transparent hover:border-indigo-500 transition-colors relative group`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarView('notes');
                    setShowRightSidebar(true);
                  }}
                >
                  {note.text}
                  {note.content && (
                     <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                  )}
                </span>
              );
            }
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });
    return <>{parts}</>;
  };

  const renderCurrentChapterContent = () => {
    if (!book.fullText) return <p className="text-center italic text-slate-500 mt-10">Không có dữ liệu văn bản gốc.</p>;
    const containerStyle = { fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight };

    return (
      <div 
        onMouseUp={handleSelection}
        style={containerStyle}
        className={`max-w-3xl mx-auto px-6 py-12 md:py-20 ${getFontFamily()} min-h-[60vh]`}
      >
        <h2 className="text-3xl font-bold mb-8 text-indigo-600 dark:text-indigo-400 font-sans flex items-center gap-3">
          {chapters[currentChapterIndex]?.title}
          {isTranslatedMode && <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Đã dịch</span>}
        </h2>
        {isTranslatingChapter ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-slate-500 animate-pulse">Đang dịch chương này sang Tiếng Việt (Azure)...</p>
            </div>
        ) : (
            displayedParagraphs.map((p, idx) => {
              if (!p.trim()) return null;
              return (
                <p key={idx} className="mb-4 text-justify">
                  <HighlightedText text={p.trim()} notes={book.notes} />
                </p>
              );
            })
        )}
        <div className="flex justify-between items-center mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 font-sans">
            <button onClick={handlePrevChapter} disabled={currentChapterIndex === 0} className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${currentChapterIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'}`}><ChevronLeft className="w-5 h-5" />Chương trước</button>
            <button onClick={handleNextChapter} disabled={currentChapterIndex >= chapters.length - 1} className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${currentChapterIndex >= chapters.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/30'}`}>Chương tiếp<ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    );
  };

  // --- Render ---
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col animate-in slide-in-from-bottom duration-500 overflow-hidden ${viewMode === 'read' ? getThemeStyles() : 'bg-white dark:bg-[#0a0c10]'}`}>
      
      {/* Navbar */}
      <header className={`h-16 shrink-0 px-6 border-b flex items-center justify-between z-10 ${viewMode === 'read' ? (settings.theme === 'dark' ? 'border-gray-800 bg-[#1a1a1a]/90' : settings.theme === 'sepia' ? 'border-[#ede0c5] bg-[#fbf0d9]/90' : 'border-slate-100 bg-white/90') : 'bg-white/80 dark:bg-[#0a0c10]/80 border-slate-100 dark:border-slate-800/50 backdrop-blur-xl'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:opacity-70 rounded-full transition-colors"><ArrowLeft className={`w-5 h-5 ${viewMode === 'read' && settings.theme === 'dark' ? 'text-gray-300' : ''}`} /></button>
          <div className={`hidden md:flex rounded-lg p-1 border ${viewMode === 'read' && settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <button onClick={() => setViewMode('insight')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'insight' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'opacity-60 hover:opacity-100'}`}><Sparkles className="w-3.5 h-3.5" />PHÂN TÍCH</button>
            <button onClick={() => setViewMode('read')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'read' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'opacity-60 hover:opacity-100'}`}><AlignLeft className="w-3.5 h-3.5" />ĐỌC SÁCH</button>
          </div>
        </div>
        {viewMode === 'read' && (
           <div className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer transition-colors ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : settings.theme === 'sepia' ? 'bg-[#f7e8c3] border-[#ede0c5] hover:bg-[#ede0c5]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`} onClick={() => setShowTOC(!showTOC)}>
             <span className="w-2 h-2 rounded-full bg-green-500"></span>
             <span className="text-xs font-bold max-w-[200px] truncate">{chapters[currentChapterIndex]?.title || "Đang đọc"}</span>
             <ChevronRight className="w-3 h-3 opacity-50" />
           </div>
        )}
        <div className="flex items-center gap-2">
          {viewMode === 'read' && (
            <>
              <button onClick={toggleChatSidebar} className={`p-2 rounded-lg transition-colors relative group ${sidebarView === 'chat' && showRightSidebar ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'opacity-60 hover:opacity-100'}`} title="Hỏi AI về sách"><MessageCircleQuestion className="w-5 h-5" /></button>
              <button onClick={handleTranslateChapter} className={`p-2 rounded-lg transition-colors relative group ${isTranslatedMode ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'opacity-60 hover:opacity-100'}`} title={isTranslatedMode ? "Xem bản gốc" : "Dịch chương này"}><Languages className="w-5 h-5" /></button>
              <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg transition-colors relative settings-btn ${showSettings ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'opacity-60 hover:opacity-100'}`} title="Cài đặt hiển thị"><Type className="w-5 h-5" /></button>
              <button onClick={() => setShowTOC(!showTOC)} className={`p-2 rounded-lg transition-colors relative ${showTOC ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'opacity-60 hover:opacity-100'}`} title="Mục lục"><List className="w-5 h-5" /></button>
            </>
          )}
          <button onClick={toggleRightSidebar} className={`p-2 rounded-lg transition-colors relative ${showRightSidebar && sidebarView !== 'chat' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'opacity-60 hover:opacity-100'}`}><Bookmark className="w-5 h-5" />{(book.notes?.length || 0) > 0 && (<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>)}</button>
          <button onClick={onClose} className="ml-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </header>
      
      {/* Settings Panel Popover (Giữ nguyên) */}
      {showSettings && (
        <div className="absolute top-16 right-4 md:right-20 z-50 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 settings-panel animate-in zoom-in-95 duration-200">
           <div className="mb-4">
             <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Màu nền</div>
             <div className="flex gap-2">
               <button onClick={() => setSettings(s => ({...s, theme: 'light'}))} className={`flex-1 py-3 rounded-lg border flex justify-center ${settings.theme === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'}`}><div className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-sm"></div></button>
               <button onClick={() => setSettings(s => ({...s, theme: 'sepia'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-[#fbf0d9] ${settings.theme === 'sepia' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-[#ede0c5] hover:border-[#e3d0a8]'}`}><div className="w-6 h-6 rounded-full bg-[#5f4b32]"></div></button>
               <button onClick={() => setSettings(s => ({...s, theme: 'dark'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-slate-900 ${settings.theme === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'}`}><div className="w-6 h-6 rounded-full bg-slate-700"></div></button>
             </div>
           </div>
           <div className="mb-4">
             <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Kiểu chữ</div>
             <div className="flex flex-col gap-1">
                <button onClick={() => setSettings(s => ({...s, fontFamily: 'bookerly'}))} className={`px-3 py-2 text-left rounded-md text-sm font-serif ${settings.fontFamily === 'bookerly' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Bookerly (Serif)</button>
                <button onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))} className={`px-3 py-2 text-left rounded-md text-sm font-sans ${settings.fontFamily === 'sans' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Inter (Sans-serif)</button>
                <button onClick={() => setSettings(s => ({...s, fontFamily: 'mono'}))} className={`px-3 py-2 text-left rounded-md text-sm font-mono ${settings.fontFamily === 'mono' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Monospace</button>
             </div>
           </div>
           <div>
             <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Cỡ chữ: {settings.fontSize}px</div>
             <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
               <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 1)}))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"><Minus className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
               <div className="flex-grow"><input type="range" min="12" max="32" step="1" value={settings.fontSize} onChange={(e) => setSettings(s => ({...s, fontSize: parseInt(e.target.value)}))} className="w-full h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>
               <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(32, s.fontSize + 1)}))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"><Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
             </div>
           </div>
        </div>
      )}

      {/* Floating Toolbar (Highlight/Note/Translate) - Giữ nguyên */}
      {selectionPosition && viewMode === 'read' && (
        <div className="fixed z-50 flex flex-col items-center selection-toolbar animate-in zoom-in duration-200" style={{ top: selectionPosition.top, left: selectionPosition.left, transform: 'translateX(-50%)' }}>
          {showNoteInput ? (
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 flex gap-2 w-64 note-input">
               <input autoFocus className="flex-grow bg-slate-50 dark:bg-slate-900 border-none outline-none rounded px-2 py-1 text-sm dark:text-white" placeholder="Nhập ghi chú..." value={noteInputValue} onChange={(e) => setNoteInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
               <button onClick={addNote} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check className="w-4 h-4" /></button>
             </div>
          ) : (
            <div className="bg-slate-900 text-white rounded-full shadow-xl flex items-center overflow-hidden py-1 px-2 gap-1.5">
              <button onClick={() => addHighlight('yellow')} className="w-6 h-6 rounded-full bg-yellow-400 hover:scale-110 transition-transform shadow-sm ring-1 ring-white/20" title="Vàng"></button>
              <button onClick={() => addHighlight('green')} className="w-6 h-6 rounded-full bg-green-400 hover:scale-110 transition-transform shadow-sm ring-1 ring-white/20" title="Xanh lá"></button>
              <button onClick={() => addHighlight('blue')} className="w-6 h-6 rounded-full bg-blue-400 hover:scale-110 transition-transform shadow-sm ring-1 ring-white/20" title="Xanh dương"></button>
              <button onClick={() => addHighlight('red')} className="w-6 h-6 rounded-full bg-red-400 hover:scale-110 transition-transform shadow-sm ring-1 ring-white/20" title="Đỏ"></button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button onClick={() => setShowNoteInput(true)} className="p-2 hover:bg-slate-700 rounded-full transition-colors flex items-center gap-1 text-xs font-bold px-3"><MessageSquare className="w-4 h-4" /> Ghi chú</button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button onClick={handleAnalyzeSelection} className="p-2 hover:bg-slate-700 rounded-full transition-colors flex items-center gap-1 text-xs font-bold px-3"><BookA className="w-4 h-4" /> Tra từ / Dịch</button>
            </div>
          )}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 mt-1 opacity-90"></div>
        </div>
      )}
      
      {/* Mobile Tab Switcher */}
      <div className={`md:hidden flex border-b shrink-0 ${viewMode === 'read' && settings.theme === 'dark' ? 'border-gray-800 bg-[#1a1a1a]' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0c10]'}`}>
        <button onClick={() => setViewMode('insight')} className={`flex-1 py-3 text-xs font-bold flex justify-center items-center gap-2 border-b-2 ${viewMode === 'insight' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent opacity-60'}`}><Sparkles className="w-4 h-4" /> PHÂN TÍCH</button>
        <button onClick={() => setViewMode('read')} className={`flex-1 py-3 text-xs font-bold flex justify-center items-center gap-2 border-b-2 ${viewMode === 'read' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent opacity-60'}`}><AlignLeft className="w-4 h-4" /> ĐỌC SÁCH</button>
      </div>
      
      <div className="flex flex-grow overflow-hidden relative">
        {/* Table of Contents (TOC) Sidebar */}
        <div className={`absolute top-0 left-0 bottom-0 w-72 transform transition-transform duration-300 z-30 flex flex-col shadow-2xl ${showTOC ? 'translate-x-0' : '-translate-x-full'} ${settings.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-r`}>
           <div className={`p-4 border-b flex justify-between items-center ${settings.theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <h3 className={`font-bold flex items-center gap-2 ${settings.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}><List className="w-4 h-4 text-indigo-500" />Mục lục</h3>
            <button onClick={() => setShowTOC(false)} className="opacity-50 hover:opacity-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-grow overflow-y-auto p-2">
            {!chapters || chapters.length === 0 ? (
              <div className="text-center p-4 opacity-50 text-sm">Chưa tìm thấy chương nào.</div>
            ) : (
              <ul className="space-y-1">
                {chapters.map((chapter, idx) => (
                  <li key={idx}><button onClick={() => jumpToChapter(idx)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex justify-between items-center group ${idx === currentChapterIndex ? (settings.theme === 'dark' ? 'bg-indigo-900/50 text-white' : 'bg-indigo-50 text-indigo-700') : (settings.theme === 'dark' ? 'text-gray-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-200')}`}><span className="truncate">{chapter.title}</span>{idx === currentChapterIndex && <Check className="w-3 h-3 shrink-0" />}</button></li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div ref={contentRef} className={`flex-grow overflow-y-auto overflow-x-hidden scroll-smooth transition-all duration-300 relative reader-scroll ${showRightSidebar ? 'mr-0 md:mr-80' : ''}`}>
          {viewMode === 'insight' ? (
            <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
                <div className="mb-12 border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div className="inline-block px-3 py-1 bg-indigo-600 text-[10px] font-black text-white uppercase tracking-tighter mb-4">Báo cáo giải phẫu tri thức</div>
                  <h1 className="text-3xl md:text-5xl font-extrabold dark:text-white leading-[1.1] mb-4 tracking-tight">{book.title}</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Tác giả: <span className="text-indigo-500">{book.author}</span></p>
                </div>
                <div className="insight-content dark:text-slate-200 animate-in fade-in duration-500" dangerouslySetInnerHTML={{ __html: book.insightHtml || '<p>Đang chuẩn bị nội dung tri thức...</p>' }} />
            </div>
          ) : (
             renderCurrentChapterContent()
          )}
          <div className="mt-20 pt-10 pb-20 border-t border-slate-100/10 text-center opacity-40 text-xs"><p>© Hyle Reader • Developed by Hyle</p></div>
        </div>

        {/* Progress Bar */}
        {viewMode === 'read' && (
          <div className={`absolute bottom-0 left-0 right-0 h-1 z-40 ${showRightSidebar ? 'mr-0 md:mr-80' : ''} ${settings.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
             <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${book.progress || 0}%` }}></div>
          </div>
        )}

        {/* Right Sidebar */}
        <div className={`absolute top-0 right-0 bottom-0 w-80 border-l transform transition-transform duration-300 z-20 flex flex-col shadow-2xl ${showRightSidebar ? 'translate-x-0' : 'translate-x-full'} ${settings.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`p-4 border-b flex justify-between items-center ${settings.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <h3 className="font-bold flex items-center gap-2">
              {sidebarView === 'notes' ? (
                  <><Bookmark className="w-4 h-4 text-indigo-500" /> Ghi chú ({book.notes?.length || 0})</>
              ) : sidebarView === 'translation' ? (
                  <><Languages className="w-4 h-4 text-indigo-500" /> Dịch thuật</>
              ) : sidebarView === 'chat' ? (
                  <><MessageCircleQuestion className="w-4 h-4 text-indigo-500" /> Hỏi AI về sách</>
              ) : (
                  <><BookA className="w-4 h-4 text-indigo-500" /> Từ điển</>
              )}
            </h3>
            <div className="flex gap-1">
                {sidebarView === 'translation' && (
                     <button onClick={() => setSidebarView('notes')} className="p-1 opacity-50 hover:opacity-100 text-xs font-bold mr-2">Quay lại</button>
                )}
                {/* Dictionary back button logic changed: close sidebar directly */}
                {sidebarView === 'dictionary' && (
                     <button onClick={() => setShowRightSidebar(false)} className="p-1 opacity-50 hover:opacity-100 text-xs font-bold mr-2">Đóng</button>
                )}
                <button onClick={() => setShowRightSidebar(false)} className="opacity-50 hover:opacity-100"><X className="w-5 h-5" /></button>
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 space-y-4 flex flex-col h-full relative">
            {sidebarView === 'notes' && (
                (!book.notes || book.notes.length === 0) ? (
                  <div className="text-center opacity-40 py-10">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Chưa có ghi chú nào.</p>
                  </div>
                ) : (
                  book.notes.map(note => {
                    const textColor = { yellow: 'text-yellow-600 dark:text-yellow-400', green: 'text-green-600 dark:text-green-400', blue: 'text-blue-600 dark:text-blue-400', red: 'text-red-600 dark:text-red-400' }[note.color] || 'text-indigo-600 dark:text-indigo-400';
                    return (
                      <div key={note.id} onClick={() => handleNoteClick(note)} className={`p-3 rounded-lg border shadow-sm group cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${settings.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className={`text-xs uppercase font-bold mb-1 ${textColor}`}>{note.content ? 'Ghi chú' : 'Highlight'}</div>
                        <div className={`text-sm italic mb-2 pl-2 border-l-2 ${settings.theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-slate-600 border-slate-200'}`}>"{note.text}"</div>
                        {note.content && <div className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{note.content}</div>}
                        <div className="mt-2 pt-2 border-t border-slate-100/10 flex justify-between items-center"><span className="text-[10px] opacity-40">{new Date(note.createdAt).toLocaleDateString()}</span><button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="p-1 opacity-40 hover:opacity-100 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button></div>
                      </div>
                    );
                  })
                )
            )}

            {sidebarView === 'translation' && (
                <div className="space-y-4">
                    {selectedTranslation ? (
                        <>
                            <div className={`p-4 rounded-lg ${settings.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <h4 className="text-xs font-bold uppercase opacity-50 mb-2">Văn bản gốc</h4>
                                <p className="text-sm italic font-serif leading-relaxed opacity-80">"{selectedTranslation.original}"</p>
                            </div>
                            <div className="flex justify-center"><ArrowRight className="w-4 h-4 opacity-30 transform rotate-90" /></div>
                            <div className={`p-4 rounded-lg border ${settings.theme === 'dark' ? 'bg-indigo-900/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                                <h4 className="text-xs font-bold uppercase text-indigo-500 mb-2 flex items-center gap-2">Tiếng Việt {selectedTranslation.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}</h4>
                                {selectedTranslation.isLoading ? (
                                    <div className="space-y-2"><div className="h-2 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse w-full"></div><div className="h-2 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse w-3/4"></div></div>
                                ) : (
                                    <p className="text-sm leading-relaxed">{selectedTranslation.translated}</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center opacity-40 py-10"><Languages className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Chọn văn bản để dịch</p></div>
                    )}
                </div>
            )}

            {sidebarView === 'dictionary' && (
                <div className="space-y-4">
                     {dictionaryResult ? (
                         dictionaryResult.isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <p className="text-xs text-slate-400">Đang tra cứu từ điển...</p>
                            </div>
                         ) : (
                            <div className={`rounded-xl overflow-hidden border ${settings.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-900/10">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-2xl font-bold font-serif text-indigo-700 dark:text-indigo-400">{dictionaryResult.word}</h3>
                                        {/* Removed playPronunciation button */}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">/{dictionaryResult.phonetic}/</span>
                                        <span className="italic">{dictionaryResult.partOfSpeech}</span>
                                    </div>
                                </div>
                                
                                <div className="p-4 space-y-4">
                                    <div>
                                        <h4 className="text-xs font-bold uppercase opacity-50 mb-1">Định nghĩa</h4>
                                        <p className="font-medium text-lg">{dictionaryResult.meaning}</p>
                                    </div>

                                    {dictionaryResult.synonyms && dictionaryResult.synonyms.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold uppercase opacity-50 mb-1">Đồng nghĩa</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {dictionaryResult.synonyms.slice(0, 3).map(syn => (
                                                    <span key={syn} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{syn}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase opacity-50 mb-2">Ví dụ</h4>
                                        <p className="text-sm italic mb-1">"{dictionaryResult.exampleOriginal}"</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{dictionaryResult.exampleTranslated}</p>
                                    </div>

                                    <button 
                                        onClick={handleSaveWord}
                                        disabled={dictionaryResult.isSaved}
                                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${dictionaryResult.isSaved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'}`}
                                    >
                                        {dictionaryResult.isSaved ? <><Check className="w-4 h-4" /> Đã lưu</> : <><Save className="w-4 h-4" /> Lưu vào kho từ</>}
                                    </button>
                                </div>
                            </div>
                         )
                     ) : (
                        <div className="text-center opacity-40 py-10"><BookA className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Chọn một từ để tra cứu</p></div>
                     )}
                </div>
            )}

            {sidebarView === 'chat' && (
              <div className="flex flex-col h-full absolute inset-0 pt-16 pb-0">
                  <div className="flex-grow overflow-y-auto p-4 space-y-4">
                     {chatMessages.map((msg, index) => (
                       <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-indigo-600'}`}>
                             {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                          </div>
                          <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed ${
                            msg.role === 'user' 
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-sm' 
                              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 rounded-tl-sm border border-indigo-100 dark:border-indigo-800'
                          }`}>
                             {msg.text}
                          </div>
                       </div>
                     ))}
                     {isChatLoading && (
                       <div className="flex gap-3">
                          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                             <Bot className="w-4 h-4 text-white" />
                          </div>
                          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 rounded-tl-sm flex items-center gap-1">
                             <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                             <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                             <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                          </div>
                       </div>
                     )}
                     <div ref={chatEndRef}></div>
                  </div>
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                     <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <input 
                           value={chatInput}
                           onChange={(e) => setChatInput(e.target.value)}
                           placeholder="Hỏi về sách..."
                           className="flex-grow px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                        <button 
                           type="submit" 
                           disabled={!chatInput.trim() || isChatLoading}
                           className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           <Send className="w-4 h-4" />
                        </button>
                     </form>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
