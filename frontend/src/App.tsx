import { useState } from 'react';
import { GameContainer } from './core/GameContainer';
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
  const [options, setOptions] = useState<AppOptions>({
    volume: 80,
    enableCrt: true,
    enableDyslexic: false,
  });

  return (
    <div className={`antialiased selection:bg-brand-500/30 w-full h-full min-h-screen ${options.enableDyslexic ? 'font-dyslexic' : 'font-sans'} ${options.enableCrt ? 'crt-effect' : ''}`}>
      {appState === 'MENU' && (
          <MainMenu 
             onStart={(campaignId) => { setSelectedCampaign(campaignId); setAppState('PLAYING'); }} 
             options={options}
             onOptionsChange={setOptions}
          />
      )}
      {appState === 'PLAYING' && <GameContainer campaignId={selectedCampaign} />}
    </div>
  );
}

export default App;
