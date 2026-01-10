
import React from 'react';
import { BookOpen, Sun, Moon, LogOut, Layers, GraduationCap } from 'lucide-react';
import { User } from 'firebase/auth';

interface MainLayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  activeTab: 'library' | 'vocabulary';
  setActiveTab: (tab: 'library' | 'vocabulary') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, user, onLogout, isDarkMode, toggleTheme, activeTab, setActiveTab 
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                Hyle Reader
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {user && (
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800 ml-2">
                   {user.photoURL ? (
                      <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" />
                   ) : (
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                          {user.email?.charAt(0).toUpperCase()}
                      </div>
                   )}
                   <button 
                     onClick={onLogout}
                     className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                     title="Đăng xuất"
                   >
                     <LogOut className="w-5 h-5" />
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      {user && (
        <div className="pt-8 pb-2">
          <div className="flex items-center justify-center">
              <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1">
                  <button 
                     onClick={() => setActiveTab('library')}
                     className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                     <Layers className="w-4 h-4" /> Thư viện sách
                  </button>
                  <button 
                     onClick={() => setActiveTab('vocabulary')}
                     className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'vocabulary' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                     <GraduationCap className="w-4 h-4" /> Từ vựng đã học
                  </button>
              </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full relative">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-slate-950 mt-auto">
        <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-2">
           Developed by <span className="text-indigo-600 dark:text-indigo-400 font-bold">Hyle</span>
           <span className="text-slate-300">•</span>
           <span className="text-xs">Powered by Gemini AI</span>
        </p>
      </footer>
    </div>
  );
};

export default MainLayout;
