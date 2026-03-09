import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Folder, FileText, Terminal, X, Minimize2, FileCode } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';

type FileType = 'folder' | 'text' | 'executable';

interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  children?: FileSystemNode[];
}

const fileSystem: FileSystemNode[] = [
  {
    id: 'f_logs',
    name: 'Archived_Logs',
    type: 'folder',
    children: [
      { id: 't_sys', name: 'sys_config.txt', type: 'text', content: 'desktopSim.lore.sys' },
      { id: 't_warn', name: 'incident_04.txt', type: 'text', content: 'desktopSim.lore.warn' }
    ]
  },
  {
    id: 'f_tools',
    name: 'Admin_Tools',
    type: 'folder',
    children: [
      { id: 'e_loop', name: 'loop_override.exe', type: 'executable' }
    ]
  },
  { id: 't_readme', name: 'README.txt', type: 'text', content: 'desktopSim.lore.readme' }
];

interface WindowState {
  id: string;
  title: string;
  type: 'explorer' | 'editor' | 'terminal';
  contentNode: FileSystemNode;
  zIndex: number;
}

export default function DesktopSim() {
  const { t } = useTranslation();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [topZIndex, setTopZIndex] = useState(10);
  const [isExecuting, setIsExecuting] = useState(false);

  const openWindow = (node: FileSystemNode) => {
    // If it's the executable, run it
    if (node.type === 'executable') {
      executeFile(node);
      return;
    }

    if (windows.some(w => w.id === node.id)) {
      focusWindow(node.id);
      return;
    }

    audio.playClick();
    const newZ = topZIndex + 1;
    setTopZIndex(newZ);
    setWindows([...windows, {
      id: node.id,
      title: node.name,
      type: node.type === 'folder' ? 'explorer' : 'editor',
      contentNode: node,
      zIndex: newZ
    }]);
  };

  const closeWindow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    audio.playClick();
    setWindows(windows.filter(w => w.id !== id));
  };

  const focusWindow = (id: string) => {
    const newZ = topZIndex + 1;
    setTopZIndex(newZ);
    setWindows(windows.map(w => w.id === id ? { ...w, zIndex: newZ } : w));
  };

  const executeFile = (_node: FileSystemNode) => {
    audio.playSuccess();
    setIsExecuting(true);
    
    setTimeout(() => {
      gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
    }, 2500);
  };

  const renderDesktopIcon = (node: FileSystemNode) => (
    <div 
      key={node.id} 
      className="flex flex-col items-center justify-center w-24 p-2 cursor-pointer hover:bg-white/10 rounded group transition-colors"
      onDoubleClick={() => openWindow(node)}
      onTouchEnd={() => openWindow(node)} // simple mobile support
    >
      {node.type === 'folder' && <Folder size={40} className="text-brand-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
      {node.type === 'text' && <FileText size={40} className="text-slate-300 drop-shadow-md" />}
      {node.type === 'executable' && <FileCode size={40} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
      <span className="mt-2 text-xs text-center text-slate-200 font-mono break-all line-clamp-2 px-1 rounded group-hover:bg-brand-500">{node.name}</span>
    </div>
  );

  return (
    <div className="w-full h-full bg-[#0a192f] overflow-hidden relative select-none">
      {/* OS Desktop Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,rgba(2,6,23,1)_100%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[url('/assets/grid.svg')] bg-repeat" />

      {/* Desktop Grid */}
      <div className="absolute inset-0 p-8 flex flex-col flex-wrap items-start content-start gap-4">
        {fileSystem.map(renderDesktopIcon)}
      </div>

      {/* Windows Layer */}
      <AnimatePresence>
        {windows.map((w) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseDown={() => focusWindow(w.id)}
            style={{ zIndex: w.zIndex }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-slate-900 border ${w.type === 'explorer' ? 'border-brand-500/50' : 'border-slate-500/50'} shadow-2xl rounded overflow-hidden flex flex-col`}
          >
            {/* Window Header */}
            <div className={`h-8 flex items-center justify-between px-3 select-none ${w.type === 'explorer' ? 'bg-brand-900/50' : 'bg-slate-800'}`}>
               <span className="text-xs font-mono font-bold text-slate-200 truncate flex items-center gap-2">
                 {w.type === 'explorer' ? <Folder size={14} className="text-brand-400" /> : <FileText size={14} className="text-slate-400" />}
                 {w.title}
               </span>
               <div className="flex items-center gap-2">
                 <button className="text-slate-400 hover:text-white transition-colors"><Minimize2 size={14} /></button>
                 <button onClick={(e) => closeWindow(w.id, e)} className="text-slate-400 hover:text-red-400 transition-colors"><X size={16} /></button>
               </div>
            </div>
            
            {/* Window Content */}
            <div className="flex-1 bg-[#0f172a] p-4 overflow-y-auto">
              {w.type === 'explorer' && w.contentNode.children && (
                <div className="flex flex-wrap gap-6 items-start">
                  {w.contentNode.children.map(renderDesktopIcon)}
                  {w.contentNode.children.length === 0 && <span className="text-slate-500 font-mono text-sm">{t('desktopSim.emptyFolder', 'This folder is empty.')}</span>}
                </div>
              )}

              {w.type === 'editor' && (
                 <div className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">
                   {/* Typed effect simulation or simple text */}
                   {t(w.contentNode.content || '')}
                 </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Executable Overlay */}
      <AnimatePresence>
         {isExecuting && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="absolute inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm"
           >
             <Terminal className="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" size={64} />
             <div className="text-center font-mono text-red-400 Space-y-2">
                <p className="text-2xl font-bold uppercase tracking-[0.2em]">{t('desktopSim.executing')}</p>
                <div className="w-64 h-2 bg-slate-800 rounded-full mt-4 overflow-hidden relative mx-auto">
                   <motion.div 
                     initial={{ width: 0 }} 
                     animate={{ width: "100%" }} 
                     transition={{ duration: 2, ease: "easeInOut" }}
                     className="absolute top-0 left-0 h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" 
                   />
                </div>
             </div>
           </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}
