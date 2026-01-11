
import React from 'react';
import { Bookmark, MessageSquare, Trash2, Languages, Loader2, ArrowRight, BookA, Check, Save, Volume2 } from 'lucide-react';
import { Book, Note, VocabularyItem, ReaderSettings } from '../../../types';

type SidebarView = 'notes' | 'translation' | 'dictionary' | 'chat';

interface SidebarContentProps {
  view: SidebarView;
  book: Book;
  settings: ReaderSettings;
  handleNoteClick: (note: Note) => void;
  deleteNote: (id: string) => void;
  selectedTranslation: { original: string, translated: string, isLoading: boolean } | null;
  dictionaryResult: (Partial<VocabularyItem> & { isLoading: boolean, isSaved: boolean }) | null;
  handleSaveWord: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ 
    view, book, settings, handleNoteClick, deleteNote, selectedTranslation, dictionaryResult, handleSaveWord 
}) => {
  const isDark = settings.theme === 'dark';
  const isSepia = settings.theme === 'sepia';
  
  const cardBg = isDark ? 'bg-[#1e1e1e] border-slate-700' : isSepia ? 'bg-[#fbf0d9] border-[#e0d0b0]' : 'bg-white border-slate-100';
  const textMain = isDark ? 'text-white' : isSepia ? 'text-[#433422]' : 'text-slate-800';
  const textSub = isDark ? 'text-slate-400' : isSepia ? 'text-[#7a6a55]' : 'text-slate-600';
  const border = isDark ? 'border-slate-700' : isSepia ? 'border-[#e0d0b0]' : 'border-slate-200';

  if (view === 'notes') {
    if (!book.notes || book.notes.length === 0) {
        return (
            <div className="text-center opacity-40 py-10">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Chưa có ghi chú nào.</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            {book.notes.map(note => {
                const textColor = { 
                    yellow: isDark ? 'text-yellow-400' : 'text-yellow-600', 
                    green: isDark ? 'text-green-400' : 'text-green-600', 
                    blue: isDark ? 'text-blue-400' : 'text-blue-600', 
                    red: isDark ? 'text-red-400' : 'text-red-600' 
                }[note.color] || (isDark ? 'text-indigo-400' : 'text-indigo-600');
                
                return (
                <div key={note.id} onClick={() => handleNoteClick(note)} className={`p-3 rounded-lg border shadow-sm group cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${cardBg}`}>
                    <div className={`text-xs uppercase font-bold mb-1 ${textColor}`}>{note.content ? 'Ghi chú' : 'Highlight'}</div>
                    <div className={`text-sm italic mb-2 pl-2 border-l-2 ${isDark ? 'text-gray-300 border-gray-600' : isSepia ? 'text-[#5f4b32] border-[#c0b090]' : 'text-slate-600 border-slate-200'}`}>"{note.text}"</div>
                    {note.content && <div className={`text-sm font-medium ${textMain}`}>{note.content}</div>}
                    <div className={`mt-2 pt-2 border-t flex justify-between items-center ${isDark ? 'border-slate-700' : isSepia ? 'border-[#e0d0b0]' : 'border-slate-100'}`}>
                        <span className="text-[10px] opacity-40">{new Date(note.createdAt).toLocaleDateString()}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="p-1 opacity-40 hover:opacity-100 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                </div>
                );
            })}
        </div>
    );
  }

  if (view === 'translation') {
      return (
        <div className="space-y-4">
            {selectedTranslation ? (
                <>
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800 text-slate-300' : isSepia ? 'bg-[#f0e6d2] text-[#5f4b32]' : 'bg-slate-100 text-slate-700'}`}>
                        <h4 className="text-xs font-bold uppercase opacity-50 mb-2">Văn bản gốc</h4>
                        <p className="text-sm italic font-serif leading-relaxed opacity-80">"{selectedTranslation.original}"</p>
                    </div>
                    <div className="flex justify-center"><ArrowRight className="w-4 h-4 opacity-30 transform rotate-90" /></div>
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-indigo-900/20 border-indigo-900/50 text-indigo-100' : isSepia ? 'bg-[#e8d8b9] border-[#d0c0a0] text-[#433422]' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
                        <h4 className="text-xs font-bold uppercase text-indigo-500 mb-2 flex items-center gap-2">Tiếng Việt {selectedTranslation.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}</h4>
                        {selectedTranslation.isLoading ? (
                            <div className="space-y-2">
                                <div className={`h-2 rounded animate-pulse w-full ${isDark ? 'bg-indigo-800' : 'bg-indigo-200'}`}></div>
                                <div className={`h-2 rounded animate-pulse w-3/4 ${isDark ? 'bg-indigo-800' : 'bg-indigo-200'}`}></div>
                            </div>
                        ) : (
                            <p className="text-sm leading-relaxed">{selectedTranslation.translated}</p>
                        )}
                    </div>
                </>
            ) : (
                <div className="text-center opacity-40 py-10"><Languages className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Chọn văn bản để dịch</p></div>
            )}
        </div>
      );
  }

  if (view === 'dictionary') {
      return (
        <div className="space-y-4">
                {dictionaryResult ? (
                    dictionaryResult.isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-xs text-slate-400">Đang tra cứu từ điển...</p>
                    </div>
                    ) : (
                    <div className={`rounded-xl overflow-hidden border ${cardBg}`}>
                        <div className={`p-4 border-b ${border} ${isDark ? 'bg-indigo-900/10' : isSepia ? 'bg-[#e8d8b9]' : 'bg-indigo-50/50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className={`text-2xl font-bold font-serif ${isDark ? 'text-indigo-400' : isSepia ? 'text-indigo-800' : 'text-indigo-700'}`}>{dictionaryResult.word}</h3>
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${textSub}`}>
                                <span className={`font-mono px-1.5 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700' : isSepia ? 'bg-[#dcc59a]' : 'bg-slate-200'}`}>/{dictionaryResult.phonetic}/</span>
                                <span className="italic">{dictionaryResult.partOfSpeech}</span>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-4">
                            <div>
                                <h4 className="text-xs font-bold uppercase opacity-50 mb-1">Định nghĩa</h4>
                                <p className={`font-medium text-lg ${textMain}`}>{dictionaryResult.meaning}</p>
                            </div>

                            {dictionaryResult.synonyms && dictionaryResult.synonyms.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase opacity-50 mb-1">Đồng nghĩa</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {dictionaryResult.synonyms.slice(0, 3).map(syn => (
                                            <span key={syn} className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-300' : isSepia ? 'bg-[#e8d8b9] text-[#5f4b32]' : 'bg-slate-100 text-slate-600'}`}>{syn}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={`p-3 rounded-lg border ${border} ${isDark ? 'bg-slate-700/30' : isSepia ? 'bg-[#f0e6d2]' : 'bg-slate-50'}`}>
                                <h4 className="text-xs font-bold uppercase opacity-50 mb-2">Ví dụ</h4>
                                <p className="text-sm italic mb-1">"{dictionaryResult.exampleOriginal}"</p>
                                <p className={`text-sm ${textSub}`}>{dictionaryResult.exampleTranslated}</p>
                            </div>

                            <button 
                                onClick={handleSaveWord}
                                disabled={dictionaryResult.isSaved}
                                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                                    dictionaryResult.isSaved 
                                    ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700') 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
                                }`}
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
      );
  }

  return null;
};

export default SidebarContent;
