import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { gameEvents } from './EventBus';
import { DEFAULT_TIME_PENALTY_SECONDS, TIMER_CRITICAL_SECONDS, TIMER_WARNING_SECONDS } from './gameConstants';
import { cacheStoredSessionTimeLeft, useGameSession } from './GameSession';
import { updateSessionTimer } from './sessionApi';

const TIMER_PERSIST_INTERVAL_SECONDS = 10;

export const CampaignTimer: React.FC = () => {
  const { session } = useGameSession();
  const [timeLeft, setTimeLeft] = useState<number>(session.timeLeftSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const timeLeftRef = useRef(session.timeLeftSeconds);
  const lastPersistedRef = useRef(session.timeLeftSeconds);

  const persistTimeLeft = useCallback((nextTimeLeft: number) => {
    cacheStoredSessionTimeLeft(session.campaignId, session.sessionId, nextTimeLeft);
    void updateSessionTimer(session.campaignId, session.sessionId, nextTimeLeft).catch(() => {
      // Ignore persistence errors and keep the live timer running.
    });
  }, [session.campaignId, session.sessionId]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    // Listen for campaign success or failure to stop timer
    const unsubscribeSuccess = gameEvents.subscribe('CAMPAIGN_COMPLETED', () => setIsRunning(false));
    const unsubscribeFail = gameEvents.subscribe('CAMPAIGN_FAILED', () => setIsRunning(false));
    const unsubscribePenalty = gameEvents.subscribe('TIME_PENALTY', (payload) => {
      const penaltySeconds = payload?.seconds || DEFAULT_TIME_PENALTY_SECONDS;
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - penaltySeconds);
        timeLeftRef.current = next;
        lastPersistedRef.current = next;
        persistTimeLeft(next);
        return next;
      });
    });

    return () => {
      unsubscribeSuccess();
      unsubscribeFail();
      unsubscribePenalty();
    };
  }, [persistTimeLeft]);

  useEffect(() => {
    if (!isRunning) {
      persistTimeLeft(timeLeftRef.current);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1);
        timeLeftRef.current = next;

        if (next <= 0) {
          gameEvents.publish('CAMPAIGN_FAILED', { reason: 'TIME_EXPIRED' });
          setIsRunning(false);
        }

        if (
          lastPersistedRef.current - next >= TIMER_PERSIST_INTERVAL_SECONDS
          || next <= 0
        ) {
          persistTimeLeft(next);
          lastPersistedRef.current = next;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, persistTimeLeft]);

  useEffect(() => {
    return () => {
      persistTimeLeft(timeLeftRef.current);
    };
  }, [persistTimeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isWarning = timeLeft < TIMER_WARNING_SECONDS;
  const isCritical = timeLeft < TIMER_CRITICAL_SECONDS;

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
