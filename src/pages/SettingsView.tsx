import { useStore } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Save, Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { useState, FormEvent, KeyboardEvent as ReactKeyboardEvent, useRef, useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { formatShortcutEvent } from '../lib/utils';

interface SettingsViewProps {
  onNavigate: (page: Page) => void;
}

export function SettingsView({ onNavigate }: SettingsViewProps) {
  const { settings, updateSettings, importProfile, resetSettings, resetAllData } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  
  const [theme, setTheme] = useState(settings.theme || 'ocean');
  const [language, setLanguage] = useState(settings.language || 'en');
  const [againMinutes, setAgainMinutes] = useState(settings.againMinutes);
  const [hardMultiplier, setHardMultiplier] = useState(settings.hardMultiplier);
  const [hardMinMinutes, setHardMinMinutes] = useState(settings.hardMinMinutes);
  const [goodMultiplier, setGoodMultiplier] = useState(settings.goodMultiplier);
  const [easyMultiplier, setEasyMultiplier] = useState(settings.easyMultiplier);
  const [cardsPerBlock, setCardsPerBlock] = useState(settings.cardsPerBlock);
  const [cardOrder, setCardOrder] = useState(settings.cardOrder || 'newFirst');
  
  const [newAgainMinutes, setNewAgainMinutes] = useState(settings.newAgainMinutes);
  const [newHardMinutes, setNewHardMinutes] = useState(settings.newHardMinutes);
  const [newGoodMinutes, setNewGoodMinutes] = useState(settings.newGoodMinutes);
  const [newEasyMinutes, setNewEasyMinutes] = useState(settings.newEasyMinutes);

  const [ttsVoiceURI, setTtsVoiceURI] = useState(settings.ttsVoiceURI || '');
  const [ttsRate, setTtsRate] = useState(settings.ttsRate || 1);
  const [ttsPitch, setTtsPitch] = useState(settings.ttsPitch || 1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsLangFilter, setTtsLangFilter] = useState('');

  useEffect(() => {
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const uniqueLangs = Array.from(new Set(availableVoices.map(v => v.lang))).sort();

  const previewVoice = () => {
    const utterance = new SpeechSynthesisUtterance("This is a preview of the selected voice. Este é um teste da voz.");
    if (ttsVoiceURI) {
      const selectedVoice = availableVoices.find(v => v.voiceURI === ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
    }
    utterance.rate = Number(ttsRate);
    utterance.pitch = Number(ttsPitch);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const [shortcuts, setShortcuts] = useState(
    settings.shortcuts || { showAnswer: ' ', again: '1', hard: '2', good: '3', easy: '4', playTTS: 'p', bury: 'b', suspend: 's', undo: 'z', redo: 'y' }
  );

  const handleShortcutChange = (field: keyof typeof shortcuts, val: string) => {
    setShortcuts(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    updateSettings({
      theme: theme as any,
      language: language as any,
      againMinutes: Number(againMinutes),
      hardMultiplier: Number(hardMultiplier),
      hardMinMinutes: Number(hardMinMinutes),
      goodMultiplier: Number(goodMultiplier),
      easyMultiplier: Number(easyMultiplier),
      newAgainMinutes: Number(newAgainMinutes),
      newHardMinutes: Number(newHardMinutes),
      newGoodMinutes: Number(newGoodMinutes),
      newEasyMinutes: Number(newEasyMinutes),
      cardsPerBlock: Number(cardsPerBlock),
      cardOrder: cardOrder as any,
      ttsVoiceURI,
      ttsRate: Number(ttsRate),
      ttsPitch: Number(ttsPitch),
      shortcuts
    });
  }, [theme, language, againMinutes, hardMultiplier, hardMinMinutes, goodMultiplier, easyMultiplier, newAgainMinutes, newHardMinutes, newGoodMinutes, newEasyMinutes, cardsPerBlock, cardOrder, ttsVoiceURI, ttsRate, ttsPitch, shortcuts]);

  const handleExportProfile = async () => {
    const state = useStore.getState();
    if (state.decks.length === 0 && state.cards.length === 0) {
      alert("No data found to export.");
      return;
    }
    
    // Export the exact state wrapper format zustand persist expects
    const exportData = JSON.stringify({ state: { decks: state.decks, cards: state.cards }, version: 0 });
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards-profile-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Also export each individual deck separately
    const rootDecks = state.decks.filter(d => !d.parentId);
    rootDecks.forEach((deck, index) => {
      // Add slight delay to prevent browser crash/blocking on multiple downloads
      setTimeout(() => {
        const deckData = state.exportDeckSet(deck.id);
        const deckBlob = new Blob([deckData], { type: 'application/json' });
        const deckUrl = URL.createObjectURL(deckBlob);
        const deckA = document.createElement('a');
        deckA.href = deckUrl;
        deckA.download = `deck-${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        deckA.click();
        URL.revokeObjectURL(deckUrl);
      }, (index + 1) * 300);
    });
  };

  const handleImportProfile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        // If it's a zustand exported file, state is inside `parsed.state`
        const stateToImport = parsed.state ? parsed.state : parsed;
        const success = importProfile(JSON.stringify(stateToImport));
        if (success) {
          alert('Profile imported successfully!');
          window.location.reload();
        } else {
          alert('Invalid profile file.');
        }
      } catch(err) {
        alert('Invalid profile file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetSettings = () => {
    if (window.confirm("Are you sure you want to reset all settings to their default values?")) {
      resetSettings();
      alert('Settings reset successfully!');
      window.location.reload();
    }
  };

  const handleResetAllData = () => {
    if (window.confirm("WARNING: This will permanently delete ALL your decks, cards, study history, and settings! Are you absolutely sure?")) {
      if (window.confirm("Are you REALLY sure? This action CANNOT be undone.")) {
        resetAllData();
        alert('All data has been wiped.');
        window.location.reload();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="flex items-center gap-2 text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-ui-text">Settings</h2>
      </div>

      <form className="space-y-6">
        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">{t.settings.general}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">{t.settings.theme}</label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-xl text-ui-text focus:outline-none focus:border-primary"
              >
                <option value="dark">{t.settings.dark}</option>
                <option value="light">{t.settings.light}</option>
                <option value="midnight">{t.settings.midnight}</option>
                <option value="forest">{t.settings.forest}</option>
                <option value="dracula">{t.settings.dracula}</option>
                <option value="ocean">{t.settings.ocean}</option>
                <option value="sunset">Sunset</option>
                <option value="nord">Nord</option>
                <option value="rose">Rose</option>
                <option value="sepia">Sepia</option>
                <option value="paty">Paty (Pink)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">{t.settings.language}</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              >
                <option value="en">{t.settings.english}</option>
                <option value="pt">{t.settings.portuguese}</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">{t.settings.cardsPerBlock}</label>
              <input 
                type="number" 
                min="1" 
                max="100"
                value={cardsPerBlock}
                onChange={(e) => setCardsPerBlock(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ui-muted mt-1">Number of cards grouped together during study sessions.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">{t.settings.cardOrder}</label>
              <select 
                value={cardOrder}
                onChange={(e) => setCardOrder(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              >
                <option value="newFirst">{t.settings.orderNewFirst}</option>
                <option value="reviewsFirst">{t.settings.orderReviewsFirst}</option>
                <option value="random">{t.settings.orderRandom}</option>
              </select>
              <p className="text-xs text-ui-muted mt-1">Order in which cards are presented.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <div className="flex items-center gap-4 justify-between border-b border-ui-border pb-2">
            <div>
              <h3 className="text-lg font-medium text-ui-text">TTS Settings</h3>
              <p className="text-sm text-ui-muted">Configure Text-to-Speech options for card playback.</p>
            </div>
            <button 
              type="button"
              onClick={previewVoice}
              className="bg-primary text-ui-text px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors"
            >
              Preview
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Language Filter</label>
              <select
                value={ttsLangFilter}
                onChange={(e) => setTtsLangFilter(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary mb-4"
              >
                <option value="">All Languages</option>
                {uniqueLangs.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>

              <label className="block text-sm font-medium text-ui-muted mb-1">Voice</label>
              <select 
                value={ttsVoiceURI}
                onChange={(e) => setTtsVoiceURI(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              >
                <option value="">Default System Voice</option>
                {availableVoices.filter(v => !ttsLangFilter || v.lang === ttsLangFilter).map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Rate (Speed)</label>
              <input 
                type="range" min="0.1" max="2" step="0.1"
                value={ttsRate}
                onChange={(e) => setTtsRate(e.target.value)}
                className="w-full accent-primary"
              />
              <div className="text-right text-xs text-ui-muted">{ttsRate}x</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Pitch</label>
              <input 
                type="range" min="0" max="2" step="0.1"
                value={ttsPitch}
                onChange={(e) => setTtsPitch(e.target.value)}
                className="w-full accent-primary"
              />
              <div className="text-right text-xs text-ui-muted">{ttsPitch}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">New Card Intervals</h3>
          <p className="text-sm text-ui-muted">Configure initial spacing (in minutes) for new cards.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Again</label>
              <input type="number" min="0" value={newAgainMinutes} onChange={(e) => setNewAgainMinutes(e.target.value)} className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Hard</label>
              <input type="number" min="0" value={newHardMinutes} onChange={(e) => setNewHardMinutes(e.target.value)} className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Good</label>
              <input type="number" min="0" value={newGoodMinutes} onChange={(e) => setNewGoodMinutes(e.target.value)} className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Easy</label>
              <input type="number" min="0" value={newEasyMinutes} onChange={(e) => setNewEasyMinutes(e.target.value)} className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">Review Intervals</h3>
          <p className="text-sm text-ui-muted">Configure how the spacing algorithm calculates the next review time.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Again (minutes)</label>
              <input 
                type="number" 
                min="0"
                step="1"
                value={againMinutes}
                onChange={(e) => setAgainMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ui-muted mt-1">Fixed time when you mark a card as Again.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Hard Multiplier</label>
              <input 
                type="number" 
                min="0.1"
                step="0.05"
                value={hardMultiplier}
                onChange={(e) => setHardMultiplier(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ui-muted mt-1">Multiplies the previous interval.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Hard Minimum (minutes)</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={hardMinMinutes}
                onChange={(e) => setHardMinMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-ui-muted mt-1">Minimum time for a Hard rating.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Good Multiplier</label>
              <input 
                type="number" 
                min="1"
                step="0.1"
                value={goodMultiplier}
                onChange={(e) => setGoodMultiplier(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Easy Multiplier</label>
              <input 
                type="number" 
                min="1"
                step="0.1"
                value={easyMultiplier}
                onChange={(e) => setEasyMultiplier(e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">Keyboard Shortcuts</h3>
          <p className="text-sm text-ui-muted">Click to set a new key.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <ShortcutInput label="Show Answers" value={shortcuts.showAnswer} onChange={(v) => handleShortcutChange('showAnswer', v)} />
            <ShortcutInput label="Rate Again" value={shortcuts.again} onChange={(v) => handleShortcutChange('again', v)} />
            <ShortcutInput label="Rate Hard" value={shortcuts.hard} onChange={(v) => handleShortcutChange('hard', v)} />
            <ShortcutInput label="Rate Good" value={shortcuts.good} onChange={(v) => handleShortcutChange('good', v)} />
            <ShortcutInput label="Rate Easy" value={shortcuts.easy} onChange={(v) => handleShortcutChange('easy', v)} />
            <ShortcutInput label="Play TTS" value={shortcuts.playTTS} onChange={(v) => handleShortcutChange('playTTS', v)} />
            <ShortcutInput label="Bury Card" value={shortcuts.bury} onChange={(v) => handleShortcutChange('bury', v)} />
            <ShortcutInput label="Suspend Card" value={shortcuts.suspend} onChange={(v) => handleShortcutChange('suspend', v)} />
            <ShortcutInput label="Undo" value={shortcuts.undo} onChange={(v) => handleShortcutChange('undo', v)} />
            <ShortcutInput label="Redo" value={shortcuts.redo} onChange={(v) => handleShortcutChange('redo', v)} />
          </div>
        </div>
      </form>

      <div className="glass-panel p-6 space-y-6">
        <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">Data Management</h3>
        <p className="text-sm text-ui-muted">Export your complete profile (all decks, cards, history, and settings) or import an existing one.</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleExportProfile}
            className="flex-1 bg-ui-surface border border-ui-border text-ui-text px-4 py-2.5 rounded-lg hover:bg-ui-surface-hover flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-5 h-5" />
            Export Profile
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportProfile}
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="w-full bg-ui-surface border border-ui-border text-ui-text px-4 py-2.5 rounded-lg hover:bg-ui-surface-hover flex items-center justify-center gap-2 transition-colors pointer-events-none">
              <Upload className="w-5 h-5" />
              Import Profile
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-ui-border pt-6 space-y-4">
          <h4 className="text-md font-medium text-ui-text">Danger Zone</h4>
          <p className="text-sm text-ui-muted">Reset your application data. Please read carefully before taking these actions.</p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleResetSettings}
              className="w-full sm:w-auto bg-ui-surface border border-ui-border text-ui-text px-6 py-2.5 rounded-lg hover:bg-ui-surface-hover flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Settings to Defaults
            </button>

            <button 
              onClick={handleResetAllData}
              className="w-full sm:w-auto bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-2.5 rounded-lg hover:bg-red-500/20 flex items-center justify-center gap-2 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Reset All Data & Decks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutInput({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
  const [recording, setRecording] = useState(false);
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    e.preventDefault();
    const pressed = formatShortcutEvent(e);
    // Don't finish if only modifier is pressed
    if (['ctrl', 'shift', 'alt', 'meta'].includes(pressed) || pressed.endsWith('+')) return;
    
    onChange(pressed);
    setRecording(false);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-ui-muted mb-1">{label}</label>
      <button 
        type="button" 
        onClick={() => setRecording(true)} 
        onKeyDown={recording ? handleKeyDown : undefined} 
        onBlur={() => setRecording(false)}
        className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary text-left font-mono text-sm h-[42px]"
      >
        {recording ? 'Press a key...' : value}
      </button>
    </div>
  );
}
