
import React from 'react';
import { Book, BookStatus } from '../types';
import { Trash2, Sparkles, BookOpen } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onUpdateStatus: (id: string, status: BookStatus) => void;
  onDelete: (id: string) => void;
  onOpenReader: (book: Book) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onUpdateStatus, onDelete, onOpenReader }) => {
  const progress = book.progress || 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-800 flex flex-col h-full group overflow-hidden">
      {/* Cover Image Area - Taller Aspect Ratio */}
      <div 
        className="relative aspect-[2/3] w-full bg-slate-200 dark:bg-slate-800 cursor-pointer overflow-hidden" 
        onClick={() => onOpenReader(book)}
      >
        <img 
          src={book.coverUrl || `https://picsum.photos/seed/${book.id}/400/600`} 
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Category Tag Overlay */}
        <div className="absolute top-2 right-2 max-w-[80%]">
          <div className="px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm border border-white/20 truncate">
            {book.category}
          </div>
        </div>
        
        {/* Simple Hover Overlay */}
        <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="px-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Xem Insight</span>
            </div>
        </div>
      </div>
      
      {/* Progress Bar Area - Directly under image */}
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800">
        <div 
          className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Content Area */}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
            <h3 
              className="font-bold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-2 min-h-[1.5rem]" 
              title={book.title}
            >
              {book.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-1">{book.author}</p>
        </div>
        
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
           {/* Progress Text */}
           <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded min-w-[3rem] text-center">
              {progress}%
           </div>

           {/* Read Button */}
           <button 
            onClick={() => onOpenReader(book)}
            className="flex-grow py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-indigo-500/20 shadow-md flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Đọc
          </button>

          {/* Delete Button */}
          <button 
            onClick={() => onDelete(book.id)}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Xóa sách"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
