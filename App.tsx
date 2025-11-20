import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Visualizer from './components/Visualizer';
import { generateSpeech } from './services/gemini';
import { pcmToAudioBuffer, createWavBlob } from './utils/audio';
import { AudioState } from './types';
import { Play, Square, Download, Loader2, AlertCircle, Music } from 'lucide-react';

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [state, setState] = useState<AudioState>({
    isGenerating: false,
    isPlaying: false,
    audioBuffer: null,
    error: null,
    duration: 0,
    currentTime: 0
  });
  const [useAmbience, setUseAmbience] = useState<boolean>(true);

  // Web Audio API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const ambienceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startOffsetRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Initialize Audio Context
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 }); // Match Gemini TTS rate usually
      audioContextRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const gain = ctx.createGain();
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      gainNodeRef.current = gain;
    }

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (!apiKey) {
        setState(s => ({ ...s, error: "Please configure your API Key in the environment or code." }));
        return;
    }

    // Stop any current playback
    stopAudio();
    setState(s => ({ ...s, isGenerating: true, error: null, audioBuffer: null }));

    try {
      const pcmData = await generateSpeech(text, apiKey);
      
      if (audioContextRef.current) {
        const buffer = pcmToAudioBuffer(pcmData, audioContextRef.current);
        setState(s => ({
          ...s,
          isGenerating: false,
          audioBuffer: buffer,
          duration: buffer.duration
        }));
      }
    } catch (err: any) {
      setState(s => ({ ...s, isGenerating: false, error: err.message }));
    }
  };

  const togglePlayback = () => {
    if (state.isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  };

  const playAudio = async () => {
    if (!state.audioBuffer || !audioContextRef.current || !gainNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Main Speech Source
    const source = ctx.createBufferSource();
    source.buffer = state.audioBuffer;
    source.connect(gainNodeRef.current);
    sourceNodeRef.current = source;

    // Ambient Background Source (Simulated Drone)
    if (useAmbience) {
        const ambSource = ctx.createBufferSource();
        // Create 5 seconds of noise loop
        const sampleRate = ctx.sampleRate;
        const ambBuffer = ctx.createBuffer(2, sampleRate * 5, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
             const data = ambBuffer.getChannelData(channel);
             for (let i = 0; i < data.length; i++) {
                 // Low frequency drone + slight crackle
                 data[i] = (Math.sin(i * 0.01) * 0.05) + ((Math.random() - 0.5) * 0.005);
             }
        }
        ambSource.buffer = ambBuffer;
        ambSource.loop = true;
        // Low volume for ambience
        const ambGain = ctx.createGain();
        ambGain.gain.value = 0.15; 
        ambSource.connect(ambGain);
        ambGain.connect(ctx.destination);
        ambienceNodeRef.current = ambSource;
        ambSource.start(0, startOffsetRef.current % 5); // Offset to match
    }

    source.onended = () => {
      if (Math.abs(ctx.currentTime - startTimeRef.current - state.duration) < 0.1) {
         // Finished naturally
         stopAudio(true);
      }
    };

    source.start(0, startOffsetRef.current);
    startTimeRef.current = ctx.currentTime - startOffsetRef.current;
    
    setState(s => ({ ...s, isPlaying: true }));
    
    // Update progress UI
    const updateProgress = () => {
        if (ctx.state === 'running') {
            const current = ctx.currentTime - startTimeRef.current;
            setState(s => ({ ...s, currentTime: Math.min(current, s.duration) }));
            rafRef.current = requestAnimationFrame(updateProgress);
        }
    };
    rafRef.current = requestAnimationFrame(updateProgress);
  };

  const stopAudio = (reset = false) => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if (ambienceNodeRef.current) {
       try { ambienceNodeRef.current.stop(); } catch(e) {}
       ambienceNodeRef.current = null;
    }
    if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
    }

    if (reset) {
        startOffsetRef.current = 0;
        setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
    } else {
        // Pause logic
        if (audioContextRef.current) {
            startOffsetRef.current = audioContextRef.current.currentTime - startTimeRef.current;
        }
        setState(s => ({ ...s, isPlaying: false }));
    }
  };

  const handleDownload = () => {
    if (!state.audioBuffer) return;
    const wavBlob = createWavBlob(state.audioBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aawaz-narration-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-natgeo-black flex flex-col items-center relative overflow-hidden">
       {/* Ambient Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_#2c2a1e_0%,_#111111_60%)] z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col p-6 gap-8">
        <Header />

        {/* Main Card */}
        <div className="bg-natgeo-gray/40 backdrop-blur-sm border border-natgeo-gray rounded-2xl p-6 shadow-2xl">
          
          {/* Input Area */}
          <div className="space-y-2 mb-6">
            <label className="text-xs font-semibold tracking-widest text-natgeo-yellow uppercase">
              Narration Script
            </label>
            <textarea
              className="w-full h-32 bg-black/20 border border-natgeo-gray rounded-lg p-4 text-lg font-serif text-white focus:outline-none focus:border-natgeo-yellow transition-colors resize-none placeholder-white/20 leading-relaxed"
              placeholder="Enter text here... (e.g. The tiger walks slowly through the dense jungle, its eyes fixed on the prey...)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <button
              onClick={() => setUseAmbience(!useAmbience)}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all ${
                  useAmbience ? 'bg-white/10 text-natgeo-yellow' : 'bg-transparent text-white/30 hover:text-white'
              }`}
             >
                <Music className="w-4 h-4" />
                {useAmbience ? 'Ambience On' : 'Ambience Off'}
             </button>

            <div className="flex gap-3 w-full md:w-auto">
                <button
                    onClick={handleGenerate}
                    disabled={state.isGenerating || !text}
                    className="flex-1 md:flex-none bg-natgeo-yellow hover:bg-yellow-400 text-black font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,199,0,0.2)]"
                >
                    {state.isGenerating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                    </>
                    ) : (
                    "Generate Narration"
                    )}
                </button>
            </div>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {state.error}
            </div>
          )}
        </div>

        {/* Player Section */}
        {state.audioBuffer && (
            <div className="bg-natgeo-gray/40 backdrop-blur-sm border border-natgeo-gray rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-semibold tracking-widest text-natgeo-yellow uppercase">
                        Preview
                    </div>
                    <div className="text-xs font-mono text-natgeo-light/50">
                        {formatTime(state.currentTime)} / {formatTime(state.duration)}
                    </div>
                </div>

                <Visualizer analyser={analyserRef.current} isPlaying={state.isPlaying} />

                <div className="flex items-center gap-4 mt-6">
                    <button
                        onClick={togglePlayback}
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-natgeo-yellow transition-colors"
                    >
                        {state.isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>

                    <div className="h-1 bg-white/10 flex-1 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-natgeo-yellow transition-all duration-100 ease-linear"
                            style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
                        />
                    </div>

                    <button
                        onClick={handleDownload}
                        className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-natgeo-light transition-colors group"
                        title="Download WAV"
                    >
                        <Download className="w-5 h-5 group-hover:text-natgeo-yellow transition-colors" />
                    </button>
                </div>
            </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-4 text-natgeo-light/20 text-[10px] font-mono">
         POWERED BY GOOGLE GEMINI 2.5 TTS
      </div>
    </div>
  );
};

export default App;
