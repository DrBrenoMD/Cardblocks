import React, { useState, useEffect, useRef } from 'react';
import { Timer, Clock, Activity, Play, Pause, RotateCcw, Volume2, VolumeX, ChevronDown, ChevronUp, Settings2, Cloud, CloudUpload, CloudDownload, LogIn, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const TopBarTools: React.FC = () => {
  const [activePopover, setActivePopover] = useState<'pomodoro' | 'countdown' | 'metronome' | 'cloud' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePopover]);

  // Pomodoro
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [pomoTime, setPomoTime] = useState(workDuration * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState<'work' | 'break'>('work');

  // Countdown
  const [countdownInput, setCountdownInput] = useState(5);
  const [countdownTime, setCountdownTime] = useState(5 * 60);
  const [countdownActive, setCountdownActive] = useState(false);

  // Metronome (Pacer)
  const [metroTotal, setMetroTotal] = useState(90);
  const [metroTimeLeft, setMetroTimeLeft] = useState(90);
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [showMetroAdvanced, setShowMetroAdvanced] = useState(false);

  const [tickSound, setTickSound] = useState(true);
  const [dingSound, setDingSound] = useState(true);
  const [tickVolume, setTickVolume] = useState(20);
  const [dingVolume, setDingVolume] = useState(100);
  const [tickType, setTickType] = useState<'beep' | 'wood'>('wood');

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerWorkerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pomoActive && pomoTime > 0) {
      interval = setInterval(() => setPomoTime(t => t - 1), 1000);
    } else if (pomoTime === 0 && pomoActive) {
      setPomoActive(false);
      alert(pomoMode === 'work' ? 'Work session complete! Take a break.' : 'Break time over! Back to work.');
      if (pomoMode === 'work') {
        setPomoMode('break');
        setPomoTime(breakDuration * 60);
      } else {
        setPomoMode('work');
        setPomoTime(workDuration * 60);
      }
    }
    return () => clearInterval(interval);
  }, [pomoActive, pomoTime, pomoMode, breakDuration, workDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownActive && countdownTime > 0) {
      interval = setInterval(() => setCountdownTime(t => t - 1), 1000);
    } else if (countdownTime === 0 && countdownActive) {
      setCountdownActive(false);
      alert('Timer finished!');
    }
    return () => clearInterval(interval);
  }, [countdownActive, countdownTime]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (metronomeActive) {
      if (!audioCtxRef.current) {
         const AudioC = window.AudioContext || (window as any).webkitAudioContext;
         if (AudioC) audioCtxRef.current = new AudioC();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') ctx.resume();

      // Start timing
      const lookahead = 25.0; // ms
      const scheduleAheadTime = 0.1; // s
      
      if (ctx && nextNoteTimeRef.current === 0) {
        nextNoteTimeRef.current = ctx.currentTime + 0.05;
      }

      const scheduleNote = (time: number, tLeft: number) => {
         if (!ctx) return;
         if (!tickSound && tLeft > 1) return;
         if (!dingSound && tLeft <= 1) return;

         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.connect(gain);
         gain.connect(ctx.destination);
         
         const vDing = dingVolume / 100;
         const vTick = tickVolume / 100;

         if (tLeft <= 1) { // Ding
           osc.frequency.value = 880; 
           gain.gain.setValueAtTime(vDing, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
           osc.start(time);
           osc.stop(time + 0.5);
         } else if (tLeft <= 4) { // Warning ticks
           osc.frequency.value = tickType === 'beep' ? 600 : 300;
           osc.type = tickType === 'beep' ? 'sine' : 'square';
           gain.gain.setValueAtTime(vTick * 1.5, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
           osc.start(time);
           osc.stop(time + 0.1);
         } else { // Normal tick
           osc.frequency.value = tickType === 'beep' ? 400 : 200;
           osc.type = tickType === 'beep' ? 'sine' : 'square';
           gain.gain.setValueAtTime(vTick, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
           osc.start(time);
           osc.stop(time + 0.1);
         }
      };

      const scheduler = () => {
         if (ctx) {
           while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
             setMetroTimeLeft(t => {
               const newT = t <= 1 ? metroTotal : t - 1;
               scheduleNote(nextNoteTimeRef.current, t);
               return newT;
             });
             nextNoteTimeRef.current += 1.0; // accurate 1 second later
           }
         } else {
           // fallback for browsers without web audio
           setMetroTimeLeft(t => t <= 1 ? metroTotal : t - 1);
         }
         timerWorkerRef.current = setTimeout(scheduler, lookahead);
       };

       scheduler();
       
    } else {
       if (timerWorkerRef.current) clearTimeout(timerWorkerRef.current);
       nextNoteTimeRef.current = 0;
    }

    return () => {
      if (timerWorkerRef.current) clearTimeout(timerWorkerRef.current);
    };
  }, [metronomeActive, metroTotal, tickSound, dingSound, tickVolume, dingVolume, tickType]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePopover = (name: 'pomodoro' | 'countdown' | 'metronome' | 'cloud') => {
    setActivePopover(activePopover === name ? null : name);
  };

  const handleUpload = async () => {};
  const handleDownload = async () => {};

  return (
    <div className="relative flex items-center gap-1 sm:gap-2 mr-2" ref={containerRef}>
      <button
        onClick={() => togglePopover('pomodoro')}
        className={cn("p-1.5 rounded-md flex items-center gap-1 text-sm font-medium transition-colors", activePopover === 'pomodoro' || pomoActive ? "bg-amber-500/10 text-amber-500" : "text-ui-muted hover:bg-ui-surface")}
        title="Pomodoro"
      >
        <Timer className="w-4 h-4" />
        <span className="hidden lg:inline">{formatTime(pomoTime)}</span>
      </button>

      <button
        onClick={() => togglePopover('countdown')}
        className={cn("p-1.5 rounded-md flex items-center gap-1 text-sm font-medium transition-colors", activePopover === 'countdown' || countdownActive ? "bg-blue-500/10 text-blue-500" : "text-ui-muted hover:bg-ui-surface")}
        title="Countdown Timer"
      >
        <Clock className="w-4 h-4" />
        <span className="hidden lg:inline">{formatTime(countdownTime)}</span>
      </button>

      <button
        onClick={() => togglePopover('metronome')}
        className={cn("p-1.5 rounded-md flex items-center gap-1 text-sm font-medium transition-colors", activePopover === 'metronome' || metronomeActive ? "bg-red-500/10 text-red-500" : "text-ui-muted hover:bg-ui-surface")}
        title="Pacer (Metronome)"
      >
        <Activity className="w-4 h-4" />
        {metronomeActive && <span className="hidden lg:inline font-mono">{metroTimeLeft}s</span>}
      </button>
      
      <div className="w-px h-6 bg-ui-border mx-1"></div>

      <AnimatePresence>
        {activePopover && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-12 right-0 w-64 bg-ui-surface border border-ui-border shadow-xl rounded-xl p-4 z-50 origin-top-right"
          >
            {activePopover === 'pomodoro' && (
              <div className="flex flex-col items-center">
                <h4 className="font-semibold text-sm mb-3">Pomodoro Timer</h4>
                
                {!pomoActive && (
                  <div className="grid grid-cols-2 gap-4 w-full mb-4">
                    <div>
                      <label className="text-xs text-ui-muted block mb-1">Work (min)</label>
                      <input 
                        type="number" min="1" 
                        value={workDuration} 
                        onChange={e => {
                          const v = Number(e.target.value) || 1;
                          setWorkDuration(v);
                          if (pomoMode === 'work') setPomoTime(v * 60);
                        }}
                        className="w-full bg-ui-background border border-ui-border rounded px-2 py-1 text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ui-muted block mb-1">Break (min)</label>
                      <input 
                        type="number" min="1" 
                        value={breakDuration} 
                        onChange={e => {
                          const v = Number(e.target.value) || 1;
                          setBreakDuration(v);
                          if (pomoMode === 'break') setPomoTime(v * 60);
                        }}
                        className="w-full bg-ui-background border border-ui-border rounded px-2 py-1 text-center font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mb-4 bg-ui-background p-1 rounded-lg w-full">
                   <button onClick={() => {setPomoMode('work'); setPomoTime(workDuration*60); setPomoActive(false);}} className={cn("flex-1 py-1 rounded-md text-xs font-semibold transition-colors", pomoMode === 'work' ? "bg-primary text-primary-foreground" : "text-ui-muted hover:bg-ui-surface")}>Work</button>
                   <button onClick={() => {setPomoMode('break'); setPomoTime(breakDuration*60); setPomoActive(false);}} className={cn("flex-1 py-1 rounded-md text-xs font-semibold transition-colors", pomoMode === 'break' ? "bg-primary text-primary-foreground" : "text-ui-muted hover:bg-ui-surface")}>Break</button>
                </div>
                <div className="text-4xl font-mono font-bold text-ui-text mb-4">
                   {formatTime(pomoTime)}
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setPomoActive(!pomoActive)} className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors">
                     {pomoActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                   </button>
                   <button 
                     onClick={() => { setPomoActive(false); setPomoTime(pomoMode === 'work' ? workDuration*60 : breakDuration*60); }}
                     className="w-10 h-10 flex items-center justify-center bg-ui-background text-ui-text border border-ui-border rounded-full hover:bg-ui-surface-hover transition-colors"
                   >
                     <RotateCcw className="w-4 h-4" />
                   </button>
                </div>
              </div>
            )}

            {activePopover === 'countdown' && (
              <div className="flex flex-col items-center">
                <h4 className="font-semibold text-sm mb-3">Countdown Timer</h4>
                {!countdownActive && countdownTime === countdownInput * 60 ? (
                  <div className="flex items-center gap-2 mb-4">
                    <input 
                      type="number" 
                      min="1" 
                      value={countdownInput} 
                      onChange={e => {setCountdownInput(Number(e.target.value) || 1); setCountdownTime((Number(e.target.value) || 1) * 60);}}
                      className="w-16 bg-ui-background border border-ui-border rounded px-2 py-1 text-center font-mono"
                    />
                    <span className="text-sm text-ui-muted">min</span>
                  </div>
                ) : (
                  <div className="text-4xl font-mono font-bold text-ui-text mb-4">
                     {formatTime(countdownTime)}
                  </div>
                )}
                
                <div className="flex gap-2">
                   <button onClick={() => setCountdownActive(!countdownActive)} className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors">
                     {countdownActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                   </button>
                   <button 
                     onClick={() => { setCountdownActive(false); setCountdownTime(countdownInput * 60); }}
                     className="w-10 h-10 flex items-center justify-center bg-ui-background text-ui-text border border-ui-border rounded-full hover:bg-ui-surface-hover transition-colors"
                   >
                     <RotateCcw className="w-4 h-4" />
                   </button>
                </div>
              </div>
            )}

            {activePopover === 'metronome' && (
              <div className="flex flex-col items-center">
                <h4 className="font-semibold text-sm mb-3">Question/Card Pacer</h4>
                
                {!metronomeActive && (
                  <div className="flex items-center gap-2 mb-4 w-full justify-center">
                    <span className="text-sm text-ui-muted">Cycle:</span>
                    <input 
                      type="number" 
                      min="1" 
                      value={metroTotal} 
                      onChange={e => {
                        const val = parseInt(e.target.value) || 1;
                        setMetroTotal(val);
                        setMetroTimeLeft(val);
                      }}
                      className="w-16 bg-ui-background border border-ui-border rounded px-2 py-1 text-center font-mono text-sm"
                    />
                    <span className="text-sm text-ui-muted">s</span>
                  </div>
                )}
                
                <div className="text-5xl font-bold font-mono text-ui-text mb-6">
                  {metroTimeLeft}
                  <span className="text-xl text-ui-muted font-normal ml-1">s</span>
                </div>
                
                <div className="w-full mb-4">
                  <button 
                    onClick={() => setShowMetroAdvanced(!showMetroAdvanced)} 
                    className="flex items-center justify-between w-full text-xs text-ui-muted hover:text-ui-text p-1 rounded hover:bg-ui-surface"
                  >
                    <span className="flex items-center gap-1"><Settings2 className="w-3 h-3" /> Advanced Config</span>
                    {showMetroAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <AnimatePresence>
                    {showMetroAdvanced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 border-t border-ui-border pt-2 space-y-3">
                        {/* Tick Config */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold flex items-center gap-1">
                              <input type="checkbox" checked={tickSound} onChange={e => setTickSound(e.target.checked)} className="rounded bg-ui-background border-ui-border text-primary focus:ring-primary" />
                              Tick Sound
                            </label>
                            <select value={tickType} onChange={e => setTickType(e.target.value as any)} className="text-xs bg-ui-background border border-ui-border rounded px-1 disabled:opacity-50" disabled={!tickSound}>
                              <option value="wood">Wood Click</option>
                              <option value="beep">Beep</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <VolumeX className="w-3 h-3 text-ui-muted" />
                            <input type="range" min="0" max="100" value={tickVolume} onChange={e => setTickVolume(Number(e.target.value))} disabled={!tickSound} className="w-full accent-primary h-1 bg-ui-border rounded-lg appearance-none cursor-pointer disabled:opacity-50" />
                            <Volume2 className="w-3 h-3 text-ui-muted" />
                          </div>
                        </div>

                        {/* Ding Config */}
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-ui-border">
                          <label className="text-xs font-semibold flex items-center gap-1">
                            <input type="checkbox" checked={dingSound} onChange={e => setDingSound(e.target.checked)} className="rounded bg-ui-background border-ui-border text-primary focus:ring-primary" />
                            Ding (Cycle End)
                          </label>
                          <div className="flex items-center gap-2">
                            <VolumeX className="w-3 h-3 text-ui-muted" />
                            <input type="range" min="0" max="100" value={dingVolume} onChange={e => setDingVolume(Number(e.target.value))} disabled={!dingSound} className="w-full accent-primary h-1 bg-ui-border rounded-lg appearance-none cursor-pointer disabled:opacity-50" />
                            <Volume2 className="w-3 h-3 text-ui-muted" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setMetronomeActive(!metronomeActive)} className={cn("w-12 h-12 flex items-center justify-center rounded-full transition-colors", metronomeActive ? "bg-red-500 text-white shadow-lg animate-pulse" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
                    {metronomeActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                  <button 
                     onClick={() => { setMetronomeActive(false); setMetroTimeLeft(metroTotal); }}
                     className="w-12 h-12 flex items-center justify-center bg-ui-background text-ui-text border border-ui-border rounded-full hover:bg-ui-surface-hover transition-colors"
                   >
                     <RotateCcw className="w-5 h-5" />
                   </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

