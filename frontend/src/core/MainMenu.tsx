import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Settings, Users, Power, ChevronRight, X, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from './AudioEngine';
import registry from '../features/puzzles/registry.json';

type MenuView = 'MAIN' | 'OPTIONS' | 'CREDITS' | 'DIFFICULTY';

interface MainMenuProps {
  onStart: (campaignId: string) => void;
  options: { volume: number; enableCrt: boolean; enableDyslexic: boolean };
  onOptionsChange: (options: any) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, options, onOptionsChange }) => {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<MenuView>('MAIN');

  const handleStart = async (campaignId: string) => {
    await audio.init();
    audio.playSuccess();
    onStart(campaignId);
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
      className="flex flex-col gap-4 w-full max-w-md z-10"
    >
      <MenuButton 
        icon={<Terminal size={20} />} 
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
      className="w-full max-w-2xl bg-surface-dark/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 z-10 shadow-2xl relative"
    >
      <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
        <X size={24} />
      </button>
      <h2 className="text-2xl font-mono font-bold text-brand-400 mb-6 border-b border-brand-500/30 pb-4">{t('menu.difficultyView.title')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 pb-6 custom-scrollbar">
         {Object.entries(registry.campaigns).map(([campaignId]) => (
             <motion.button
                key={campaignId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStart(campaignId)}
                onMouseEnter={() => { audio.init(); audio.playHover(); }}
                className="text-left bg-slate-800/50 hover:bg-brand-500/20 border border-slate-700 border-l-4 border-l-brand-500 p-4 rounded hover:border-brand-500 transition-colors group relative overflow-hidden"
             >
                 <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                    <ShieldAlert size={48} />
                 </div>
                 <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className="text-brand-400 font-mono text-sm font-bold">{t('menu.difficultyView.levelPrefix', { defaultValue: 'GRADE' })} {t(`campaigns.${campaignId}.grade`, { defaultValue: campaignId.split('_')[1] })}</span>
                    <span className="text-slate-500 text-xs tracking-wider">{t(`campaigns.${campaignId}.grade_short`, { defaultValue: campaignId.startsWith('elem') ? 'Elem' : 'HS' })}</span>
                 </div>
                 <h3 className="font-bold text-slate-200 text-lg mb-1 relative z-10">{t(`campaigns.${campaignId}.title`, { defaultValue: `Campaign ${campaignId}` })}</h3>
                 <p className="text-slate-400 text-sm relative z-10">{t(`campaigns.${campaignId}.desc`, { defaultValue: 'Select this protocol to begin.' })}</p>
             </motion.button>
         ))}
      </div>
    </motion.div>
  );

  const renderOptions = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl bg-surface-dark/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 z-10 shadow-2xl relative"
    >
      <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
        <X size={24} />
      </button>
      <h2 className="text-2xl font-mono font-bold text-brand-400 mb-6 border-b border-brand-500/30 pb-4">{t('menu.optionsView.title')}</h2>
      
      <div className="space-y-6">
         <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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
         
         <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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
         
         <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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

         <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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
      className="w-full max-w-2xl bg-surface-dark/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 z-10 shadow-2xl relative text-center"
    >
       <button onClick={() => changeView('MAIN')} className="absolute top-4 right-4 text-slate-400 hover:text-brand-400 transition-colors">
        <X size={24} />
      </button>
      <h2 className="text-2xl font-mono font-bold text-brand-400 mb-8 border-b border-brand-500/30 pb-4">{t('menu.creditsView.title')}</h2>
      
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
    <div className="relative w-full h-screen overflow-hidden bg-bg-dark flex items-center justify-center">
      
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,rgba(15,23,42,1)_100%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Tech Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      {/* Main Content Area */}
      <div className="z-10 w-full h-full flex flex-col md:flex-row items-center justify-center max-w-7xl mx-auto p-8 gap-16 md:gap-32">
        
        {/* Left Side: Branding/Title */}
        <motion.div 
           initial={{ opacity: 0, x: -50 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.8, ease: "easeOut" }}
           className="flex-1 text-center md:text-left"
        >
           <motion.div 
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.2, duration: 0.5 }}
             className="inline-block bg-brand-500/10 border border-brand-500/30 text-brand-400 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest mb-6"
           >
              {t('system.version')}
           </motion.div>
           <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 tracking-tight leading-tight mb-4 drop-shadow-2xl">
              {t('system.title')}<br />
              <span className="text-brand-500">{t('system.os')}</span>
           </h1>
           <p className="text-slate-400 text-lg md:text-xl max-w-lg mx-auto md:mx-0 font-medium">
              {t('system.subtitle')}
           </p>
        </motion.div>

        {/* Right Side: Interactive Menu */}
        <div className="flex-1 flex justify-center md:justify-end w-full">
           <AnimatePresence mode="wait">
              {currentView === 'MAIN' && renderMainMenu()}
              {currentView === 'DIFFICULTY' && renderDifficulty()}
              {currentView === 'OPTIONS' && renderOptions()}
              {currentView === 'CREDITS' && renderCredits()}
           </AnimatePresence>
        </div>

      </div>
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-brand-500/50 m-8 z-0" />
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-brand-500/50 m-8 z-0" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-brand-500/50 m-8 z-0" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-brand-500/50 m-8 z-0" />
    </div>
  );
};

// Reusable menu button component
const MenuButton = ({ icon, title, subtitle, onClick, primary = false }: any) => {
   const baseClass = "group relative w-full flex items-center p-4 rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer text-left";
   const colorClass = primary 
      ? "bg-brand-500/10 border-brand-500/50 hover:bg-brand-500/20 hover:border-brand-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
      : "bg-surface-dark/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-500";

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
         
         <div className={`mr-4 p-3 rounded-lg ${primary ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
            {icon}
         </div>
         
         <div className="flex-1">
            <h3 className={`font-bold text-lg ${primary ? 'text-brand-300' : 'text-slate-200'}`}>{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
         </div>

         <ChevronRight className={`transition-transform duration-300 transform group-hover:translate-x-2 ${primary ? 'text-brand-400' : 'text-slate-600'}`} />
      </motion.button>
   );
};
