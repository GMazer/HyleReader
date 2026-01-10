
import React, { useState, useMemo } from 'react';
import { Plus, Search, Layers, Loader2, Book as BookIcon } from 'lucide-react';
import { Book, BookStatus } from '../../types';
import BookCard from '../../components/BookCard';
import ImportModal from './components/ImportModal';
import { User } from 'firebase/auth';

interface LibraryViewProps {
  user: User;
  books: Book[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: BookStatus) => void;
  onDelete: (id: string) => void;
  onOpenReader: (book: Book) => void;
  onBookAdded: (book: Book) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ 
  user, books, isLoading, onUpdateStatus, onDelete, onOpenReader, onBookAdded 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(books.map(b => b.category));
    return ['All', ...Array.from(cats)];
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            b.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterCategory === 'All' || b.category === filterCategory;
      return matchesSearch && matchesFilter;
    });
  }, [books, searchTerm, filterCategory]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Thư viện của bạn</h1>
          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4" /> {books.length} cuốn sách • Dữ liệu lưu cục bộ
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Thêm sách mới
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm kiếm sách, tác giả..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      {isLoading ? (
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {[1,2,3,4,5].map(i => (
                  <div key={i} className="bg-white dark:bg-slate-900 h-80 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800"></div>
              ))}
           </div>
      ) : (
          <>
              {filteredBooks.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {filteredBooks.map(book => (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      onUpdateStatus={onUpdateStatus} 
                      onDelete={onDelete}
                      onOpenReader={onOpenReader}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Chưa có cuốn sách nào</h3>
                  <button onClick={() => setShowAddModal(true)} className="text-indigo-600 font-bold hover:underline">Thêm sách ngay</button>
                </div>
              )}
          </>
      )}

      {showAddModal && (
        <ImportModal 
            user={user}
            onClose={() => setShowAddModal(false)}
            onSuccess={onBookAdded}
        />
      )}
    </div>
  );
};

export default LibraryView;
