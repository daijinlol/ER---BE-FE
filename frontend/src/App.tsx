import { startTransition, useCallback, useEffect, useState } from 'react';
import { GameContainer } from './core/GameContainer';
import { clearStoredSession, type CampaignSessionSnapshot } from './core/GameSession';
import { MainMenu } from './core/MainMenu';
import { deleteSessionSnapshot, listPersistedSessions, restoreSessionSnapshot } from './core/sessionApi';

type AppState = 'MENU' | 'PLAYING';

export interface AppOptions {
  volume: number;
  enableCrt: boolean;
  enableDyslexic: boolean;
}

function App() {
  const [appState, setAppState] = useState<AppState>('MENU');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('elem_6');
  const [initialSession, setInitialSession] = useState<CampaignSessionSnapshot | null>(null);
  const [storedSessions, setStoredSessions] = useState<Record<string, CampaignSessionSnapshot>>({});
  const [options, setOptions] = useState<AppOptions>({
    volume: 80,
    enableCrt: true,
    enableDyslexic: false,
  });

  const refreshStoredSessions = useCallback(async () => {
    return listPersistedSessions();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void refreshStoredSessions()
      .then((sessions) => {
        if (!cancelled) {
          startTransition(() => {
            setStoredSessions(sessions);
          });
        }
      })
      .catch((error) => {
        console.error('Failed to refresh stored sessions:', error);
        if (!cancelled) {
          startTransition(() => {
            setStoredSessions({});
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshStoredSessions]);

  const handleStart = async (campaignId: string, mode: 'fresh' | 'resume' = 'fresh') => {
    const nextSession = mode === 'resume' ? await restoreSessionSnapshot(campaignId) : null;
    if (mode === 'fresh') {
      clearStoredSession(campaignId);
      await deleteSessionSnapshot(campaignId).catch((error) => {
        console.error('Failed to clear persisted session before fresh start:', error);
      });
    }

    startTransition(() => {
      setInitialSession(nextSession);
      setSelectedCampaign(campaignId);
      setAppState('PLAYING');
    });
  };

  const handleExit = () => {
    startTransition(() => {
      setInitialSession(null);
      setAppState('MENU');
    });

    void refreshStoredSessions()
      .then((sessions) => {
        startTransition(() => {
          setStoredSessions(sessions);
        });
      })
      .catch((error) => {
        console.error('Failed to refresh stored sessions:', error);
      });
  };

  return (
    <div className={`antialiased selection:bg-brand-500/30 w-full h-full min-h-screen ${options.enableDyslexic ? 'font-dyslexic' : 'font-sans'} ${options.enableCrt ? 'crt-effect' : ''}`}>
      {appState === 'MENU' && (
        <MainMenu
          onStart={handleStart}
          resumeSessions={storedSessions}
          options={options}
          onOptionsChange={setOptions}
        />
      )}
      {appState === 'PLAYING' && (
        <GameContainer
          campaignId={selectedCampaign}
          initialSession={initialSession}
          onExit={handleExit}
        />
      )}
    </div>
  );
}

export default App;
