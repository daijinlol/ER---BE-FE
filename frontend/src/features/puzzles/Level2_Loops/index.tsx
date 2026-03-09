import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';

const AVAILABLE_COMMANDS = ['A', 'B', 'C', 'D'];

export default function Level2_Loops() {
  const { t } = useTranslation();
  const { validate, isChecking, error } = usePuzzleValidation('elem_6', '2');
  
  const [iterations, setIterations] = useState<number | ''>('');
  const [commands, setCommands] = useState<string[]>([]);
  const [doorStatus, setDoorStatus] = useState<'LOCKED' | 'TESTING' | 'DENIED' | 'OPEN'>('LOCKED');

  const handleCommandAdd = (cmd: string) => {
     if (commands.length < 4) {
         audio.playClick();
         setCommands([...commands, cmd]);
     }
  };

  const handleClear = () => {
      audio.playHover();
      setCommands([]);
      setIterations('');
      setDoorStatus('LOCKED');
  };

  const handleExecute = async () => {
    if (commands.length === 0 || iterations === '') return;
    
    audio.playClick();
    setDoorStatus('TESTING');

    const check = await validate({ type: 'LOOP', iterations: Number(iterations), commands });

    if (check.success) {
       audio.playSuccess();
       setDoorStatus('OPEN');
       setTimeout(() => {
          gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
       }, 3000);
    } else {
       audio.playDeny();
       setDoorStatus('DENIED');
       setTimeout(() => setDoorStatus('LOCKED'), 2000);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-8 bg-slate-900 border border-slate-700/50 rounded-xl font-mono text-slate-200">
        
       {/* Header */}
       <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-widest text-brand-400">
               {t('level2.title', { defaultValue: 'BLAST DOOR OVERRIDE MODULE' })}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
               {t('level2.subtitle', { defaultValue: 'TASK: Buffer sequence requires 100 execution cycles to force-open the hydraulic lock.' })}
            </p>
          </div>
          
          {/* Status Indicator */}
          <div className="flex flex-col items-center">
             {doorStatus === 'OPEN' ? (
                <Shield className="text-green-400 w-12 h-12" />
             ) : doorStatus === 'LOCKED' ? (
                <ShieldAlert className="text-red-500 w-12 h-12" />
             ) : (
                <ShieldAlert className="text-yellow-500 w-12 h-12 animate-pulse" />
             )}
             <span className={`text-xs font-bold mt-2 tracking-widest ${doorStatus === 'OPEN' ? 'text-green-400' : doorStatus === 'LOCKED' ? 'text-red-500' : 'text-yellow-500'}`}>
                {doorStatus}
             </span>
          </div>
       </div>

       {/* Editor Window */}
       <div className="flex-1 grid grid-cols-2 gap-8">
           
           {/* Left Panel: Available Commands */}
           <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 mb-4 tracking-widest">AVAILABLE INSTRUCTIONS</h3>
              <div className="grid grid-cols-2 gap-4">
                 {AVAILABLE_COMMANDS.map(cmd => (
                    <button
                       key={cmd}
                       disabled={doorStatus === 'OPEN' || commands.length >= 4}
                       onClick={() => handleCommandAdd(cmd)}
                       className="p-4 bg-surface-dark border-2 border-slate-700 rounded hover:border-brand-500 hover:text-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
                    >
                       PRESS {cmd}
                    </button>
                 ))}
              </div>
           </div>

           {/* Right Panel: Script Editor */}
           <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col relative overflow-hidden">
               <h3 className="text-sm font-bold text-slate-400 mb-4 tracking-widest border-b border-slate-700 pb-2 flex justify-between">
                  <span>OVERRIDE SCRIPT</span>
                  <button onClick={handleClear} disabled={doorStatus === 'OPEN'} className="text-slate-500 hover:text-red-400 flex items-center gap-1">
                     <RotateCcw size={14} /> CLR
                  </button>
               </h3>

               {/* Loop Block */}
               <div className="bg-indigo-900/30 border-2 border-indigo-500/50 rounded-lg p-4 mt-4 flex-1 flex flex-col">
                   <div className="flex items-center gap-4 text-indigo-300 font-bold tracking-widest mb-4">
                       <span className="bg-indigo-500/20 px-2 py-1 rounded">REPEAT</span>
                       <input 
                         type="number" 
                         value={iterations}
                         onChange={(e) => setIterations(Number(e.target.value))}
                         disabled={doorStatus === 'OPEN'}
                         className="w-24 bg-slate-900 border-b-2 border-indigo-400 focus:outline-none focus:border-brand-400 text-center text-xl text-white py-1"
                         placeholder="1-999"
                       />
                       <span>TIMES</span>
                   </div>

                   <div className="flex-1 bg-black/50 border border-slate-700/50 rounded p-4 flex flex-col gap-2">
                       {commands.length === 0 ? (
                           <span className="text-slate-600 italic">Empty loop body. Add instructions...</span>
                       ) : (
                           commands.map((cmd, idx) => (
                               <motion.div 
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                  className="bg-brand-900/40 border border-brand-500/50 text-brand-200 p-2 rounded flex items-center gap-3"
                               >
                                  <span className="text-brand-500 opacity-50">{idx + 1}.</span>
                                  <span className="font-bold">PRESS {cmd}</span>
                               </motion.div>
                           ))
                       )}
                   </div>
               </div>
               
               {/* Controls */}
               <div className="mt-6 flex flex-col gap-2">
                   {error && <div className="text-red-400 text-xs text-center animate-pulse">{error}</div>}
                   {doorStatus === 'DENIED' && <div className="text-red-500 text-xs text-center font-bold">ERROR: HYDRAULIC LOCK REFUSED SEQUENCE</div>}
                   
                   <button 
                      onClick={handleExecute}
                      disabled={isChecking || commands.length === 0 || iterations === '' || doorStatus === 'OPEN'}
                      className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                   >
                      {isChecking || doorStatus === 'TESTING' ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                          <Play size={20} fill="currentColor" />
                      )}
                      <span>EXECUTE SCRIPT</span>
                   </button>
               </div>
           </div>
       </div>
    </div>
  );
}
