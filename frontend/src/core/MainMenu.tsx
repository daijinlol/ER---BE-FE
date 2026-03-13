import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpenText, Settings, Users, Power, ChevronRight, X, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from './AudioEngine';
import { registry } from '../features/puzzles/registry';
import type { CampaignSessionSnapshot } from './GameSession';
import { getCampaignTheme, withAlpha } from './campaignTheme';

type MenuView = 'MAIN' | 'OPTIONS' | 'CREDITS' | 'DIFFICULTY';

interface MainMenuProps {
   onStart: (campaignId: string, mode?: 'fresh' | 'resume') => void;
   resumeSessions: Record<string, CampaignSessionSnapshot>;
   options: { volume: number; enableCrt: boolean; enableDyslexic: boolean };
   onOptionsChange: (options: any) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, resumeSessions, options, onOptionsChange }) => {
   const { t, i18n } = useTranslation();
   const [currentView, setCurrentView] = useState<MenuView>('MAIN');
   const availableCampaigns = Object.keys(registry.campaigns).filter((campaignId) => registry.campaigns[campaignId].levels.length > 0);
   const resumableCampaigns = Object.values(resumeSessions).filter((session) => session.status === 'active').length;

   const handleStart = async (campaignId: string, mode: 'fresh' | 'resume' = 'fresh') => {
      await audio.init();
      audio.playSuccess();
      onStart(campaignId, mode);
   };

   const changeView = async (view: MenuView) => {
      await audio.init();
      audio.playClick();
      setCurrentView(view);
   };

   const updateOption = (key: string, value: any, playSound = true) => {
      if (playSound) audio.playClick();
      onOptionsChange({ ...options, [key]: value });
   };

   // Animation variants
   const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
         opacity: 1,
         transition: { staggerChildren: 0.1, delayChildren: 0.2 }
      },
      exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
   };

   const renderMainMenu = () => (
      <motion.div
         variants={containerVariants}
         initial="hidden"
         animate="visible"
         exit="exit"
         className="flex w-full max-w-xl flex-col gap-3 z-10"
      >
         <MenuButton
            icon={<BookOpenText size={20} />}
            title={t('menu.main.difficulty.title')}
            subtitle={t('menu.main.difficulty.subtitle')}
            onClick={() => changeView('DIFFICULTY')}
            primary
         />
         <MenuButton
            icon={<Settings size={20} />}
            title={t('menu.main.options.title')}
            subtitle={t('menu.main.options.subtitle')}
            onClick={() => changeView('OPTIONS')}
         />
         <MenuButton
            icon={<Users size={20} />}
            title={t('menu.main.credits.title')}
            subtitle={t('menu.main.credits.subtitle')}
            onClick={() => changeView('CREDITS')}
         />
         <MenuButton
            icon={<Power size={20} />}
            title={t('menu.main.exit.title')}
            subtitle={t('menu.main.exit.subtitle')}
            onClick={() => {
               audio.init();
               audio.playDeny();
            }}
         />
      </motion.div>
   );

   const renderDifficulty = () => (
      <motion.div
         initial={{ opacity: 0, x: 20 }}
         animate={{ opacity: 1, x: 0 }}
         exit={{ opacity: 0, x: -20 }}
         className="relative w-full rounded-[1.75rem] border border-slate-700 bg-slate-950/88 p-6 shadow-2xl"
      >
         <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
            <X size={24} />
         </button>
         <h2 className="mb-6 border-b border-brand-500/20 pb-4 text-2xl font-mono font-bold text-brand-300">{t('menu.difficultyView.title')}</h2>

         <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto p-1 pr-2 custom-scrollbar md:grid-cols-2">
            {Object.entries(registry.campaigns).map(([campaignId, campaign]) => {
               const resumeSession = resumeSessions[campaignId];
               const canResume = resumeSession?.status === 'active';
               const isAvailable = campaign.levels.length > 0;
               const theme = getCampaignTheme(campaignId);

               return (
                  <motion.div
                     key={campaignId}
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.98 }}
                     onMouseEnter={() => {
                        if (isAvailable) {
                           audio.init();
                           audio.playHover();
                        }
                     }}
                     className="group relative overflow-hidden rounded-2xl border p-4 text-left transition-colors"
                     style={{
                        borderColor: withAlpha(theme.primary, isAvailable ? 0.4 : 0.18),
                        background: `linear-gradient(180deg, ${withAlpha(theme.surface, 0.92)} 0%, rgba(2,6,23,0.94) 100%)`,
                        boxShadow: isAvailable ? `0 18px 50px ${withAlpha(theme.primary, 0.12)}` : 'none',
                        opacity: isAvailable ? 1 : 0.72,
                     }}
                  >
                     <div className="absolute top-0 right-0 p-2 opacity-10 transition-opacity group-hover:opacity-30" style={{ color: theme.secondary }}>
                        <Landmark size={48} />
                     </div>
                     <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="font-mono text-sm font-bold" style={{ color: theme.secondary }}>{t('menu.difficultyView.levelPrefix', { defaultValue: 'GRADE' })} {t(`campaigns.${campaignId}.grade`, { defaultValue: campaignId.split('_')[1] })}</span>
                        <span className="text-slate-500 text-xs tracking-wider">{t(`campaigns.${campaignId}.grade_short`, { defaultValue: campaignId.startsWith('elem') ? 'Elem' : 'HS' })}</span>
                     </div>
                     <h3 className="font-bold text-slate-200 text-lg mb-1 relative z-10">{t(`campaigns.${campaignId}.title`, { defaultValue: `Campaign ${campaignId}` })}</h3>
                     <p className="text-sm text-slate-400 relative z-10">{t(`campaigns.${campaignId}.desc`, { defaultValue: 'Select this protocol to begin.' })}</p>
                     {!isAvailable && (
                        <p className="mt-3 text-xs font-mono uppercase tracking-wider text-slate-400 relative z-10">
                           {t('menu.difficultyView.comingSoon')}
                        </p>
                     )}
                     {canResume && (
                        <p className="mt-3 text-xs font-mono uppercase tracking-wider text-emerald-300 relative z-10">
                           {t('menu.difficultyView.resumeAvailable', { level: resumeSession.levelIndex + 1 })}
                        </p>
                     )}
                     <div className="mt-4 flex gap-2 relative z-10">
                        {canResume && (
                           <button
                              onClick={() => handleStart(campaignId, 'resume')}
                              disabled={!isAvailable}
                              className="flex-1 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-200 transition-colors hover:bg-emerald-500/20"
                           >
                              {t('menu.difficultyView.resumeRun')}
                           </button>
                        )}
                        <button
                           onClick={() => isAvailable && handleStart(campaignId, 'fresh')}
                           disabled={!isAvailable}
                           className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/70 disabled:text-slate-500"
                           style={isAvailable ? { borderColor: withAlpha(theme.primary, 0.45), backgroundColor: withAlpha(theme.primary, 0.12), color: '#f8fafc' } : undefined}
                        >
                           {canResume ? t('menu.difficultyView.startFresh') : t('menu.difficultyView.startRun')}
                        </button>
                     </div>
                  </motion.div>
               )
            })}
         </div>
      </motion.div>
   );

   const renderOptions = () => (
      <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -20 }}
         className="relative w-full rounded-[1.75rem] border border-slate-700 bg-slate-950/88 p-6 shadow-2xl"
      >
         <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
            <X size={24} />
         </button>
         <h2 className="mb-6 border-b border-brand-500/20 pb-4 text-2xl font-mono font-bold text-brand-300">{t('menu.optionsView.title')}</h2>

         <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
               <div>
                  <h3 className="font-bold text-slate-200">{t('menu.optionsView.crt.title')}</h3>
                  <p className="text-sm text-slate-400">{t('menu.optionsView.crt.desc')}</p>
               </div>
               <div
                  onClick={() => updateOption('enableCrt', !options.enableCrt)}
                  className={`w-12 h-6 ${options.enableCrt ? 'bg-brand-500' : 'bg-slate-600'} rounded-full flex items-center p-1 cursor-pointer transition-colors`}
               >
                  <div className={`w-4 h-4 rounded-full bg-white transform transition-transform shadow-sm ${options.enableCrt ? 'translate-x-6' : ''}`} />
               </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
               <div>
                  <h3 className="font-bold text-slate-200 text-left">{t('menu.optionsView.audio.title')}</h3>
                  <p className="text-sm text-slate-400 text-left">{t('menu.optionsView.audio.desc', { volume: options.volume })}</p>
               </div>
               <input
                  type="range"
                  className="w-32 accent-brand-500 cursor-pointer"
                  value={options.volume}
                  onChange={(e) => {
                     const vol = parseInt(e.target.value);
                     updateOption('volume', vol, false);
                     audio.setVolume(vol); // Update audio engine live
                  }}
                  onPointerUp={() => audio.playClick()}
                  min="0" max="100"
               />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
               <div>
                  <h3 className="font-bold text-slate-200 text-left">{t('menu.optionsView.dyslexia.title')}</h3>
                  <p className="text-sm text-slate-400 text-left">{t('menu.optionsView.dyslexia.desc')}</p>
               </div>
               <div
                  onClick={() => updateOption('enableDyslexic', !options.enableDyslexic)}
                  className={`w-12 h-6 ${options.enableDyslexic ? 'bg-brand-500' : 'bg-slate-600'} rounded-full flex items-center p-1 cursor-pointer transition-colors`}
               >
                  <div className={`w-4 h-4 rounded-full bg-white transform transition-transform shadow-sm ${options.enableDyslexic ? 'translate-x-6' : ''}`} />
               </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
               <div>
                  <h3 className="font-bold text-slate-200 text-left">{t('menu.optionsView.language.title')}</h3>
                  <p className="text-sm text-slate-400 text-left">{t('menu.optionsView.language.desc')}</p>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => i18n.changeLanguage('en')} className={`px-3 py-1 rounded text-sm font-bold transition-colors ${i18n.language === 'en' ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>EN</button>
                  <button onClick={() => i18n.changeLanguage('cs')} className={`px-3 py-1 rounded text-sm font-bold transition-colors ${i18n.language === 'cs' ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>CS</button>
               </div>
            </div>
         </div>
      </motion.div>
   );

   const renderCredits = () => (
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         exit={{ opacity: 0, scale: 1.05 }}
         className="relative w-full rounded-[1.75rem] border border-slate-700 bg-slate-950/88 p-6 text-center shadow-2xl"
      >
         <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
            <X size={24} />
         </button>
         <h2 className="mb-8 border-b border-brand-500/20 pb-4 text-2xl font-mono font-bold text-brand-300">{t('menu.creditsView.title')}</h2>

         <div className="space-y-6">
            <div>
               <h3 className="text-slate-400 tracking-widest uppercase text-sm mb-2">{t('menu.creditsView.lead')}</h3>
               <p className="text-xl font-bold text-slate-200 shadow-brand-500/50 drop-shadow-lg">Honza / The User</p>
            </div>
            <div>
               <h3 className="text-slate-400 tracking-widest uppercase text-sm mb-2">{t('menu.creditsView.ai')}</h3>
               <p className="text-xl font-bold text-slate-200">Antigravity 1.20.4</p>
            </div>
            <div className="pt-8">
               <p className="text-sm text-slate-500 italic">{t('menu.creditsView.footer')}</p>
            </div>
         </div>
      </motion.div>
   );

   return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-6 sm:px-6 sm:py-8">
         <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12)_0%,rgba(2,6,23,1)_68%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(51,65,85,0.32)_1px,transparent_1px),linear-gradient(to_bottom,rgba(51,65,85,0.28)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
            <div className="absolute top-16 left-[12%] h-56 w-56 rounded-full bg-amber-500/10 blur-[120px]" />
            <div className="absolute bottom-10 right-[10%] h-64 w-64 rounded-full bg-sky-400/10 blur-[140px]" />
         </div>

         <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <motion.div
               initial={{ opacity: 0, x: -30 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.7, ease: 'easeOut' }}
               className="flex flex-col justify-between rounded-[2rem] border border-slate-700/70 bg-black/35 p-6 shadow-2xl backdrop-blur-sm sm:p-8"
            >
               <div>
                  <div className="inline-flex rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-mono uppercase tracking-[0.26em] text-brand-300">
                     {t('system.version')}
                  </div>
                  <h1 className="mt-6 text-5xl font-black tracking-tight text-white sm:text-6xl xl:text-7xl">
                     {t('system.title')}
                     <span className="mt-2 block text-brand-300">{t('system.os')}</span>
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                     {t('system.subtitle')}
                  </p>
               </div>

               <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <StatusTile label={t('menu.status.activeCampaigns')} value={`${availableCampaigns.length}`} accent="brand" />
                  <StatusTile label={t('menu.status.resumeSlots')} value={`${resumableCampaigns}`} accent="emerald" />
                  <StatusTile label={t('menu.status.interface')} value={options.enableCrt ? t('menu.status.crt') : t('menu.status.clean')} accent="slate" />
               </div>
            </motion.div>

            <div className="rounded-[2rem] border border-slate-700/70 bg-slate-950/80 p-4 shadow-2xl backdrop-blur-md sm:p-6">
               <div className="mb-5 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                  <div>
                     <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-amber-200">{t('menu.commandSurface.title')}</div>
                     <div className="mt-1 text-sm text-slate-400">{t('menu.commandSurface.body')}</div>
                  </div>
                  <div className="hidden rounded-full border border-slate-700 bg-slate-900/85 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 sm:block">
                     {t(`menu.views.${currentView.toLowerCase()}`)}
                  </div>
               </div>

               <AnimatePresence mode="wait">
                  {currentView === 'MAIN' && renderMainMenu()}
                  {currentView === 'DIFFICULTY' && renderDifficulty()}
                  {currentView === 'OPTIONS' && renderOptions()}
                  {currentView === 'CREDITS' && renderCredits()}
               </AnimatePresence>
            </div>
         </div>
      </div>
   );
};

// Reusable menu button component
const MenuButton = ({ icon, title, subtitle, onClick, primary = false }: any) => {
   const baseClass = "group relative flex w-full cursor-pointer items-center overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300";
   const colorClass = primary
      ? "border-amber-400/35 bg-amber-500/10 hover:border-amber-300 hover:bg-amber-500/16 hover:shadow-[0_0_20px_rgba(245,158,11,0.16)]"
      : "border-slate-700 bg-slate-950/82 hover:border-slate-500 hover:bg-slate-900";

   return (
      <motion.button
         variants={{
            hidden: { opacity: 0, x: 20 },
            visible: { opacity: 1, x: 0 }
         }}
         whileHover={{ scale: 1.02, x: 5 }}
         whileTap={{ scale: 0.98 }}
         onClick={onClick}
         onMouseEnter={() => {
            audio.init();
            audio.playHover();
         }}
         className={`${baseClass} ${colorClass}`}
      >
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

         <div className={`mr-4 rounded-xl p-3 ${primary ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'}`}>
            {icon}
         </div>

         <div className="flex-1">
            <h3 className={`text-lg font-bold ${primary ? 'text-amber-100' : 'text-slate-100'}`}>{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
         </div>

         <ChevronRight className={`transition-transform duration-300 transform group-hover:translate-x-2 ${primary ? 'text-amber-300' : 'text-slate-600'}`} />
      </motion.button>
   );
};

const StatusTile = ({ label, value, accent }: { label: string; value: string; accent: 'brand' | 'emerald' | 'slate' }) => {
   const accentClass = accent === 'brand'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
      : accent === 'emerald'
         ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
         : 'border-slate-700 bg-slate-950/80 text-slate-200';

   return (
      <div className={`rounded-2xl border px-4 py-4 ${accentClass}`}>
         <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">{label}</div>
         <div className="mt-2 text-2xl font-semibold">{value}</div>
      </div>
   );
};
