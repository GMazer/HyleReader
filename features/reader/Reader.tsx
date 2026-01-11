
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Bookmark, ArrowLeft, Sparkles, AlignLeft, MessageSquare, List, ChevronRight, ChevronLeft, Type, Languages, Loader2, BookA, MessageCircleQuestion } from 'lucide-react';
import { Book, Note, Chapter, BookStatus, ReaderSettings, VocabularyItem } from '../../types';
import { translateText, lookupDictionary } from '../../geminiService';
import { saveVocabulary } from '../../db';

// Sub-components
import ReaderSettingsPanel from './components/ReaderSettings';
import ChatPanel from './components/ChatPanel';
import SidebarContent from './components/SidebarContent';
import { Check } from 'lucide-react';

interface ReaderProps {
  book: Book;
  onClose: () => void;
  onUpdateBook?: (book: Book) => void;
}

type ViewMode = 'insight' | 'read';
type SidebarView = 'notes' | 'translation' | 'dictionary' | 'chat';

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

  // Scroll target for notes
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null); 

  // Derived Data
  const allParagraphs = useMemo(() => book.fullText ? book.fullText.split(/\n\s*\n/) : [], [book.fullText]);

  const chapters = useMemo(() => {
    let rawChapters = book.chapters || [];
    if (rawChapters.length === 0) return [{ title: "Nội dung sách", index: 0 }];
    return [...rawChapters].sort((a, b) => a.index - b.index);
  }, [book.chapters]);

  const currentChapterParagraphs = useMemo(() => {
    if (allParagraphs.length === 0) return [];
    const safeChapterIndex = Math.min(currentChapterIndex, chapters.length - 1);
    const startIdx = chapters[safeChapterIndex]?.index || 0;
    const endIdx = chapters[safeChapterIndex + 1]?.index || allParagraphs.length;
    return allParagraphs.slice(startIdx, endIdx);
  }, [allParagraphs, chapters, currentChapterIndex]);

  const displayedParagraphs = useMemo(() => {
    if (isTranslatedMode && translationCache[currentChapterIndex]) {
        return translationCache[currentChapterIndex].split(/\n\s*\n/);
    }
    return currentChapterParagraphs;
  }, [isTranslatedMode, translationCache, currentChapterIndex, currentChapterParagraphs]);

  // Styles & Effects
  const getThemeStyles = () => {
    switch(settings.theme) {
      case 'sepia': return 'bg-[#fbf0d9] text-[#433422]'; // Darker text for sepia
      case 'dark': return 'bg-[#1a1a1a] text-[#e5e5e5]';
      default: return 'bg-white text-slate-900';
    }
  };

  const getSidebarThemeStyles = () => {
    switch(settings.theme) {
      case 'sepia': return 'bg-[#f7e8c3] border-[#ede0c5] text-[#433422]';
      case 'dark': return 'bg-[#0f0f0f] border-slate-800 text-[#e5e5e5]';
      default: return 'bg-white border-slate-200 text-slate-900';
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
                setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500/50'), 1500);
            }
            setScrollTarget(null);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [scrollTarget, currentChapterIndex]);

  useEffect(() => {
    if (book.fullText && (!book.chapters || book.chapters.length === 0) && onUpdateBook) {
      const detectedChapters: Chapter[] = [];
      // ... logic detect chapters ...
      detectedChapters.push({ title: "Nội dung đầy đủ", index: 0 });
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

  // Handlers
  const handleNavChapter = (direction: 'next' | 'prev') => {
    const newIndex = direction === 'next' ? currentChapterIndex + 1 : currentChapterIndex - 1;
    if (newIndex >= 0 && newIndex < chapters.length) {
      setCurrentChapterIndex(newIndex);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      updateProgress(newIndex);
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
    onUpdateBook({ ...book, progress, lastReadDate: new Date().toISOString(), status: progress > 90 ? BookStatus.FINISHED : BookStatus.READING });
  };

  // Translation & Dictionary
  const handleTranslateChapter = async () => {
      if (isTranslatedMode) return setIsTranslatedMode(false);
      if (translationCache[currentChapterIndex]) return setIsTranslatedMode(true);
      
      setIsTranslatingChapter(true);
      const translated = await translateText(currentChapterParagraphs.join('\n\n').substring(0, 15000));
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
              const context = currentChapterParagraphs.find(p => p.includes(selectedText)) || "";
              const result = await lookupDictionary(selectedText, context);
              setDictionaryResult({ ...result, isLoading: false, isSaved: false });
          } catch (e) { setDictionaryResult(null); }
      } else {
          setSidebarView('translation');
          setShowRightSidebar(true);
          setSelectedTranslation({ original: selectedText, translated: '', isLoading: true });
          const result = await translateText(selectedText);
          setSelectedTranslation(prev => prev ? { ...prev, translated: result, isLoading: false } : null);
      }
  };

  const handleSaveWord = async () => {
      if (!dictionaryResult?.word || !book.userId) return;
      await saveVocabulary({
          id: crypto.randomUUID(), userId: book.userId, word: dictionaryResult.word!,
          phonetic: dictionaryResult.phonetic || '', partOfSpeech: dictionaryResult.partOfSpeech || '',
          meaning: dictionaryResult.meaning || '', synonyms: dictionaryResult.synonyms || [],
          exampleOriginal: dictionaryResult.exampleOriginal || '', exampleTranslated: dictionaryResult.exampleTranslated || '',
          learnedAt: new Date().toISOString(), contextSentence: selectedText 
      });
      setDictionaryResult(prev => prev ? { ...prev, isSaved: true } : null);
  };

  // Selection & Notes
  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!showNoteInput) setSelectionPosition(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSelectionPosition({ top: rect.top - 50, left: rect.left + (rect.width / 2) - 60 });
    setSelectedText(selection.toString().trim());
  };

  const addNote = (content: string = '') => {
    if (!selectedText || !onUpdateBook) return;
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9), text: selectedText, content, color: content ? 'blue' : 'yellow', createdAt: new Date().toISOString()
    };
    onUpdateBook({ ...book, notes: [...(book.notes || []), newNote] });
    setShowNoteInput(false); setNoteInputValue(''); setSelectionPosition(null); window.getSelection()?.removeAllRanges();
    if (content) { setSidebarView('notes'); setShowRightSidebar(true); }
  };

  const deleteNote = (noteId: string) => {
    if (onUpdateBook) onUpdateBook({ ...book, notes: (book.notes || []).filter(n => n.id !== noteId) });
  };
  
  const handleNoteClick = (note: Note) => {
    setSidebarView('notes');
    setShowRightSidebar(true);
  };

  const HighlightedText = ({ text, notes }: { text: string; notes?: Note[] }) => {
    if (isTranslatedMode || !notes?.length) return <span>{text}</span>;
    return <span>{text}</span>; 
  };

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col animate-in slide-in-from-bottom duration-500 overflow-hidden ${getThemeStyles()}`}>
      
      {/* Navbar */}
      <header className={`h-16 shrink-0 px-6 border-b flex items-center justify-between z-10 transition-colors ${
          settings.theme === 'dark' ? 'border-slate-800 bg-[#1a1a1a]/90' : 
          settings.theme === 'sepia' ? 'border-[#ede0c5] bg-[#fbf0d9]/90' : 
          'border-slate-100 bg-white/90'
      }`}>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:opacity-70 rounded-full transition-colors"><ArrowLeft className={`w-5 h-5 ${settings.theme === 'dark' ? 'text-gray-300' : ''}`} /></button>
          <div className={`hidden md:flex rounded-lg p-1 border ${
              settings.theme === 'dark' ? 'bg-[#0f0f0f] border-slate-700' : 
              settings.theme === 'sepia' ? 'bg-[#f7e8c3] border-[#ede0c5]' :
              'bg-slate-100 border-slate-200'
          }`}>
            <button onClick={() => setViewMode('insight')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'insight' ? (settings.theme === 'dark' ? 'bg-slate-800 text-indigo-400' : settings.theme === 'sepia' ? 'bg-[#fbf0d9] text-indigo-700' : 'bg-white text-indigo-600') + ' shadow-sm' : 'opacity-60 hover:opacity-100'}`}><Sparkles className="inline w-3.5 h-3.5 mr-2"/>PHÂN TÍCH</button>
            <button onClick={() => setViewMode('read')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'read' ? (settings.theme === 'dark' ? 'bg-slate-800 text-indigo-400' : settings.theme === 'sepia' ? 'bg-[#fbf0d9] text-indigo-700' : 'bg-white text-indigo-600') + ' shadow-sm' : 'opacity-60 hover:opacity-100'}`}><AlignLeft className="inline w-3.5 h-3.5 mr-2"/>ĐỌC SÁCH</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <>
              <button onClick={() => { setSidebarView('chat'); setShowRightSidebar(true); }} className="p-2 rounded-lg opacity-60 hover:opacity-100" title="Hỏi AI"><MessageCircleQuestion className="w-5 h-5" /></button>
              {viewMode === 'read' && (
                  <>
                  <button onClick={handleTranslateChapter} className={`p-2 rounded-lg ${isTranslatedMode ? (settings.theme === 'dark' ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : 'opacity-60 hover:opacity-100'}`}><Languages className="w-5 h-5" /></button>
                  <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg opacity-60 hover:opacity-100 settings-btn"><Type className="w-5 h-5" /></button>
                  <button onClick={() => setShowTOC(!showTOC)} className="p-2 rounded-lg opacity-60 hover:opacity-100"><List className="w-5 h-5" /></button>
                  </>
              )}
            </>
          <button onClick={() => { setSidebarView('notes'); setShowRightSidebar(!showRightSidebar); }} className="p-2 rounded-lg opacity-60 hover:opacity-100"><Bookmark className="w-5 h-5" /></button>
        </div>
      </header>
      
      {showSettings && <ReaderSettingsPanel settings={settings} setSettings={setSettings} />}

      {/* Content Area */}
      <div className="flex flex-grow overflow-hidden relative">
        {/* TOC Sidebar */}
        <div className={`absolute top-0 left-0 bottom-0 w-72 transform transition-transform duration-300 z-30 flex flex-col shadow-2xl ${showTOC ? 'translate-x-0' : '-translate-x-full'} border-r ${getSidebarThemeStyles()}`}>
           <div className={`p-4 border-b flex justify-between items-center ${settings.theme === 'dark' ? 'border-slate-800' : settings.theme === 'sepia' ? 'border-[#ede0c5]' : 'border-slate-200'}`}><h3 className="font-bold flex gap-2"><List className="w-4 h-4" />Mục lục</h3><button onClick={() => setShowTOC(false)}><X className="w-5 h-5" /></button></div>
           <div className="flex-grow overflow-y-auto p-2">
              <ul className="space-y-1">
                {chapters.map((chapter, idx) => (
                  <li key={idx}><button onClick={() => jumpToChapter(idx)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex justify-between ${idx === currentChapterIndex ? (settings.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : settings.theme === 'sepia' ? 'bg-[#e8d8b9] text-indigo-800' : 'bg-indigo-50 text-indigo-700') : (settings.theme === 'dark' ? 'hover:bg-slate-800' : settings.theme === 'sepia' ? 'hover:bg-[#e8d8b9]/50' : 'hover:bg-slate-100')}`}><span className="truncate">{chapter.title}</span>{idx === currentChapterIndex && <Check className="w-3 h-3" />}</button></li>
                ))}
              </ul>
           </div>
        </div>

        {/* Main Text */}
        <div ref={contentRef} className={`flex-grow overflow-y-auto scroll-smooth transition-all duration-300 relative reader-scroll ${showRightSidebar ? 'mr-0 md:mr-80' : ''}`}>
          {viewMode === 'insight' ? (
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className={`mb-12 border-b pb-8 ${settings.theme === 'dark' ? 'border-slate-800' : settings.theme === 'sepia' ? 'border-[#ede0c5]' : 'border-slate-100'}`}>
                    <h1 className="text-3xl font-extrabold mb-4">{book.title}</h1>
                    <p className={`text-lg ${settings.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Tác giả: <span className="text-indigo-500">{book.author}</span></p>
                </div>
                {/* Style wrapper for Insight HTML to force consistent coloring */}
                <div 
                    className={`insight-content ${settings.theme === 'dark' ? '[&>blockquote]:text-slate-400 [&>h2]:text-indigo-400' : settings.theme === 'sepia' ? '[&>blockquote]:text-[#7e6445] [&>h2]:text-indigo-700' : '[&>blockquote]:text-slate-500'}`} 
                    dangerouslySetInnerHTML={{ __html: book.insightHtml || '<p>Đang tải...</p>' }} 
                />
            </div>
          ) : (
            <div onMouseUp={handleSelection} style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }} className={`max-w-3xl mx-auto px-6 py-12 ${getFontFamily()} min-h-[60vh]`}>
                <h2 className={`text-3xl font-bold mb-8 ${settings.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>{chapters[currentChapterIndex]?.title}</h2>
                {isTranslatingChapter ? <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500" /><p>Đang dịch...</p></div> : 
                    displayedParagraphs.map((p, idx) => p.trim() && <p key={idx} className="mb-4 text-justify"><HighlightedText text={p.trim()} notes={book.notes} /></p>)
                }
                <div className={`flex justify-between mt-16 pt-8 border-t ${settings.theme === 'dark' ? 'border-slate-800' : settings.theme === 'sepia' ? 'border-[#ede0c5]' : 'border-slate-200'}`}>
                    <button onClick={() => handleNavChapter('prev')} disabled={currentChapterIndex === 0} className={`flex gap-2 px-4 py-3 rounded-xl disabled:opacity-30 ${settings.theme === 'dark' ? 'hover:bg-slate-800' : settings.theme === 'sepia' ? 'hover:bg-[#e8d8b9]' : 'hover:bg-slate-100'}`}><ChevronLeft /> Chương trước</button>
                    <button onClick={() => handleNavChapter('next')} disabled={currentChapterIndex >= chapters.length - 1} className="flex gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30">Chương tiếp <ChevronRight /></button>
                </div>
            </div>
          )}
        </div>

        {/* Selection Toolbar */}
        {selectionPosition && viewMode === 'read' && !showNoteInput && (
            <div className="fixed z-50 bg-slate-900 text-white rounded-full shadow-xl flex items-center p-1 gap-2" style={{ top: selectionPosition.top, left: selectionPosition.left, transform: 'translateX(-50%)' }}>
               <button onClick={() => addNote('')} className="w-6 h-6 bg-yellow-400 rounded-full hover:scale-110" />
               <button onClick={() => setShowNoteInput(true)} className="px-3 py-1 hover:bg-slate-700 rounded-full text-xs font-bold flex gap-1"><MessageSquare className="w-4 h-4"/> Ghi chú</button>
               <button onClick={handleAnalyzeSelection} className="px-3 py-1 hover:bg-slate-700 rounded-full text-xs font-bold flex gap-1"><BookA className="w-4 h-4"/> Dịch / Tra từ</button>
            </div>
        )}
        {showNoteInput && selectionPosition && (
            <div className="fixed z-50 bg-white p-2 rounded-xl shadow-xl border flex gap-2" style={{ top: selectionPosition.top, left: selectionPosition.left, transform: 'translateX(-50%)' }}>
                <input autoFocus className="border rounded px-2 text-slate-900" placeholder="Nhập ghi chú..." value={noteInputValue} onChange={e => setNoteInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote(noteInputValue)} />
                <button onClick={() => addNote(noteInputValue)} className="bg-indigo-600 text-white p-1 rounded"><Check className="w-4 h-4"/></button>
            </div>
        )}

        {/* Right Sidebar */}
        <div className={`absolute top-0 right-0 bottom-0 w-80 border-l transform transition-transform duration-300 z-20 flex flex-col shadow-2xl ${showRightSidebar ? 'translate-x-0' : 'translate-x-full'} ${getSidebarThemeStyles()}`}>
          <div className={`p-4 border-b flex justify-between items-center ${settings.theme === 'dark' ? 'border-slate-800' : settings.theme === 'sepia' ? 'border-[#ede0c5]' : 'border-slate-200'}`}>
            <h3 className="font-bold flex items-center gap-2">
              {sidebarView === 'chat' ? 'Hỏi AI' : sidebarView === 'translation' ? 'Dịch thuật' : sidebarView === 'dictionary' ? 'Từ điển' : 'Ghi chú'}
            </h3>
            <button onClick={() => setShowRightSidebar(false)}><X className="w-5 h-5 opacity-50 hover:opacity-100" /></button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 relative h-full">
            {sidebarView === 'chat' ? (
                <ChatPanel book={book} allParagraphs={allParagraphs} theme={settings.theme} />
            ) : (
                <SidebarContent 
                    view={sidebarView} book={book} settings={settings}
                    handleNoteClick={handleNoteClick} deleteNote={deleteNote}
                    selectedTranslation={selectedTranslation} dictionaryResult={dictionaryResult} handleSaveWord={handleSaveWord}
                />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
