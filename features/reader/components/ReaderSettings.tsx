
import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { ReaderSettings as SettingsType } from '../../../types';

interface ReaderSettingsProps {
  settings: SettingsType;
  setSettings: React.Dispatch<React.SetStateAction<SettingsType>>;
}

const ReaderSettings: React.FC<ReaderSettingsProps> = ({ settings, setSettings }) => {
  const isDark = settings.theme === 'dark';
  const isSepia = settings.theme === 'sepia';
  
  const panelBg = isDark ? 'bg-[#1a1a1a] border-slate-700 text-white' : isSepia ? 'bg-[#fbf0d9] border-[#e0d0b0] text-[#433422]' : 'bg-white border-slate-200 text-slate-900';
  const itemHover = isDark ? 'hover:bg-slate-800' : isSepia ? 'hover:bg-[#e8d8b9]' : 'hover:bg-slate-50';
  const activeItem = isDark ? 'bg-indigo-900/30 text-indigo-400' : isSepia ? 'bg-[#e8d8b9] text-indigo-800' : 'bg-indigo-50 text-indigo-700';

  return (
    <div className={`absolute top-16 right-4 md:right-20 z-50 w-72 rounded-xl shadow-2xl border p-4 settings-panel animate-in zoom-in-95 duration-200 ${panelBg}`}>
       <div className="mb-4">
         <div className="text-xs font-bold opacity-50 mb-2 uppercase">Màu nền</div>
         <div className="flex gap-2">
           <button onClick={() => setSettings(s => ({...s, theme: 'light'}))} className={`flex-1 py-3 rounded-lg border flex justify-center ${settings.theme === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : isDark ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-300'}`}><div className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-sm"></div></button>
           <button onClick={() => setSettings(s => ({...s, theme: 'sepia'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-[#fbf0d9] ${settings.theme === 'sepia' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : isDark ? 'border-slate-700 hover:border-slate-500' : 'border-[#ede0c5] hover:border-[#e3d0a8]'}`}><div className="w-6 h-6 rounded-full bg-[#5f4b32]"></div></button>
           <button onClick={() => setSettings(s => ({...s, theme: 'dark'}))} className={`flex-1 py-3 rounded-lg border flex justify-center bg-slate-900 ${settings.theme === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : isSepia ? 'border-[#e0d0b0] hover:border-[#cfbca0]' : 'border-slate-800 hover:border-slate-700'}`}><div className="w-6 h-6 rounded-full bg-slate-700"></div></button>
         </div>
       </div>
       <div className="mb-4">
         <div className="text-xs font-bold opacity-50 mb-2 uppercase">Kiểu chữ</div>
         <div className="flex flex-col gap-1">
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'bookerly'}))} className={`px-3 py-2 text-left rounded-md text-sm font-serif ${settings.fontFamily === 'bookerly' ? activeItem : itemHover}`}>Bookerly (Serif)</button>
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))} className={`px-3 py-2 text-left rounded-md text-sm font-sans ${settings.fontFamily === 'sans' ? activeItem : itemHover}`}>Inter (Sans-serif)</button>
            <button onClick={() => setSettings(s => ({...s, fontFamily: 'mono'}))} className={`px-3 py-2 text-left rounded-md text-sm font-mono ${settings.fontFamily === 'mono' ? activeItem : itemHover}`}>Monospace</button>
         </div>
       </div>
       <div>
         <div className="text-xs font-bold opacity-50 mb-2 uppercase">Cỡ chữ: {settings.fontSize}px</div>
         <div className={`flex items-center gap-3 p-2 rounded-lg ${isDark ? 'bg-slate-800' : isSepia ? 'bg-[#e8d8b9]' : 'bg-slate-100'}`}>
           <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 1)}))} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-slate-700' : isSepia ? 'hover:bg-[#dcc59a]' : 'hover:bg-white'}`}><Minus className="w-4 h-4" /></button>
           <div className="flex-grow"><input type="range" min="12" max="32" step="1" value={settings.fontSize} onChange={(e) => setSettings(s => ({...s, fontSize: parseInt(e.target.value)}))} className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-indigo-600 ${isDark ? 'bg-slate-600' : isSepia ? 'bg-[#cfbca0]' : 'bg-slate-300'}`} /></div>
           <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(32, s.fontSize + 1)}))} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-slate-700' : isSepia ? 'hover:bg-[#dcc59a]' : 'hover:bg-white'}`}><Plus className="w-4 h-4" /></button>
         </div>
       </div>
    </div>
  );
};

export default ReaderSettings;
