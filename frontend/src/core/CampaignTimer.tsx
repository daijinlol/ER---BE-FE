import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { gameEvents } from './EventBus';

interface CampaignTimerProps {
  initialMinutes: number;
}

export const CampaignTimer: React.FC<CampaignTimerProps> = ({ initialMinutes }) => {
  const [timeLeft, setTimeLeft] = useState<number>(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(true);

  useEffect(() => {
    // Listen for campaign success or failure to stop timer
    const unsubscribeSuccess = gameEvents.subscribe('CAMPAIGN_COMPLETED', () => setIsRunning(false));
    const unsubscribeFail = gameEvents.subscribe('CAMPAIGN_FAILED', () => setIsRunning(false));
    const unsubscribePenalty = gameEvents.subscribe('TIME_PENALTY', (payload: any) => {
      const penaltySeconds = payload?.seconds || 120; // Default 2 minutes
      setTimeLeft((prev) => Math.max(0, prev - penaltySeconds));
    });

    return () => {
      unsubscribeSuccess();
      unsubscribeFail();
      unsubscribePenalty();
    };
  }, []);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
       if (timeLeft <= 0 && isRunning) {
          gameEvents.publish('CAMPAIGN_FAILED', { reason: 'TIME_EXPIRED' });
          setIsRunning(false);
       }
       return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const isWarning = timeLeft < 300; // Under 5 minutes
  const isCritical = timeLeft < 60; // Under 1 minute

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-mono font-bold text-lg shadow-xl backdrop-blur-md transition-colors duration-1000
       ${isCritical 
          ? 'bg-red-900/50 border-red-500 text-red-100 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
          : isWarning
          ? 'bg-yellow-900/50 border-yellow-500 text-yellow-100'
          : 'bg-slate-900/80 border-slate-700 text-slate-300'
       }`}
    >
      <Clock className={`${isCritical ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-slate-400'}`} size={20} />
      <span className="tracking-widest">
         {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
