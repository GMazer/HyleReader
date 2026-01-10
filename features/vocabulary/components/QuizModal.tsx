
import React, { useState, useEffect } from 'react';
import { X, Trophy, Brain, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { VocabularyItem } from '../../../types';

interface QuizQuestion {
  id: string;
  word: string;
  correctMeaning: string;
  options: string[];
  userAnswer?: string;
  isCorrect?: boolean;
}

interface QuizModalProps {
  vocabList: VocabularyItem[];
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ vocabList, onClose }) => {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    generateQuiz();
  }, []);

  const generateQuiz = () => {
    // 1. Nhóm từ vựng theo ngày để ưu tiên (hoặc lấy 10 từ mới nhất)
    const recentVocab = vocabList.slice(0, 10);
    const questions: QuizQuestion[] = [];
    const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

    recentVocab.forEach(targetItem => {
      // Lấy 3 từ khác làm đáp án sai
      const otherItems = vocabList.filter(i => i.id !== targetItem.id);
      const distractors = shuffle(otherItems).slice(0, 3).map(i => i.meaning);
      const options = shuffle([targetItem.meaning, ...distractors]);

      questions.push({
        id: targetItem.id,
        word: targetItem.word,
        correctMeaning: targetItem.meaning,
        options: options
      });
    });

    setQuizQuestions(shuffle(questions));
    setCurrentQuestionIndex(0);
    setShowResult(false);
  };

  const handleAnswer = (answer: string) => {
    const updatedQuestions = [...quizQuestions];
    const currentQ = updatedQuestions[currentQuestionIndex];
    currentQ.userAnswer = answer;
    currentQ.isCorrect = answer === currentQ.correctMeaning;
    setQuizQuestions(updatedQuestions);

    setTimeout(() => {
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setShowResult(true);
      }
    }, 1000);
  };

  const calculateScore = () => {
    const correct = quizQuestions.filter(q => q.isCorrect).length;
    return Math.round((correct / quizQuestions.length) * 100);
  };

  if (quizQuestions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-300">
       <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white"><X className="w-8 h-8" /></button>
       
       <div className="w-full max-w-2xl">
          {showResult ? (
              <div className="text-center animate-in zoom-in duration-300 bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-2xl border border-slate-700">
                  {calculateScore() === 100 ? (
                      <>
                         <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/50">
                             <Trophy className="w-12 h-12 text-white animate-bounce" />
                         </div>
                         <h2 className="text-4xl font-extrabold text-green-500 mb-2">ĐẠT!</h2>
                         <p className="text-xl text-slate-400 mb-8">Xuất sắc! Bạn đã trả lời đúng tất cả các câu hỏi.</p>
                      </>
                  ) : (
                      <>
                         <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/50">
                             <Brain className="w-12 h-12 text-white" />
                         </div>
                         <h2 className="text-4xl font-extrabold text-orange-500 mb-2">{calculateScore()}%</h2>
                         <p className="text-xl text-slate-400 mb-8">Hãy cố gắng ôn tập thêm nhé!</p>
                      </>
                  )}
                  
                  <button onClick={generateQuiz} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105">
                     <RefreshCw className="w-5 h-5" /> Ôn tập lại
                  </button>
              </div>
          ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
                  <div className="h-2 bg-slate-700 w-full">
                      <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}></div>
                  </div>
                  
                  <div className="p-8 md:p-12 text-center">
                      <span className="inline-block px-3 py-1 bg-slate-700 rounded-full text-xs font-bold text-slate-300 mb-6">Câu hỏi {currentQuestionIndex + 1} / {quizQuestions.length}</span>
                      
                      <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-10">{quizQuestions[currentQuestionIndex].word}</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
                              const currentQ = quizQuestions[currentQuestionIndex];
                              const isSelected = currentQ.userAnswer === option;
                              const isCorrect = option === currentQ.correctMeaning;
                              
                              let btnClass = "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400";
                              if (currentQ.userAnswer) {
                                  if (isCorrect) btnClass = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-400 ring-1 ring-green-500";
                                  else if (isSelected) btnClass = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-700 dark:text-red-400";
                                  else btnClass = "opacity-50 dark:bg-slate-700";
                              }

                              return (
                                  <button 
                                    key={idx}
                                    disabled={!!currentQ.userAnswer}
                                    onClick={() => handleAnswer(option)}
                                    className={`p-6 rounded-xl border-2 text-lg font-medium transition-all duration-200 text-left flex items-center justify-between ${btnClass}`}
                                  >
                                      {option}
                                      {currentQ.userAnswer && isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                                      {currentQ.userAnswer && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500" />}
                                  </button>
                              )
                          })}
                      </div>
                  </div>
              </div>
          )}
       </div>
    </div>
  );
};

export default QuizModal;
