
import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { ReaderSettings as SettingsType } from '../../../types';

interface ReaderSettingsProps {
  settings: SettingsType;
  setSettings: React.Dispatch<React.SetStateAction<SettingsType>>;
}

const ReaderSettings: React.FC<ReaderSettingsProps> = ({ settings, setSettings }) => {
  return (
    <div className="absolute top-16 right-4 md:right-20 z-50 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 settings-panel animate-in zoom-in-95 duration-200">
       <div className="mb-4">
         <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Màu nền</div>
         <div className="flex gap-2">
           <button onClick={() => setSettings(s => ({...s, theme: 'light'}))} className={`flex-1 py-3 rounded-lg border flex justify-center ${settings.theme === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'}`}><div className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-sm"></div></button>
           <button onClick={() => setSettings(s => ({...s, theme: 'sepia'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-[#fbf0d9] ${settings.theme === 'sepia' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-[#ede0c5] hover:border-[#e3d0a8]'}`}><div className="w-6 h-6 rounded-full bg-[#5f4b32]"></div></button>
           <button onClick={() => setSettings(s => ({...s, theme: 'dark'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-slate-900 ${settings.theme === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'}`}><div className="w-6 h-6 rounded-full bg-slate-700"></div></button>
         </div>
       </div>
       <div className="mb-4">
         <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Kiểu chữ</div>
         <div className="flex flex-col gap-1">
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'bookerly'}))} className={`px-3 py-2 text-left rounded-md text-sm font-serif ${settings.fontFamily === 'bookerly' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Bookerly (Serif)</button>
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))} className={`px-3 py-2 text-left rounded-md text-sm font-sans ${settings.fontFamily === 'sans' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Inter (Sans-serif)</button>
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'mono'}))} className={`px-3 py-2 text-left rounded-md text-sm font-mono ${settings.fontFamily === 'mono' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300'}`}>Monospace</button>
         </div>
       </div>
       <div>
         <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Cỡ chữ: {settings.fontSize}px</div>
         <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
           <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 1)}))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"><Minus className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
           <div className="flex-grow"><input type="range" min="12" max="32" step="1" value={settings.fontSize} onChange={(e) => setSettings(s => ({...s, fontSize: parseInt(e.target.value)}))} className="w-full h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>
           <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(32, s.fontSize + 1)}))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"><Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
         </div>
       </div>
    </div>
  );
};

export default ReaderSettings;
