import * as Tone from 'tone';

class AudioEngine {
  private synths: {
    ui: Tone.PolySynth;
    fx: Tone.FMSynth;
    bass: Tone.MembraneSynth;
  } | null = null;

  isReady = false;

  async init() {
    if (this.isReady) return;
    
    // Resume audio context
    await Tone.start();
    
    // Initialize synthesizers
    this.synths = {
      ui: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
      }).toDestination(),
      
      fx: new Tone.FMSynth({
        harmonicity: 8,
        modulationIndex: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.2 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }
      }).toDestination(),

      bass: new Tone.MembraneSynth().toDestination()
    };
    
    // Master volume levels
    this.synths.ui.volume.value = -12;
    this.synths.fx.volume.value = -15;
    this.synths.bass.volume.value = -10;
    
    // Set global tone volume (default 80%)
    Tone.Destination.volume.value = Tone.gainToDb(0.8);

    this.isReady = true;
  }

  setVolume(percentage: number) {
    // percentage is 0 to 100
    if (percentage <= 0) {
       Tone.Destination.mute = true;
    } else {
       Tone.Destination.mute = false;
       Tone.Destination.volume.value = Tone.gainToDb(percentage / 100);
    }
  }

  // --- UI Sound Effects ---

  playHover() {
    if (!this.isReady || !this.synths) return;
    try {
        this.synths.ui.triggerAttackRelease("C3", "32n");
    } catch(e) {}
  }

  playClick() {
    if (!this.isReady || !this.synths) return;
    try {
        this.synths.ui.triggerAttackRelease("G3", "16n");
    } catch(e) {}
  }

  // --- Game State Sound Effects ---

  playSuccess() {
     if (!this.isReady || !this.synths) return;
     try {
         const now = Tone.now();
         this.synths.ui.triggerAttackRelease("C3", "8n", now);
         this.synths.ui.triggerAttackRelease("E3", "8n", now + 0.1);
         this.synths.ui.triggerAttackRelease("G3", "8n", now + 0.2);
         this.synths.ui.triggerAttackRelease("C4", "4n", now + 0.3);
     } catch(e) {}
  }

  playDeny() {
      if (!this.isReady || !this.synths) return;
      try {
          this.synths.bass.triggerAttackRelease("C1", "8n");
          setTimeout(() => {
              if (this.synths) this.synths.bass.triggerAttackRelease("C1", "8n");
          }, 150);
      } catch(e) {}
  }

  playTyping() {
      if (!this.isReady || !this.synths) return;
      try {
          // Much lower mechanical click sound
          const freq = Math.random() * 200 + 400;
          this.synths.ui.triggerAttackRelease(Tone.Frequency(freq).toNote(), "64n");
      } catch(e) {}
  }

  playItemFound() {
      if (!this.isReady || !this.synths) return;
      try {
          const now = Tone.now();
          this.synths.fx.triggerAttackRelease("C3", "4n", now);
          this.synths.fx.triggerAttackRelease("C4", "4n", now + 0.1);
          this.synths.fx.triggerAttackRelease("G4", "2n", now + 0.2);
      } catch(e) {}
  }
}

export const audio = new AudioEngine();
