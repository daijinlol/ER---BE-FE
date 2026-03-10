import { startTransition, useState } from 'react';
import { GameContainer } from './core/GameContainer';
import { clearStoredSession, getStoredSession, loadStoredSessions, type CampaignSessionSnapshot } from './core/GameSession';
import { MainMenu } from './core/MainMenu';

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
  const [storedSessions, setStoredSessions] = useState(loadStoredSessions());
  const [options, setOptions] = useState<AppOptions>({
    volume: 80,
    enableCrt: true,
    enableDyslexic: false,
  });

  const handleStart = (campaignId: string, mode: 'fresh' | 'resume' = 'fresh') => {
    const nextSession = mode === 'resume' ? getStoredSession(campaignId) : null;
    if (mode === 'fresh') {
      clearStoredSession(campaignId);
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
      setStoredSessions(loadStoredSessions());
      setAppState('MENU');
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
