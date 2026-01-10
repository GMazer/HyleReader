
import React, { useState, useMemo } from 'react';
import { Search, Brain, Trash2, Volume2, GraduationCap } from 'lucide-react';
import { VocabularyItem } from '../../types';
import QuizModal from './components/QuizModal';

interface VocabularyViewProps {
  vocabList: VocabularyItem[];
  isLoading: boolean;
  onDeleteVocab: (id: string) => void;
}

const VocabularyView: React.FC<VocabularyViewProps> = ({ vocabList, isLoading, onDeleteVocab }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuiz, setShowQuiz] = useState(false);

  const filteredVocab = useMemo(() => {
    return vocabList.filter(v => v.word.toLowerCase().includes(searchTerm.toLowerCase()) || v.meaning.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [vocabList, searchTerm]);

  const playPronunciation = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const engVoice = voices.find(v => v.lang.startsWith('en'));
    if (engVoice) utterance.voice = engVoice;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Kho từ vựng</h1>
          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">{vocabList.length} từ đã học • Ôn tập mỗi ngày</p>
        </div>
        <button 
           onClick={() => setShowQuiz(true)} 
           disabled={vocabList.length < 4}
           className="flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
           <Brain className="w-5 h-5" /> Ôn tập ngay (Trắc nghiệm)
        </button>
      </div>
      
      <div className="relative mb-8 max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tra cứu trong từ điển cá nhân..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white shadow-sm" 
          />
      </div>

      {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>)}
          </div>
      ) : filteredVocab.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVocab.map(item => (
                  <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 relative group hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300">
                      <button onClick={() => onDeleteVocab(item.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                      
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-bold font-serif text-slate-900 dark:text-white">{item.word}</h3>
                              <button onClick={() => playPronunciation(item.word)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition-colors"><Volume2 className="w-4 h-4" /></button>
                          </div>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{item.partOfSpeech}</span>
                      </div>
                      <div className="text-sm font-mono text-slate-500 dark:text-slate-400 mb-4">/{item.phonetic}/</div>
                      
                      <div className="mb-4">
                          <p className="font-medium text-lg text-slate-800 dark:text-slate-200">{item.meaning}</p>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm border border-slate-100 dark:border-slate-800">
                          <p className="italic text-slate-600 dark:text-slate-400 mb-1">"{item.exampleOriginal}"</p>
                          <p className="text-slate-400 dark:text-slate-500 text-xs">{item.exampleTranslated}</p>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex justify-between">
                          <span>Học ngày: {new Date(item.learnedAt).toLocaleDateString()}</span>
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="text-center py-20 opacity-50">
              <GraduationCap className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>Chưa có từ vựng nào trong kho.</p>
              <p className="text-sm mt-2">Hãy đọc sách và lưu lại những từ mới nhé!</p>
          </div>
      )}

      {showQuiz && <QuizModal vocabList={vocabList} onClose={() => setShowQuiz(false)} />}
    </div>
  );
};

export default VocabularyView;
