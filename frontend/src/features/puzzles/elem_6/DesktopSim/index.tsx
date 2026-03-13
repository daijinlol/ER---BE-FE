import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Folder, FileText, Terminal, X, Minimize2, FileCode, HardDrive, ShieldCheck } from 'lucide-react';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { useGameSession } from '../../../../core/GameSession';
import type { PuzzleComponentProps } from '../../types';

type FileType = 'folder' | 'text' | 'executable';

interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  rewardItem?: string;
  completesOnCollect?: boolean;
  children?: FileSystemNode[];
}

const LOOP_MODULE_NODE: FileSystemNode = {
  id: 't_loop_module',
  name: 'loop_module.pkg',
  type: 'text',
  content: 'desktopSim.lore.loopModule',
  rewardItem: 'module_loop',
  completesOnCollect: true,
};

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
      { id: 't_patch', name: 'legacy_patch.bin', type: 'text', content: 'desktopSim.lore.decryptor', rewardItem: 'usb_decryptor' },
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

export default function DesktopSim(_props: PuzzleComponentProps) {
  const { t } = useTranslation();
  const { session } = useGameSession();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [topZIndex, setTopZIndex] = useState(10);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pickupToast, setPickupToast] = useState<string | null>(null);
  const [isLoopOverrideComplete, setIsLoopOverrideComplete] = useState(false);
  const recoveredItems = session.inventoryItems.filter((item) => ['module_ram', 'module_loop', 'usb_decryptor'].includes(item));

  const desktopNodes = [
    ...fileSystem,
    ...(isLoopOverrideComplete && !session.inventoryItems.includes('module_loop') ? [LOOP_MODULE_NODE] : []),
  ];

  const openWindow = (node: FileSystemNode) => {
    // If it's the executable, run it
    if (node.type === 'executable') {
      executeFile(node);
      return;
    }

    if (node.rewardItem && !session.inventoryItems.includes(node.rewardItem)) {
      gameEvents.publish('ITEM_FOUND', node.rewardItem);
      audio.playItemFound();
      setPickupToast(t(`desktopSim.pickups.${node.rewardItem}`, { defaultValue: `${node.rewardItem} recovered.` }));
      window.setTimeout(() => setPickupToast(null), 2600);

      if (node.completesOnCollect) {
        window.setTimeout(() => {
          gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 900);
      }
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
    if (isLoopOverrideComplete) {
      return;
    }

    audio.playSuccess();
    setIsExecuting(true);

    setTimeout(() => {
      setIsExecuting(false);
      setIsLoopOverrideComplete(true);
      setPickupToast(t('desktopSim.pickups.module_loop_ready', { defaultValue: 'Loop Control Module dropped to desktop.' }));
      window.setTimeout(() => setPickupToast(null), 2600);
    }, 2500);
  };

  const renderDesktopIcon = (node: FileSystemNode) => (
    <div
      key={node.id}
      className="group flex w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-950/35 p-3 text-center transition-colors hover:border-brand-400/40 hover:bg-brand-500/10"
      onDoubleClick={() => openWindow(node)}
      onTouchEnd={() => openWindow(node)} // simple mobile support
    >
      {node.type === 'folder' && <Folder size={38} className="text-brand-300 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />}
      {node.type === 'text' && <FileText size={38} className="text-slate-200 drop-shadow-md" />}
      {node.type === 'executable' && <FileCode size={38} className="text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]" />}
      <span className="mt-3 rounded-md px-1 text-[11px] font-mono text-slate-200 break-all line-clamp-2 group-hover:text-brand-100">{node.name}</span>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-100 select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),rgba(2,6,23,1)_62%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.45)_1px,transparent_1px)] bg-[size:3.2rem_3.2rem] opacity-20 pointer-events-none" />

      <div className="relative z-10 flex h-full flex-col gap-4 p-4">
        <div className="rounded-2xl border border-brand-500/20 bg-black/45 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-brand-300">
                <Terminal size={18} />
                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('desktopSim.remoteLink')}</div>
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('desktopSim.title')}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{t('desktopSim.instructions')}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[20rem]">
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-right">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-brand-300">{t('desktopSim.recoveredArtifacts')}</div>
                <div className="mt-2 text-2xl text-white">{recoveredItems.length}/3</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/75 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
                  <HardDrive size={14} />
                  {t('desktopSim.workstationState')}
                </div>
                <div className="mt-2 text-sm text-slate-200">{isLoopOverrideComplete ? t('desktopSim.loopOverrideExecuted') : t('desktopSim.legacyOverridePending')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[17rem_1fr]">
          <aside className="flex min-h-0 flex-col gap-4 rounded-[1.75rem] border border-slate-700 bg-black/35 p-4 shadow-xl">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-brand-300">{t('desktopSim.operatorNotesTitle')}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('desktopSim.operatorNotesBody')}</p>
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
                <ShieldCheck size={15} className="text-emerald-300" />
                {t('desktopSim.recoveredItemsTitle')}
              </div>
              <div className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                {['module_ram', 'module_loop', 'usb_decryptor'].map((itemId) => {
                  const ready = session.inventoryItems.includes(itemId);
                  return (
                    <div key={itemId} className={`rounded-xl border px-3 py-3 text-sm ${ready ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-slate-800 bg-slate-900/80 text-slate-500'}`}>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em]">{ready ? t('desktopSim.recoveredState') : t('desktopSim.missingState')}</div>
                      <div className="mt-1">{t(`items.${itemId}`, { defaultValue: itemId })}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="relative min-h-0 overflow-hidden rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),rgba(2,6,23,1)_64%)] shadow-xl">
            <div className="absolute inset-x-4 top-4 z-10 rounded-2xl border border-brand-500/20 bg-slate-950/65 px-4 py-3 backdrop-blur-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-brand-300">{t('desktopSim.recoveryWorkspaceTitle')}</div>
                  <p className="mt-1 text-sm text-slate-300">{t('desktopSim.recoveryWorkspaceBody')}</p>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                  {t('desktopSim.nodesAvailable', { count: desktopNodes.length })}
                </div>
              </div>
            </div>

            <div className="absolute inset-0 p-4 pt-28">
              <div className="grid h-full auto-rows-min grid-cols-[repeat(auto-fit,minmax(6rem,6rem))] content-start gap-4 overflow-y-auto rounded-[1.5rem] border border-slate-800/70 bg-slate-950/22 p-5 pr-4 custom-scrollbar">
                {desktopNodes.map(renderDesktopIcon)}
              </div>
            </div>

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
                  className={`absolute left-1/2 top-1/2 flex h-[22rem] w-[min(92%,38rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.4rem] border shadow-2xl ${w.type === 'explorer' ? 'border-brand-500/35 bg-slate-950/96' : 'border-slate-600/60 bg-slate-950/96'}`}
                >
                  <div className={`flex h-11 items-center justify-between border-b px-4 ${w.type === 'explorer' ? 'border-brand-500/20 bg-brand-500/8' : 'border-slate-700 bg-slate-900/95'}`}>
                    <span className="flex items-center gap-2 truncate text-xs font-mono font-bold uppercase tracking-[0.18em] text-slate-200">
                      {w.type === 'explorer' ? <Folder size={14} className="text-brand-300" /> : <FileText size={14} className="text-slate-400" />}
                      {w.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="rounded border border-transparent p-1 text-slate-500 transition-colors hover:border-slate-700 hover:text-white"><Minimize2 size={14} /></button>
                      <button onClick={(e) => closeWindow(w.id, e)} className="rounded border border-transparent p-1 text-slate-500 transition-colors hover:border-red-500/50 hover:text-red-300"><X size={16} /></button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-slate-950/90 p-4 custom-scrollbar">
                    {w.type === 'explorer' && w.contentNode.children && (
                      <div className="flex flex-wrap gap-5 items-start">
                        {w.contentNode.children.map(renderDesktopIcon)}
                        {w.contentNode.children.length === 0 && <span className="text-sm font-mono text-slate-500">{t('desktopSim.emptyFolder')}</span>}
                      </div>
                    )}

                    {w.type === 'editor' && (
                      <div className="rounded-2xl border border-slate-800 bg-black/35 p-4 font-mono text-sm leading-relaxed text-emerald-300 whitespace-pre-wrap">
                        {t(w.contentNode.content || '')}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        </div>
      </div>

      {/* Executable Overlay */}
      <AnimatePresence>
        {isExecuting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-black/88 p-8 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-[1.75rem] border border-red-500/30 bg-slate-950/92 p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.2)]">
              <Terminal className="mx-auto mb-6 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" size={64} />
              <div className="text-center font-mono text-red-300">
                <p className="text-2xl font-bold uppercase tracking-[0.2em]">{t('desktopSim.executing')}</p>
                <div className="mt-2 text-xs uppercase tracking-[0.24em] text-red-200/70">{t('desktopSim.overrideInProgress')}</div>
              </div>
              <div className="relative mx-auto mt-6 h-2 w-64 overflow-hidden rounded-full bg-slate-800">
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

      <AnimatePresence>
        {pickupToast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-8 left-8 z-[60] rounded-xl border border-emerald-400/40 bg-slate-950/92 px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300">{t('desktopSim.recoveredItemTitle')}</div>
            <div className="mt-1 text-sm text-slate-100">{pickupToast}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
