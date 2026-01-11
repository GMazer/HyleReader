
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, AlertTriangle, Zap } from 'lucide-react';
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

const ChatPanel: React.FC<ChatPanelProps> = ({ book, allParagraphs }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Mình là trợ lý AI. Bạn có thắc mắc gì về cuốn sách này không?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('gemini-3-flash-preview');
  
  const chatSessionRef = useRef<Chat | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    initChat(currentModel);
  }, [book.id, currentModel]);

  const initChat = (modelName: string) => {
    const context = book.summary || book.description || allParagraphs.slice(0, 20).join('\n');
    chatSessionRef.current = createBookChat(book.title, book.author, context, modelName);
  };

  const handleSwitchModel = () => {
    const newModel = 'gemini-flash-lite-latest';
    setCurrentModel(newModel);
    setMessages(prev => [...prev, {
        role: 'model',
        text: `Đã chuyển sang model **${newModel}** (Flash Lite). Tốc độ nhanh hơn, giới hạn cao hơn. Hãy thử hỏi lại nhé!`,
        isSystem: true
    }]);
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
             text: `⚠️ **Đã đạt giới hạn hạn mức** cho model ${currentModel}.`,
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
    <div className="flex flex-col h-full absolute inset-0 pt-16 pb-0">
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : msg.isError ? 'bg-red-100 text-red-600' : 'bg-indigo-600'}`}>
                        {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : msg.isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed ${
                    msg.role === 'user' 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-sm' 
                        : msg.isError 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-tl-sm'
                        : msg.isSystem
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 rounded-tl-sm border border-indigo-100 dark:border-indigo-800'
                    }`}>
                        <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                        
                        {msg.isError && msg.text.includes("429") && currentModel !== 'gemini-flash-lite-latest' && (
                            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800/50">
                                <p className="text-xs mb-2 opacity-80">Giới hạn hôm nay cho model này có thể đã hết. Bạn có muốn đổi sang model nhẹ hơn không?</p>
                                <button 
                                    onClick={handleSwitchModel}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                >
                                    <Zap className="w-3 h-3" /> Chuyển sang Flash Lite
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
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-[10px] text-center text-slate-400 mb-1">Model đang dùng: {currentModel}</div>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Hỏi về sách..."
                    className="flex-grow px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    </div>
  );
};

export default ChatPanel;
