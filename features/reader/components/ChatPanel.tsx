
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, AlertTriangle, Zap, Settings2, Check } from 'lucide-react';
import { Chat, GenerateContentResponse } from '@google/genai';
import { createBookChat, handleGeminiError } from '../../../geminiService';
import { Book } from '../../../types';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  isSystem?: boolean;
}

interface ChatPanelProps {
  book: Book;
  allParagraphs: string[];
}

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Flash 3.0', desc: 'Thông minh & Nhanh (Khuyên dùng)' },
  { id: 'gemini-flash-lite-latest', name: 'Flash Lite', desc: 'Tốc độ cao, Hạn mức lớn' },
  { id: 'gemini-3-pro-preview', name: 'Pro 3.0', desc: 'Logic phức tạp, Hạn mức thấp' }
];

const ChatPanel: React.FC<ChatPanelProps> = ({ book, allParagraphs }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Mình là trợ lý AI. Bạn có thắc mắc gì về cuốn sách này không?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('gemini-3-flash-preview');
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    initChat(currentModel);
  }, [book.id, currentModel]);

  const initChat = (modelName: string) => {
    const context = book.summary || book.description || allParagraphs.slice(0, 20).join('\n');
    chatSessionRef.current = createBookChat(book.title, book.author, context, modelName);
  };

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    setShowModelSelector(false);
    setMessages(prev => [...prev, {
        role: 'model',
        text: `Đã chuyển sang model **${MODELS.find(m => m.id === modelId)?.name}**. Cuộc hội thoại mới bắt đầu.`,
        isSystem: true
    }]);
  };

  const handleSwitchToLite = () => {
    handleModelChange('gemini-flash-lite-latest');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSessionRef.current) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const result: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: result.text || "..." }]);
    } catch (error) {
      const errorMsg = handleGeminiError(error, "trả lời tin nhắn");
      
      if (errorMsg === "429") {
         setMessages(prev => [...prev, { 
             role: 'model', 
             text: `⚠️ **Đã hết hạn mức (429)** cho model ${MODELS.find(m => m.id === currentModel)?.name}.`,
             isError: true
         }]);
      } else {
         setMessages(prev => [...prev, { role: 'model', text: errorMsg, isError: true }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full absolute inset-0 pt-0 pb-0 bg-slate-50 dark:bg-slate-900/50">
        {/* Model Selector Header */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10 relative shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <Bot className="w-4 h-4" />
                <span>Model:</span>
            </div>
            <div className="relative">
                <button 
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    {MODELS.find(m => m.id === currentModel)?.name}
                    <Settings2 className="w-3 h-3" />
                </button>
                
                {showModelSelector && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200 z-50">
                        <div className="p-2 space-y-1">
                            {MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-start gap-2 ${currentModel === model.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                >
                                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${currentModel === model.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                    <div>
                                        <div className="font-bold">{model.name}</div>
                                        <div className="opacity-70 text-[10px]">{model.desc}</div>
                                    </div>
                                    {currentModel === model.id && <Check className="w-4 h-4 ml-auto text-indigo-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : msg.isError ? 'bg-red-100 text-red-600' : 'bg-indigo-600'}`}>
                        {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : msg.isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-sm border border-slate-100 dark:border-slate-700' 
                        : msg.isError 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-tl-sm'
                        : msg.isSystem
                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs italic text-center w-full'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 rounded-tl-sm border border-indigo-100 dark:border-indigo-800'
                    }`}>
                        {msg.isSystem ? (
                            <span>{msg.text}</span>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                        )}
                        
                        {msg.isError && msg.text.includes("429") && currentModel !== 'gemini-flash-lite-latest' && (
                            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800/50">
                                <p className="text-xs mb-2 opacity-80 font-semibold">Giới hạn hôm nay:</p>
                                <ul className="text-[10px] list-disc list-inside mb-3 opacity-80 space-y-1">
                                    <li><b>Flash 3.0:</b> ~15 RPM (Giới hạn trung bình)</li>
                                    <li><b>Flash Lite:</b> ~30 RPM (Giới hạn cao nhất)</li>
                                    <li><b>Pro 3.0:</b> ~2 RPM (Giới hạn thấp nhất)</li>
                                </ul>
                                <button 
                                    onClick={handleSwitchToLite}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
                                >
                                    <Zap className="w-3 h-3" /> Chuyển ngay sang Flash Lite
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {isLoading && (
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
        
        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Hỏi ${MODELS.find(m => m.id === currentModel)?.name}...`}
                    className="flex-grow px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white border-transparent border focus:border-indigo-200 dark:focus:border-indigo-800 transition-all"
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    </div>
  );
};

export default ChatPanel;
