
import React from 'react';
import { Book, BookStatus } from '../types';
import { BookOpen, CheckCircle, Clock, Trash2, Zap } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onUpdateStatus: (id: string, status: BookStatus) => void;
  onDelete: (id: string) => void;
  onOpenReader: (book: Book) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onUpdateStatus, onDelete, onOpenReader }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 dark:border-slate-800 flex flex-col group relative">
      <div className="relative h-48 bg-gray-200 dark:bg-slate-800 overflow-hidden cursor-pointer" onClick={() => onOpenReader(book)}>
        <img 
          src={book.coverUrl || `https://picsum.photos/seed/${book.id}/200/300`} 
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 shadow-sm border border-white/20">
          {book.category}
        </div>
        
        <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2">
          <Zap className="w-6 h-6 fill-white" />
          Xem Phân Tích
        </div>
      </div>
      
      <div className="p-4 flex-grow">
        <h3 className="font-bold text-gray-900 dark:text-white leading-tight mb-1 line-clamp-2">{book.title}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">{book.author}</p>
        
        <div className="flex gap-2 mt-auto">
          <button 
            onClick={() => onOpenReader(book)}
            className="flex-grow py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            Đọc Insight
          </button>
          <button 
            onClick={() => onDelete(book.id)}
            className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
