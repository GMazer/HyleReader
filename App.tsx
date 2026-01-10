
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { logoutUser } from './firebaseService';
import { getAllBooks, getAllVocabulary, saveBook, deleteBook, deleteVocabulary } from './db';
import { Book, BookStatus, VocabularyItem } from './types';

// Layout & Features
import MainLayout from './layouts/MainLayout';
import LoginScreen from './features/auth/LoginScreen';
import LibraryView from './features/library/LibraryView';
import VocabularyView from './features/vocabulary/VocabularyView';
import Reader from './features/reader/Reader';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Data State
  const [books, setBooks] = useState<Book[]>([]);
  const [vocabList, setVocabList] = useState<VocabularyItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<'library' | 'vocabulary'>('library');
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Auth & Initial Load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        loadData(currentUser.uid);
      } else {
        setBooks([]);
        setVocabList([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Theme Logic
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Data Loading
  const loadData = async (userId: string) => {
    setIsLoadingData(true);
    try {
      const [booksData, vocabData] = await Promise.all([
        getAllBooks(userId),
        getAllVocabulary(userId)
      ]);
      setBooks(booksData);
      setVocabList(vocabData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handlers
  const handleLogout = async () => {
    await logoutUser();
  };

  const handleBookAdded = (newBook: Book) => {
    setBooks(prev => [newBook, ...prev]);
  };

  const handleUpdateBookStatus = async (id: string, status: BookStatus) => {
    const book = books.find(b => b.id === id);
    if (book) {
      const updatedBook = { ...book, status };
      await saveBook(updatedBook);
      setBooks(prev => prev.map(b => b.id === id ? updatedBook : b));
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa sách này không?")) {
      await deleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleDeleteVocab = async (id: string) => {
    if (confirm("Xóa từ vựng này?")) {
      await deleteVocabulary(id);
      setVocabList(prev => prev.filter(v => v.id !== id));
    }
  };

  const handleUpdateBookContent = async (updatedBook: Book) => {
    await saveBook(updatedBook);
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    setReadingBook(updatedBook);
    // Reload vocab if needed
    if (user) {
       const vocab = await getAllVocabulary(user.uid);
       setVocabList(vocab);
    }
  };

  // Render Logic
  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (readingBook) {
    return (
      <Reader 
        book={readingBook} 
        onClose={() => setReadingBook(null)} 
        onUpdateBook={handleUpdateBookContent} 
      />
    );
  }

  return (
    <MainLayout
      user={user}
      onLogout={handleLogout}
      isDarkMode={isDarkMode}
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {activeTab === 'library' ? (
        <LibraryView 
          user={user}
          books={books}
          isLoading={isLoadingData}
          onUpdateStatus={handleUpdateBookStatus}
          onDelete={handleDeleteBook}
          onOpenReader={setReadingBook}
          onBookAdded={handleBookAdded}
        />
      ) : (
        <VocabularyView 
          vocabList={vocabList}
          isLoading={isLoadingData}
          onDeleteVocab={handleDeleteVocab}
        />
      )}
    </MainLayout>
  );
};

export default App;
