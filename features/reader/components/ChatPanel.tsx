
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, AlertTriangle, Zap, Settings2, Check } from 'lucide-react';
import { Chat, GenerateContentResponse } from '@google/genai';
import { createBookChat, handleGeminiError } from '../../../geminiService';
import { Book, ThemeType } from '../../../types';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  isSystem?: boolean;
}

interface ChatPanelProps {
  book: Book;
  allParagraphs: string[];
  theme: ThemeType;
}

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Flash 3.0', desc: 'Thông minh & Nhanh (Khuyên dùng)' },
  { id: 'gemini-flash-lite-latest', name: 'Flash Lite', desc: 'Tốc độ cao, Hạn mức lớn' },
  { id: 'gemini-3-pro-preview', name: 'Pro 3.0', desc: 'Logic phức tạp, Hạn mức thấp' }
];

const ChatPanel: React.FC<ChatPanelProps> = ({ book, allParagraphs, theme }) => {
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

  const bgInput = theme === 'dark' ? 'bg-slate-800 text-white border-slate-700' : theme === 'sepia' ? 'bg-[#e8d8b9] text-[#433422] border-[#dcc59a]' : 'bg-slate-100 text-slate-900 border-transparent';
  const bgUser = theme === 'dark' ? 'bg-slate-800 text-white border-slate-700' : theme === 'sepia' ? 'bg-white text-[#433422] border-[#e0d0b0]' : 'bg-white text-slate-800 border-slate-100';
  const bgModel = theme === 'dark' ? 'bg-indigo-900/20 text-indigo-100 border-indigo-800' : theme === 'sepia' ? 'bg-[#f0e6d2] text-[#433422] border-[#e0d0b0]' : 'bg-indigo-50 text-indigo-900 border-indigo-100';
  const bgSystem = theme === 'dark' ? 'bg-slate-800/50 text-slate-400 border-slate-700' : theme === 'sepia' ? 'bg-[#f0e6d2]/50 text-[#7a6a55] border-[#e0d0b0]' : 'bg-slate-100 text-slate-600 border-slate-200';
  
  return (
    <div className={`flex flex-col h-full absolute inset-0 pt-0 pb-0 ${theme === 'dark' ? 'bg-slate-900/50' : theme === 'sepia' ? 'bg-[#f7e8c3]/50' : 'bg-slate-50'}`}>
        {/* Model Selector Header */}
        <div className={`flex-shrink-0 px-4 py-2 border-b flex justify-between items-center z-10 relative shadow-sm ${theme === 'dark' ? 'bg-[#0f0f0f] border-slate-800' : theme === 'sepia' ? 'bg-[#f7e8c3] border-[#ede0c5]' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center gap-2 text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                <Bot className="w-4 h-4" />
                <span>Model:</span>
            </div>
            <div className="relative">
                <button 
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50' : theme === 'sepia' ? 'bg-[#e8d8b9] text-indigo-800 hover:bg-[#decba8]' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                    {MODELS.find(m => m.id === currentModel)?.name}
                    <Settings2 className="w-3 h-3" />
                </button>
                
                {showModelSelector && (
                    <div className={`absolute top-full right-0 mt-2 w-64 rounded-xl shadow-xl border overflow-hidden animate-in zoom-in-95 duration-200 z-50 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : theme === 'sepia' ? 'bg-[#fbf0d9] border-[#e0d0b0]' : 'bg-white border-slate-200'}`}>
                        <div className="p-2 space-y-1">
                            {MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-start gap-2 ${currentModel === model.id ? (theme === 'dark' ? 'bg-indigo-900/30 text-indigo-300' : theme === 'sepia' ? 'bg-[#e8d8b9] text-indigo-800' : 'bg-indigo-50 text-indigo-700') : (theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : theme === 'sepia' ? 'text-[#5f4b32] hover:bg-[#e8d8b9]/50' : 'text-slate-700 hover:bg-slate-50')}`}
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? (theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200') : msg.isError ? 'bg-red-100 text-red-600' : 'bg-indigo-600'}`}>
                        {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : msg.isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm ${
                        msg.role === 'user' ? `${bgUser} rounded-tr-sm border` 
                        : msg.isError ? (theme === 'dark' ? 'bg-red-900/20 text-red-200 border-red-800' : 'bg-red-50 text-red-800 border-red-200') + ' border rounded-tl-sm'
                        : msg.isSystem ? `${bgSystem} border rounded-2xl text-xs italic text-center w-full`
                        : `${bgModel} rounded-tl-sm border`
                    }`}>
                        {msg.isSystem ? (
                            <span>{msg.text}</span>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                        )}
                        
                        {msg.isError && msg.text.includes("429") && currentModel !== 'gemini-flash-lite-latest' && (
                            <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-red-800/50' : 'border-red-200'}`}>
                                <p className="text-xs mb-2 opacity-80 font-semibold">Giới hạn hôm nay:</p>
                                <ul className="text-[10px] list-disc list-inside mb-3 opacity-80 space-y-1">
                                    <li><b>Flash 3.0:</b> ~15 RPM (Giới hạn trung bình)</li>
                                    <li><b>Flash Lite:</b> ~30 RPM (Giới hạn cao nhất)</li>
                                    <li><b>Pro 3.0:</b> ~2 RPM (Giới hạn thấp nhất)</li>
                                </ul>
                                <button 
                                    onClick={handleSwitchToLite}
                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold shadow-sm transition-colors ${theme === 'dark' ? 'bg-slate-800 border-red-800 text-red-400 hover:bg-red-900/30' : 'bg-white border-red-200 text-red-600 hover:bg-red-50'}`}
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
                    <div className={`p-3 rounded-2xl rounded-tl-sm flex items-center gap-1 ${theme === 'dark' ? 'bg-indigo-900/20' : theme === 'sepia' ? 'bg-[#f0e6d2]' : 'bg-indigo-50'}`}>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
            <div ref={chatEndRef}></div>
        </div>
        
        {/* Input Area */}
        <div className={`p-3 border-t ${theme === 'dark' ? 'border-slate-800 bg-[#0f0f0f]' : theme === 'sepia' ? 'border-[#ede0c5] bg-[#f7e8c3]' : 'border-slate-200 bg-white'}`}>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Hỏi ${MODELS.find(m => m.id === currentModel)?.name}...`}
                    className={`flex-grow px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border transition-all ${bgInput}`}
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
