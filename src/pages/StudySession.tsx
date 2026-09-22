import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore, Flashcard, DEFAULT_SETTINGS } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, CheckSquare, Square, Calendar, Edit2, Check, X, Eye, EyeOff, PlayCircle, Trash2, Pause, SkipForward, ExternalLink, Edit3 } from 'lucide-react';
import { Rating } from '../lib/sm2';
import { formatShortcutEvent, matchShortcut, cn, renderCardText } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sanitizeHtml } from '../lib/utils';
import { RichEditor } from '../components/RichEditor';
import { IsolatedHtml } from '../components/IsolatedHtml';
import { NotepadModal } from '../components/NotepadModal';
import { AutoHighlighter } from '../components/AutoHighlighter';

export function formatTime(minutes: number): string {
  if (minutes < 60) return `< ${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  if (minutes < 30 * 24 * 60) return `${Math.round(minutes / (24 * 60))}d`;
  if (minutes < 12 * 30 * 24 * 60) return `${Math.round(minutes / (30 * 24 * 60))}mo`;
  return `${Math.round(minutes / (365 * 24 * 60))}y`;
}

interface StudySessionProps {
  deckId?: string;
  cardIds?: string[];
  onNavigate: (page: Page) => void;
}

const BLOCK_SIZE = 5;

export function StudySession({ deckId, cardIds, onNavigate }: StudySessionProps) {
  const { decks, cards, reviewCards, reviewCardsCustom, settings, updateSettings, updateCard, deleteCard } = useStore();
  const deck = decks.find(d => d.id === deckId);
  const [phase, setPhase] = useState<'question' | 'answer'>('question');
  const [customDays, setCustomDays] = useState<string>('');
  const [remainingCustomCardIds, setRemainingCustomCardIds] = useState<string[]>(cardIds || []);
  
  // Track editing state per card using its ID
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showNotesForCard, setShowNotesForCard] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [showEditBackPreview, setShowEditBackPreview] = useState(true);
  const [peekCards, setPeekCards] = useState<Record<string, boolean>>({});
  const [isPeekAll, setIsPeekAll] = useState(false);
  
  // All due cards
  const dueCards = useMemo(() => {
    const now = Date.now();
    let filtered: Flashcard[] = [];
    if (cardIds) {
      filtered = cards.filter(c => remainingCustomCardIds.includes(c.id));
    } else {
      filtered = cards.filter(c => c.deckId === deckId && c.nextReviewDate <= now && !c.isSuspended && !c.isBuried);
    }
    
    const deckOrder = deck?.settings?.cardOrder || settings.cardOrder || 'newFirst';
    if (deckOrder === 'newFirst') {
      filtered.sort((a, b) => a.repetition - b.repetition);
    } else if (deckOrder === 'reviewsFirst') {
      filtered.sort((a, b) => b.repetition - a.repetition);
    } else if (deckOrder === 'random') {
      // Create a deterministic-ish random by an initial sort then scramble so React doesn't complain too much, 
      // but simple Math.random() works as it's computed in useMemo and retained until cards change.
      filtered.sort(() => Math.random() - 0.5);
    }
    
    return filtered;
  }, [cards, deckId, cardIds, remainingCustomCardIds, deck?.settings?.cardOrder, settings.cardOrder]);

  // Current block of cards
  const [currentBlock, setCurrentBlock] = useState<Flashcard[]>([]);
  // Which cards are selected (checked) in the answer phase
  const [selectedCards, setSelectedCards] = useState<Record<string, boolean>>({});

  // Initialize block
  useEffect(() => {
    if (currentBlock.length === 0 && dueCards.length > 0) {
      const perBlock = deck?.settings?.cardsPerBlock || settings.cardsPerBlock;
      const nextBlock = dueCards.slice(0, perBlock);
      setCurrentBlock(nextBlock);
      setPhase('question');
      setCustomDays('');
      setPeekCards({});
      setIsPeekAll(false);
      setShowDetails({});
      
      const initialSelection: Record<string, boolean> = {};
      nextBlock.forEach(c => initialSelection[c.id] = true);
      setSelectedCards(initialSelection);
    }
  }, [dueCards, currentBlock, settings.cardsPerBlock, deck?.settings?.cardsPerBlock]);

  const togglePeek = (id: string) => {
    setPeekCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Details toggle state
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const hasStudied = useRef(false);

  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const applyTtsSettings = (utterance: SpeechSynthesisUtterance) => {
    if (settings.ttsVoiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === settings.ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    utterance.rate = settings.ttsRate ?? 1;
    utterance.pitch = settings.ttsPitch ?? 1;
  };

  const playAllTTS = () => {
    window.speechSynthesis.cancel();
    
    // Create a chain of utterances
    currentBlock.forEach((card, index) => {
      const htmlText = phase === 'answer' || isPeekAll || peekCards[card.id] ? `${card.front}. \n\n ${card.back}` : card.front;
      const temp = document.createElement('div');
      temp.innerHTML = sanitizeHtml(htmlText);
      const text = temp.textContent || temp.innerText || "";
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      applyTtsSettings(utterance);
      if (index > 0) {
        // slight pause between cards? Just let them queue naturally.
      }
      window.speechSynthesis.speak(utterance);
    });
  };


  const handleShowAnswers = useCallback(() => {
    if (editingCardId) {
      updateCard(editingCardId, editFront, editBack, editDetails);
      setCurrentBlock(prev => prev.map(c => c.id === editingCardId ? { ...c, front: editFront, back: editBack, details: editDetails } : c));
      setEditingCardId(null);
    }
    setPhase('answer');
  }, [editingCardId, editFront, editBack, editDetails, updateCard]);

  const handleRate = useCallback((rating: Rating) => {
    if (editingCardId) {
      updateCard(editingCardId, editFront, editBack, editDetails);
      // No need to setCurrentBlock since we're clearing it anyway below
      setEditingCardId(null);
    }
    const idsToRate = Object.keys(selectedCards).filter(id => selectedCards[id]);
    
    if (idsToRate.length === 0) {
      if (!confirm("No cards selected. Skip this block?")) return;
    }

    if (idsToRate.length > 0) {
      hasStudied.current = true;
      reviewCards(idsToRate, rating);
      if (cardIds && rating !== 'again') {
        setRemainingCustomCardIds(prev => prev.filter(id => !idsToRate.includes(id)));
      }
    }

    setCurrentBlock([]);
  }, [selectedCards, reviewCards, cardIds, editingCardId, editFront, editBack, editDetails, updateCard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if user is editing text
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const s = settings.shortcuts || {
        showAnswer: 'space', again: '1', hard: '2', good: '3', easy: '4', playTTS: 'p', bury: 'ctrl+k', suspend: 'ctrl+j', undo: 'ctrl+z', redo: 'ctrl+shift+z|ctrl+y'
      };

      if (matchShortcut(e as any, s.undo)) {
        e.preventDefault();
        useStore.temporal.getState().undo();
        setCurrentBlock([]);
        setPhase('question');
        return;
      }

      if (matchShortcut(e as any, s.redo)) {
        e.preventDefault();
        useStore.temporal.getState().redo();
        setCurrentBlock([]);
        setPhase('question');
        return;
      }
      
      if (phase === 'question') {
        if (matchShortcut(e as any, s.showAnswer)) {
          e.preventDefault();
          handleShowAnswers();
        } else if (matchShortcut(e as any, s.playTTS)) {
          e.preventDefault();
          playAllTTS();
        } else if (matchShortcut(e as any, s.bury) && currentBlock.length > 0) {
          e.preventDefault();
          handleBuryCard(currentBlock[0].id);
        } else if (matchShortcut(e as any, s.suspend) && currentBlock.length > 0) {
          e.preventDefault();
          handleSuspendCard(currentBlock[0].id);
        }
      } else if (phase === 'answer') {
        if (matchShortcut(e as any, s.again)) { e.preventDefault(); handleRate('again'); }
        else if (matchShortcut(e as any, s.hard)) { e.preventDefault(); handleRate('hard'); }
        else if (matchShortcut(e as any, s.good)) { e.preventDefault(); handleRate('good'); }
        else if (matchShortcut(e as any, s.easy)) { e.preventDefault(); handleRate('easy'); }
        else if (matchShortcut(e as any, s.playTTS)) { e.preventDefault(); playAllTTS(); }
        else if (matchShortcut(e as any, s.bury) && currentBlock.length > 0) { e.preventDefault(); handleBuryCard(currentBlock[0].id); }
        else if (matchShortcut(e as any, s.suspend) && currentBlock.length > 0) { e.preventDefault(); handleSuspendCard(currentBlock[0].id); }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, settings.shortcuts, handleShowAnswers, handleRate, playAllTTS]);

  const toggleCardSelection = (id: string) => {
    setSelectedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditDetails(card.details || '');
    // Auto-show preview only if they were already in the answer phase
    setShowEditBackPreview(phase === 'answer');
  };

  const saveEdit = (cardId: string) => {
    updateCard(cardId, editFront, editBack, editDetails);
    // Update the local currentBlock so it reflects without needing a full refresh from store
    setCurrentBlock(prev => prev.map(c => c.id === cardId ? { ...c, front: editFront, back: editBack, details: editDetails } : c));
    setEditingCardId(null);
  };

  const cancelEdit = () => {
    setEditingCardId(null);
  };

  const handleSuspendCard = (cardId: string) => {
    useStore.getState().toggleSuspendCard(cardId);
    setCurrentBlock(prev => prev.filter(c => c.id !== cardId));
  };

  const handleBuryCard = (cardId: string) => {
    useStore.getState().toggleBuryCard(cardId);
    setCurrentBlock(prev => prev.filter(c => c.id !== cardId));
  };

  const handleDeleteCard = (cardId: string) => {
    if (confirm("Delete this card permanently?")) {
      deleteCard(cardId);
      setCurrentBlock(prev => prev.filter(c => c.id !== cardId));
    }
  };

  const playTTS = (htmlText: string) => {
    // Strip rough HTML tags for voice
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(htmlText);
    const text = temp.textContent || temp.innerText || "";
    
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      applyTtsSettings(utterance);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in this browser.");
    }
  };

  const handleRateCustom = () => {
    const days = parseInt(customDays, 10);
    if (isNaN(days) || days <= 0) return;

    const idsToRate = Object.keys(selectedCards).filter(id => selectedCards[id]);
    if (idsToRate.length === 0) {
      if (!confirm("No cards selected. Skip this block?")) return;
    }

    if (idsToRate.length > 0) {
      hasStudied.current = true;
      reviewCardsCustom(idsToRate, days);
    }
    setCurrentBlock([]);
  };

  const getNextIntervals = () => {
    // Return sample formatted times for the buttons based on the *average* interval of selected cards
    const selectedIds = Object.keys(selectedCards).filter(id => selectedCards[id]);
    const activeCards = currentBlock.filter(c => selectedIds.includes(c.id));
    if (activeCards.length === 0) return { again: '< 1m', hard: '-', good: '-', easy: '-' };
    
    const avgInterval = activeCards.reduce((acc, c) => acc + c.interval, 0) / activeCards.length;
    const isNew = activeCards.every(c => c.repetition === 0);
    
    const safeSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    if (isNew) {
      return {
        again: formatTime(safeSettings.newAgainMinutes || 15),
        hard: formatTime(safeSettings.newHardMinutes || 1440),
        good: formatTime(safeSettings.newGoodMinutes || 5760),
        easy: formatTime(safeSettings.newEasyMinutes || 14400),
      };
    }
    
    return {
      again: formatTime(safeSettings.againMinutes),
      hard: formatTime(Math.max(safeSettings.hardMinMinutes, avgInterval * safeSettings.hardMultiplier)),
      good: formatTime(avgInterval === 0 ? 10 : avgInterval * safeSettings.goodMultiplier),
      easy: formatTime(avgInterval === 0 ? (4 * 24 * 60) : avgInterval * safeSettings.easyMultiplier),
    };
  };

  const intervals = getNextIntervals();

  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);

  useEffect(() => {
    if (dueCards.length === 0 && currentBlock.length === 0 && !hasDownloadedBackup && hasStudied.current) {
      setHasDownloadedBackup(true);
      const state = useStore.getState();
      let exportData: string;
      let filename: string;
      
      if (deckId && deck) {
        exportData = state.exportDeckSet(deckId);
        filename = `deck-${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      } else {
        exportData = JSON.stringify({ state: { decks: state.decks, cards: state.cards }, version: 0 });
        filename = `anki-block-backup-${new Date().toISOString().split('T')[0]}.json`;
      }
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [dueCards.length, currentBlock.length, hasDownloadedBackup]);

  if (!deck && !cardIds) {
    onNavigate({ type: 'home' });
    return null;
  }

  if (dueCards.length === 0 && currentBlock.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <div className="w-16 h-16 bg-ui-surface-hover text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-ui-text mb-2">Congratulations!</h2>
        <p className="text-ui-muted mb-8 max-w-md mx-auto">
          You've completed this session for <strong>{deck?.name || 'these cards'}</strong>. Great job!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
          <button 
            onClick={() => onNavigate({ type: 'home' })}
            className="flex-1 bg-ui-surface hover:bg-ui-surface-hover text-ui-text px-6 py-2.5 rounded-xl font-medium transition-colors border border-ui-border"
          >
            Back to Home
          </button>
          <button 
            onClick={() => onNavigate({ type: 'browse', deckId: deckId })}
            className="flex-1 bg-ui-surface hover:bg-ui-surface-hover text-ui-text px-6 py-2.5 rounded-xl font-medium transition-colors border border-ui-border"
          >
            Open Browser
          </button>
          <button 
            onClick={() => onNavigate({ type: 'deck', deckId: deckId || '' })}
            className="flex-1 bg-primary text-ui-text px-6 py-2.5 rounded-xl font-medium hover:bg-primary-hover transition-colors"
          >
            Deck Options
          </button>
        </div>
      </div>
    );
  }

  return (
    <AutoHighlighter className="max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="flex items-center gap-2 text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Session</span>
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPeekAll(!isPeekAll)} 
            className={cn("flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors", isPeekAll ? "bg-primary/20 text-primary" : "bg-ui-surface hover:bg-ui-surface-hover text-ui-muted")}
          >
             {isPeekAll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {isPeekAll ? 'Hide All' : 'Peek All'}
          </button>
          <button onClick={playAllTTS} className="flex items-center gap-1 text-sm bg-ui-surface hover:bg-ui-surface-hover px-2 py-1 rounded text-ui-muted transition-colors">
             <PlayCircle className="w-4 h-4" /> Play Block
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-ui-muted">Per block:</label>
            <select 
              className="bg-ui-surface border border-ui-border text-ui-text rounded-lg px-2 py-1 text-sm focus:outline-none"
              value={settings.cardsPerBlock}
              onChange={(e) => updateSettings({ cardsPerBlock: Number(e.target.value) })}
            >
              <option value={1} className="text-black">1</option>
              <option value={3} className="text-black">3</option>
              <option value={5} className="text-black">5</option>
              <option value={10} className="text-black">10</option>
            </select>
          </div>
          <div className="stat-pill border border-ui-border text-ui-text">
            {dueCards.length} cards remaining
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {currentBlock.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={cn(
                  "card-item overflow-hidden",
                  phase === 'answer' && !selectedCards[card.id] ? "!border-red-500/30 opacity-70" : ""
                )}
              >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Frente</span>
                          {card.flag && (
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                               card.flag === 'red' ? 'bg-red-500' :
                               card.flag === 'orange' ? 'bg-orange-500' :
                               card.flag === 'green' ? 'bg-green-500' :
                               card.flag === 'blue' ? 'bg-blue-500' :
                               card.flag === 'purple' ? 'bg-purple-500' :
                               'bg-primary-hover'
                            }`}></div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                           {phase === 'answer' && !selectedCards[card.id] && (
                              <span className="text-[10px] text-red-500 font-semibold tracking-wide hidden sm:inline-block">EXCLUÍDO DO BLOCO</span>
                           )}
                           {card.sourceQuestionId && (
                             <button 
                               onClick={() => onNavigate({ type: 'question', questionId: card.sourceQuestionId })}
                               className="p-1 px-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center gap-1"
                               title="View Source Question"
                             >
                               <ExternalLink className="w-3 h-3" /> Source
                             </button>
                           )}
                           <button 
                             onClick={() => setShowNotesForCard(card.id)}
                             className="p-1 px-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors flex items-center gap-1"
                             title="Take Notes"
                           >
                             <Edit3 className="w-3 h-3" /> Notes
                           </button>
                           <button 
                             onClick={() => playTTS(phase === 'answer' || isPeekAll || peekCards[card.id] ? `${card.front}. \n\n ${card.back}` : card.front)}
                             className="p-1 text-ui-muted hover:text-primary hover:bg-ui-surface rounded-md transition-colors"
                             title="Listen to card"
                           >
                             <PlayCircle className="w-4 h-4" />
                           </button>
                           {phase === 'question' && (
                             <button 
                               onClick={() => togglePeek(card.id)}
                               className={cn(
                                 "p-1 rounded-md transition-colors",
                                 peekCards[card.id] ? "text-primary bg-primary/10" : "text-ui-muted hover:text-primary hover:bg-ui-surface"
                               )}
                               title="Peek Answer"
                             >
                               {peekCards[card.id] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                             </button>
                           )}
                           <button 
                             onClick={() => startEditing(card)}
                             className="p-1 text-ui-muted hover:text-primary hover:bg-ui-surface rounded-md transition-colors"
                             title="Edit Card"
                           >
                             <Edit2 className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleBuryCard(card.id)}
                             className="p-1 text-ui-muted hover:text-orange-400 hover:bg-ui-surface rounded-md transition-colors"
                             title="Bury Card (Skip for today)"
                           >
                             <SkipForward className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleSuspendCard(card.id)}
                             className="p-1 text-ui-muted hover:text-yellow-400 hover:bg-ui-surface rounded-md transition-colors"
                             title="Suspend Card (Hide indefinitely)"
                           >
                             <Pause className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleDeleteCard(card.id)}
                             className="p-1 text-ui-muted hover:text-red-400 hover:bg-ui-surface rounded-md transition-colors"
                             title="Delete Card"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                           {phase === 'answer' && (
                              <input 
                                type="checkbox"
                                className="checkbox-custom ml-2"
                                checked={selectedCards[card.id]}
                                onChange={() => toggleCardSelection(card.id)}
                              />
                           )}
                        </div>
                      </div>
                      
                      {editingCardId === card.id ? (
                        <div className="mt-2 space-y-4 pt-2 border-t border-ui-border">
                          <div>
                             <div className="text-xs text-ui-muted mb-1">Editing Front</div>
                             <RichEditor value={editFront} onChange={setEditFront} />
                          </div>
                          <div>
                             <div className="flex items-center justify-between mb-1">
                               <div className="text-xs text-ui-muted">Editing Back & Details</div>
                               <button 
                                 onClick={() => setShowEditBackPreview(!showEditBackPreview)}
                                 className="text-ui-muted hover:text-ui-text flex items-center gap-1 text-[11px]"
                               >
                                 {showEditBackPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                 {showEditBackPreview ? 'Hide Details' : 'Show Details'}
                               </button>
                             </div>
                             {showEditBackPreview ? (
                               <div className="space-y-4">
                                 <RichEditor value={editBack} onChange={setEditBack} />
                                 <div>
                                   <div className="text-xs text-ui-muted mb-1">Details (Optional)</div>
                                   <RichEditor value={editDetails} onChange={setEditDetails} />
                                 </div>
                               </div>
                             ) : (
                               <div className="p-3 bg-ui-surface border border-dashed border-ui-border rounded-lg text-ui-muted text-sm text-center">
                                  Back details hidden. Click "Show Details" to view/edit.
                               </div>
                             )}
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} className="px-3 py-1.5 text-xs font-medium text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover rounded-md">Cancel</button>
                            <button onMouseDown={(e) => { e.preventDefault(); saveEdit(card.id); }} className="px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-md">Save Changes</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <IsolatedHtml 
                            className={cn(
                              "text-base text-ui-text mb-3 py-1",
                              (phase === 'answer' || isPeekAll || peekCards[card.id]) && "reveal-masks"
                            )}
                            frontHtml={renderCardText(card.front, phase === 'answer' || isPeekAll || !!peekCards[card.id])}
                            showBack={phase === 'answer' || isPeekAll || !!peekCards[card.id]}
                            backHtml={renderCardText(card.back, true)}
                            detailsHtml={showDetails[card.id] && card.details ? renderCardText(card.details, true) : undefined}
                          />
                          
                          {(phase === 'answer' || isPeekAll || peekCards[card.id]) && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="pt-2 mt-2 border-t border-ui-border text-[13px] text-ui-muted"
                            >
                              {(card.details || (card.tags && card.tags.length > 0)) && (
                                <div className="mt-3">
                                  <button 
                                    onClick={() => toggleDetails(card.id)}
                                    className="text-xs font-semibold text-primary hover:text-primary transition-colors uppercase tracking-wider"
                                  >
                                    {showDetails[card.id] ? '- Hide Details' : '+ Show Details'}
                                  </button>
                                  {showDetails[card.id] && (
                                    <div className="mt-2 pt-2 border-t border-ui-border space-y-2">
                                      {card.tags && card.tags.length > 0 && (
                                        <details className="mt-2 text-xs group">
                                          <summary className="cursor-pointer font-semibold text-primary/80 hover:text-primary transition-colors uppercase tracking-wider select-none list-none flex items-center gap-1">
                                            <span className="group-open:hidden">+ Show Tags</span>
                                            <span className="hidden group-open:inline">- Hide Tags</span>
                                          </summary>
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {card.tags.map(t => (
                                              <span key={t} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">{t}</span>
                                            ))}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="sticky bottom-4 pt-8 pb-4">
        {phase === 'question' ? (
          <button 
            onMouseDown={(e) => { e.preventDefault(); handleShowAnswers(); }}
            className="w-full bg-primary text-ui-text py-4 rounded-xl font-semibold text-lg hover:bg-primary-hover transition-all shadow-xl"
          >
            Show Answers
          </button>
        ) : (
          <div className="glass-panel p-6 flex flex-col gap-6 items-center">
             <div className="flex flex-col sm:flex-row w-full gap-4 items-center">
               <div className="sm:w-[150px] w-full text-center sm:text-left">
                 <div className="text-ui-text text-sm font-semibold">Block Action</div>
                 <div className="text-ui-muted text-[11px] mt-0.5">
                   Affects {Object.keys(selectedCards).filter(id => selectedCards[id]).length} of {currentBlock.length} cards
                 </div>
               </div>
               <div className="flex flex-1 w-full gap-3 sm:gap-4">
                <RatingButton 
                  label="AGAIN" 
                  sub={intervals.again} 
                  colorClass="btn-again btn-action flex flex-col items-center justify-center h-full active:scale-95" 
                  onClick={() => handleRate('again')} 
                />
                <RatingButton 
                  label="HARD" 
                  sub={intervals.hard} 
                  colorClass="btn-hard btn-action flex flex-col items-center justify-center h-full active:scale-95" 
                  onClick={() => handleRate('hard')} 
                />
                <RatingButton 
                  label="GOOD" 
                  sub={intervals.good} 
                  colorClass="btn-good btn-action flex flex-col items-center justify-center h-full active:scale-95" 
                  onClick={() => handleRate('good')} 
                />
                <RatingButton 
                  label="EASY" 
                  sub={intervals.easy} 
                  colorClass="btn-easy btn-action flex flex-col items-center justify-center h-full active:scale-95" 
                  onClick={() => handleRate('easy')} 
                />
              </div>
             </div>

             {/* Custom Period */}
             <div className="w-full pt-4 border-t border-ui-border flex flex-col sm:flex-row gap-3 items-center justify-between">
               <div className="text-sm font-medium text-ui-muted">Custom Interval (Days):</div>
               <div className="flex gap-2 w-full sm:w-auto">
                 <input 
                   type="number" 
                   min="1"
                   placeholder="e.g. 14"
                   value={customDays}
                   onChange={(e) => setCustomDays(e.target.value)}
                   className="w-24 px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary text-sm"
                 />
                 <button 
                  onClick={handleRateCustom}
                  disabled={!customDays || isNaN(parseInt(customDays))}
                  className="bg-ui-surface-hover hover:bg-ui-surface-hover disabled:opacity-50 text-ui-text px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                 >
                   <Calendar className="w-4 h-4" />
                   Set
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
      
      {showNotesForCard && (
        <NotepadModal
          targetId={showNotesForCard}
          targetType="card"
          onClose={() => setShowNotesForCard(null)}
        />
      )}
    </AutoHighlighter>
  );
}

function RatingButton({ 
  label, 
  sub, 
  colorClass, 
  onClick 
}: { 
  label: string, 
  sub: string, 
  colorClass: string, 
  onClick: () => void 
}) {
  return (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn("py-4 px-3 rounded-2xl w-full", colorClass)}
    >
      <div className="font-bold text-sm tracking-wide">{label}</div>
      <div className="text-[11px] opacity-80 font-medium mt-1">{sub}</div>
    </button>
  );
}
