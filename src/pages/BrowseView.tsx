import React, { useState, useMemo, forwardRef } from 'react';
import { useStore, Flashcard } from '../store/useStore';
import { Page } from '../App';
import { Search, Folder, ChevronRight, ChevronDown, Edit2, Trash2, X, Eye, EyeOff, Calendar, Archive } from 'lucide-react';
import { cn, renderCardText, formatShortcutEvent, matchShortcut } from '../lib/utils';
import { CardEditor } from '../components/CardEditor';
import { IsolatedHtml } from '../components/IsolatedHtml';
import { sanitizeHtml } from '../lib/utils';
import { TableVirtuoso } from 'react-virtuoso';
import { format } from 'date-fns';

const AVAILABLE_COLUMNS = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'details', label: 'Details' },
  { id: 'tags', label: 'Tags' },
  { id: 'due', label: 'Next Review' },
  { id: 'lastReview', label: 'Last Review' },
  { id: 'repetition', label: 'Rev. Count' },
  { id: 'interval', label: 'Interval (Days)' },
  { id: 'createdAt', label: 'Created At' },
];

const AVAILABLE_QUESTION_COLUMNS = [
  { id: 'text', label: 'Pergunta' },
  { id: 'correctAnswer', label: 'Resposta Correta' },
  { id: 'bank', label: 'Banco de Questões' },
  { id: 'status', label: 'Status' },
  { id: 'markedAnswer', label: 'Resposta Marcada' },
  { id: 'timesDone', label: 'Vezes Realizada' },
  { id: 'explanation', label: 'Explicação' },
  { id: 'subject', label: 'Matéria' },
  { id: 'specialty', label: 'Especialidade' },
  { id: 'area', label: 'Área' },
  { id: 'topic', label: 'Tema' },
  { id: 'subtopic', label: 'Subtema' },
  { id: 'timeTaken', label: 'Tempo Médio' },
];

export const BrowseView: React.FC<{ onNavigate: (page: Page) => void, initialDate?: string, initialDeckId?: string, initialBrowseType?: 'flashcards' | 'questions' }> = ({ onNavigate, initialDate, initialDeckId, initialBrowseType }) => {
  const { decks, cards, updateCard, deleteCard, reviewHistory, bulkEditCards, questionBanks, questions, deleteQuestion, notebookHistory } = useStore();
  const [browseType, setBrowseType] = useState<'flashcards' | 'questions'>(initialBrowseType || 'flashcards');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId || null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFlag, setFilterFlag] = useState<string | null>(null);
  const [expandedDecks, setExpandedDecks] = useState<Record<string, boolean>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [checkedCardIds, setCheckedCardIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, cardId: string } | null>(null);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  
  // Flashcard table state
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    front: true,
    back: true,
    details: true,
    tags: true,
    due: true,
    lastReview: false,
    repetition: false,
    interval: false,
    createdAt: false
  });
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'due', direction: 'asc' });

  // Question table state
  const [showQuestionColumnDropdown, setShowQuestionColumnDropdown] = useState(false);
  const [visibleQuestionColumns, setVisibleQuestionColumns] = useState<Record<string, boolean>>({
    text: true,
    correctAnswer: false,
    bank: true,
    status: true,
    markedAnswer: false,
    timesDone: false,
    explanation: false,
    subject: true,
    specialty: false,
    area: true,
    topic: false,
    subtopic: false,
    timeTaken: false
  });
  const [sortQuestionConfig, setSortQuestionConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'text', direction: 'asc' });


  // Derive available tags and flags across all displayed cards
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach(c => c.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [cards]);

  const availableQuestionTags = useMemo(() => {
    const tags = new Set<string>();
    questions.forEach(q => q.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [questions]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      
      const s = useStore.getState().settings.shortcuts || {
        showAnswer: 'space', again: '1', hard: '2', good: '3', easy: '4', playTTS: 'p', bury: 'ctrl+k', suspend: 'ctrl+j', undo: 'ctrl+z', redo: 'ctrl+shift+z|ctrl+y'
      };

      if (matchShortcut(e as any, s.undo)) {
        e.preventDefault();
        useStore.temporal.getState().undo();
        return;
      }
      if (matchShortcut(e as any, s.redo)) {
        e.preventDefault();
        useStore.temporal.getState().redo();
        return;
      }

      // If cards are selected (checked), apply bury/suspend to them via bulk edit
      if (checkedCardIds.size > 0 || selectedCardId) {
        const ids: string[] = checkedCardIds.size > 0 ? Array.from(checkedCardIds) : [selectedCardId as string];
        if (matchShortcut(e as any, s.suspend)) {
          e.preventDefault();
          const targetCards = useStore.getState().cards.filter(c => ids.includes(c.id));
          const allSuspended = targetCards.every(c => c.isSuspended);
          useStore.getState().bulkEditCards(ids, { isSuspended: !allSuspended });
          setCheckedCardIds(new Set());
        } else if (matchShortcut(e as any, s.bury)) {
          e.preventDefault();
          const targetCards = useStore.getState().cards.filter(c => ids.includes(c.id));
          const allBuried = targetCards.every(c => c.isBuried);
          useStore.getState().bulkEditCards(ids, { isBuried: !allBuried });
          setCheckedCardIds(new Set());
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkedCardIds, selectedCardId]);

  const toggleExpand = (id: string) => {
    setExpandedDecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderDeckTree = (parentId: string | null, depth: number) => {
    const children = decks.filter(d => d.parentId === parentId);
    if (children.length === 0) return null;

    return children.map(deck => {
      const isExpanded = expandedDecks[deck.id];
      const hasChildren = decks.some(d => d.parentId === deck.id);
      const isSelected = selectedDeckId === deck.id;

      return (
        <div key={deck.id} className="w-full">
          <div 
             className={cn(
               "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm group transition-colors",
               isSelected ? "bg-primary/20 text-primary" : "hover:bg-ui-surface text-ui-muted hover:text-ui-text"
             )}
             style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
             onClick={() => setSelectedDeckId(deck.id)}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
               {hasChildren && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     toggleExpand(deck.id);
                   }} 
                   className="text-ui-muted hover:text-ui-text"
                 >
                   {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                 </button>
               )}
            </div>
            <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-ui-muted group-hover:text-ui-muted")} />
            <span className="truncate flex-1">{deck.name}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="mt-0.5">
              {renderDeckTree(deck.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Filter cards
  const filteredCards = useMemo(() => {
    let result = cards;

    // Filter by deck (including children)
    if (selectedDeckId) {
      const getSubdeckIds = (id: string): string[] => {
        const subDecks = decks.filter(d => d.parentId === id).map(d => d.id);
        let all = [id, ...subDecks];
        subDecks.forEach(subId => {
          all = [...all, ...getSubdeckIds(subId)];
        });
        return all;
      };
      
      const allowedDeckIds = new Set(getSubdeckIds(selectedDeckId));
      result = result.filter(c => allowedDeckIds.has(c.deckId));
    }

    // Filter by date
    if (selectedDate) {
      const reviewedIds = new Set((reviewHistory || {})[selectedDate] || []);
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      result = result.filter(c => {
        if (reviewedIds.has(c.id)) return true;
        if (c.repetition === 0 || c.nextReviewDate < now.getTime()) {
          return selectedDate === todayStr;
        }
        const d = new Date(c.nextReviewDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${dayStr}` === selectedDate;
      });
    }

    // Filter by tag
    if (filterTag) {
      result = result.filter(c => c.tags?.includes(filterTag));
    }

    // Filter by flag
    if (filterFlag !== null) {
      result = result.filter(c => (c.flag || '') === filterFlag);
    }

    // Filter by status
    if (filterStatus === 'suspended') {
      result = result.filter(c => c.isSuspended);
    } else if (filterStatus === 'buried') {
      result = result.filter(c => c.isBuried);
    } else if (filterStatus === 'active') {
      result = result.filter(c => !c.isSuspended && !c.isBuried);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.front.toLowerCase().includes(query) || 
        c.back.toLowerCase().includes(query) ||
        (c.details && c.details.toLowerCase().includes(query))
      );
    }

    // Sort
    return result.sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortConfig.key) {
        case 'front': 
          valA = a.front.replace(/<[^>]+>/g, '').trim().toLowerCase(); 
          valB = b.front.replace(/<[^>]+>/g, '').trim().toLowerCase(); 
          break;
        case 'back': 
          valA = a.back.replace(/<[^>]+>/g, '').trim().toLowerCase(); 
          valB = b.back.replace(/<[^>]+>/g, '').trim().toLowerCase(); 
          break;
        case 'due': 
          valA = a.nextReviewDate; 
          valB = b.nextReviewDate; 
          break;
        case 'lastReview':
          valA = a.repetition > 0 ? (a.nextReviewDate - a.interval * 60 * 1000) : 0;
          valB = b.repetition > 0 ? (b.nextReviewDate - b.interval * 60 * 1000) : 0;
          break;
        case 'repetition':
          valA = a.repetition;
          valB = b.repetition;
          break;
        case 'interval':
          valA = a.interval;
          valB = b.interval;
          break;
        case 'createdAt':
          valA = a.createdAt;
          valB = b.createdAt;
          break;
        default:
          valA = a.createdAt;
          valB = b.createdAt;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [cards, decks, selectedDeckId, searchQuery, selectedDate, filterTag, filterFlag, filterStatus, reviewHistory, sortConfig]);

  const filteredQuestions = useMemo(() => {
    let q = questions;

    if (selectedDate) {
      const qIdsForDate = new Set<string>();
      notebookHistory.forEach(h => {
        const dateStr = format(new Date(h.completedAt), 'yyyy-MM-dd');
        if (dateStr === selectedDate && h.results) {
          Object.keys(h.results).forEach(id => qIdsForDate.add(id));
        }
      });
      q = q.filter(x => qIdsForDate.has(x.id));
    }

    if (selectedBankId) {
      q = q.filter(x => x.bankId === selectedBankId);
    }
    if (filterTag) {
      q = q.filter(x => x.tags?.includes(filterTag));
    }
    if (filterFlag) {
      q = q.filter(x => (x.flag || '') === filterFlag);
    }
    if (searchQuery) {
      const qLower = searchQuery.toLowerCase();
      q = q.filter(x => 
        (x.text || '').toLowerCase().includes(qLower) || 
        (x.subject || '').toLowerCase().includes(qLower) ||
        (x.area || '').toLowerCase().includes(qLower)
      );
    }
    
    return q.sort((a, b) => {
      let valA: any = a[sortQuestionConfig.key as keyof typeof a] || '';
      let valB: any = b[sortQuestionConfig.key as keyof typeof b] || '';

      if (sortQuestionConfig.key === 'text') {
        const stripHtml = (h: string) => { const t = document.createElement('div'); t.innerHTML=sanitizeHtml(h); return t.textContent||t.innerText; };
        valA = stripHtml(a.text).toLowerCase();
        valB = stripHtml(b.text).toLowerCase();
      } else if (sortQuestionConfig.key === 'bank') {
        valA = questionBanks.find(bk => bk.id === a.bankId)?.name?.toLowerCase() || '';
        valB = questionBanks.find(bk => bk.id === b.bankId)?.name?.toLowerCase() || '';
      } else if (sortQuestionConfig.key === 'status' || sortQuestionConfig.key === 'timesDone') {
        // Compute history metrics
        const getMetrics = (id: string) => {
           let done = 0; let corrects = 0;
           notebookHistory.forEach(h => {
             if (h.results && h.results[id] !== undefined) { done++; if (h.results[id]) corrects++; }
           });
           return { done, corrects };
        };
        const mA = getMetrics(a.id);
        const mB = getMetrics(b.id);
        
        if (sortQuestionConfig.key === 'timesDone') {
          valA = mA.done; valB = mB.done;
        } else {
          valA = mA.done === 0 ? 0 : (mA.corrects/mA.done);
          valB = mB.done === 0 ? 0 : (mB.corrects/mB.done);
        }
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortQuestionConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortQuestionConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [questions, selectedBankId, searchQuery, selectedDate, notebookHistory, questionBanks, sortQuestionConfig]);

  const selectedCard = cards.find(c => c.id === selectedCardId);

  const toggleCardCheck = (id: string) => {
    setCheckedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllChecks = () => {
    if (checkedCardIds.size === filteredCards.length && filteredCards.length > 0) {
      setCheckedCardIds(new Set());
    } else {
      setCheckedCardIds(new Set(filteredCards.map(c => c.id)));
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0 md:h-full flex flex-col bg-ui-surface border border-ui-border rounded-xl overflow-hidden h-48 md:h-auto">
        <div className="flex border-b border-ui-border p-2 gap-1 sticky top-0 bg-[#0A0D14]/80 backdrop-blur-sm z-10 shrink-0">
          <button 
            onClick={() => setBrowseType('flashcards')}
            className={cn("flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition-colors", browseType === 'flashcards' ? "bg-ui-surface-hover text-ui-text border border-ui-border" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover")}
          >
            Decks
          </button>
          <button 
            onClick={() => setBrowseType('questions')}
            className={cn("flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition-colors", browseType === 'questions' ? "bg-ui-surface-hover text-ui-text border border-ui-border" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover")}
          >
            Banks
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {browseType === 'flashcards' && (
            <>
              <div 
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                  selectedDeckId === null ? "bg-primary/20 text-primary" : "hover:bg-ui-surface text-ui-muted hover:text-ui-text"
                )}
                onClick={() => setSelectedDeckId(null)}
              >
                <div className="w-5 h-5 shrink-0" />
                <Folder className={cn("w-4 h-4 shrink-0", selectedDeckId === null ? "text-primary" : "text-ui-muted")} />
                <span className="truncate flex-1">All Decks</span>
              </div>
              {renderDeckTree(null, 0)}
            </>
          )}

          {browseType === 'questions' && (
            <>
              <div 
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                  selectedBankId === null ? "bg-primary/20 text-primary" : "hover:bg-ui-surface text-ui-muted hover:text-ui-text"
                )}
                onClick={() => setSelectedBankId(null)}
              >
                <div className="w-5 h-5 shrink-0" />
                <Folder className={cn("w-4 h-4 shrink-0", selectedBankId === null ? "text-primary" : "text-ui-muted")} />
                <span className="truncate flex-1">All Banks</span>
              </div>
              {questionBanks.map(bank => (
                <div 
                   key={bank.id}
                   className={cn(
                     "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                     selectedBankId === bank.id ? "bg-primary/20 text-primary" : "hover:bg-ui-surface text-ui-muted hover:text-ui-text"
                   )}
                   onClick={() => setSelectedBankId(bank.id)}
                >
                  <div className="w-5 h-5 shrink-0" />
                  <Archive className={cn("w-4 h-4 shrink-0", selectedBankId === bank.id ? "text-primary" : "text-ui-muted")} />
                  <span className="truncate flex-1">{bank.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-ui-surface border border-ui-border rounded-xl overflow-hidden h-full">
        {browseType === 'flashcards' ? (
          <>
            {/* Search */}
            <div className="p-4 border-b border-ui-border flex flex-col sm:flex-row gap-3 relative">
              <div className="relative flex-1">
            <Search className="w-5 h-5 text-ui-muted absolute left-3 top-2.5" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards..."
              className="w-full bg-ui-surface border border-ui-border rounded-xl py-2 pl-10 pr-4 text-ui-text placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tag Filter */}
          <div className="relative flex items-center shrink-0">
            <select
              value={filterTag || ''}
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-3 pr-8 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">All Tags</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Flag Filter */}
          <div className="relative flex items-center shrink-0">
            <select
              value={filterFlag || ''}
              onChange={(e) => setFilterFlag(e.target.value || null)}
              className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-3 pr-8 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">All Flags</option>
              <option value="red">Red</option>
              <option value="orange">Orange</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="purple">Purple</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center shrink-0">
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-3 pr-8 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="buried">Buried</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          
          {/* Date Filter */}
          <div className="relative flex items-center shrink-0">
             <Calendar className="w-4 h-4 text-ui-muted absolute left-3" />
             <input
               type="date"
               value={selectedDate || ''}
               onChange={(e) => setSelectedDate(e.target.value || null)}
               className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-9 pr-6 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
             />
             {selectedDate && (
               <button onClick={() => setSelectedDate(null)} className="absolute right-2 text-ui-muted hover:text-ui-text">
                 <X className="w-4 h-4" />
               </button>
             )}
          </div>

          {/* Study Button */}
          {filteredCards.length > 0 && (
            <div className="flex shrink-0 gap-2 items-center">
              <button 
                onClick={() => setExpandAll(!expandAll)}
                className="whitespace-nowrap px-3 py-2 bg-ui-surface-hover border border-ui-border hover:bg-ui-surface text-ui-text rounded-lg transition-colors text-sm font-medium shrink-0 flex items-center justify-center"
              >
                {expandAll ? 'Collapse All' : 'Expand All'}
              </button>
              <button
                onClick={() => {
                  const targets = checkedCardIds.size > 0 
                    ? Array.from(checkedCardIds) 
                    : filteredCards.map(c => c.id);
                  onNavigate({ type: 'study', cardIds: targets });
                }}
                className="whitespace-nowrap px-4 py-2 bg-primary-hover hover:bg-primary text-ui-text rounded-lg transition-colors text-sm font-medium shrink-0 flex items-center justify-center"
              >
                Study {checkedCardIds.size > 0 ? checkedCardIds.size : filteredCards.length} Cards
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
           {/* Bulk Action Bar */}
           {checkedCardIds.size > 0 && (
             <div className="bg-primary/20 border-b border-primary/30 p-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
               <div className="text-sm font-medium text-primary ml-2 md:ml-4">
                 {checkedCardIds.size} card{checkedCardIds.size > 1 ? 's' : ''} selected
               </div>
               <div className="flex flex-wrap items-center gap-2 mr-2 ml-2 md:ml-0">
                 <select
                   className="bg-ui-surface-hover hover:bg-ui-surface-hover text-ui-text text-xs rounded border border-ui-border p-1"
                   onChange={(e) => {
                     const deckId = e.target.value;
                     if (deckId) {
                       bulkEditCards(Array.from(checkedCardIds), { deckId });
                       e.target.value = '';
                       setCheckedCardIds(new Set());
                     }
                   }}
                 >
                   <option value="">Move to Deck...</option>
                   {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                 </select>

                 <select
                   className="bg-ui-surface-hover hover:bg-ui-surface-hover text-ui-text text-xs rounded border border-ui-border p-1"
                   onChange={(e) => {
                     const flag = e.target.value;
                     bulkEditCards(Array.from(checkedCardIds), { flag: flag === 'none' ? '' : flag });
                     e.target.value = '';
                     setCheckedCardIds(new Set());
                   }}
                 >
                   <option value="">Set Flag...</option>
                   <option value="none">None</option>
                   <option value="red">Red</option>
                   <option value="orange">Orange</option>
                   <option value="green">Green</option>
                   <option value="blue">Blue</option>
                   <option value="purple">Purple</option>
                 </select>

                 <button
                   className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs rounded border border-yellow-500/30 px-2 py-1"
                   onClick={() => {
                     const isSuspending = !Array.from(checkedCardIds).some(id => cards.find(c => c.id === id)?.isSuspended);
                     bulkEditCards(Array.from(checkedCardIds), { isSuspended: isSuspending, isBuried: false });
                     setCheckedCardIds(new Set());
                   }}
                 >
                   {Array.from(checkedCardIds).some(id => cards.find(c => c.id === id)?.isSuspended) ? 'Unsuspend' : 'Suspend'}
                 </button>

                 <button
                   className="bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 text-xs rounded border border-slate-500/30 px-2 py-1"
                   onClick={() => {
                     const isBurying = !Array.from(checkedCardIds).some(id => cards.find(c => c.id === id)?.isBuried);
                     bulkEditCards(Array.from(checkedCardIds), { isBuried: isBurying, isSuspended: false });
                     setCheckedCardIds(new Set());
                   }}
                 >
                   {Array.from(checkedCardIds).some(id => cards.find(c => c.id === id)?.isBuried) ? 'Unbury' : 'Bury'}
                 </button>
                 
                 <button
                   className="bg-ui-surface-hover hover:bg-ui-surface-hover text-ui-text text-xs rounded border border-ui-border px-2 py-1"
                   onClick={() => {
                     const tag = prompt('Enter tag to add:');
                     if (tag && tag.trim()) {
                       const t = tag.trim().toLowerCase();
                       const oldCards = cards.filter(c => checkedCardIds.has(c.id));
                       // Doing it via individual updates since bulk edit currently overwrites tags array:
                       oldCards.forEach(c => {
                         const currentTags = c.tags || [];
                         if (!currentTags.includes(t)) {
                           updateCard(c.id, c.front, c.back, c.details, [...currentTags, t], c.flag);
                         }
                       });
                       setCheckedCardIds(new Set());
                     }
                   }}
                 >
                   Add Tag
                 </button>
                 
                 <button
                   className="bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded border border-red-500/30 px-2 py-1"
                   onClick={() => {
                     if (confirm(`Delete ${checkedCardIds.size} selected cards?`)) {
                       checkedCardIds.forEach(id => deleteCard(id));
                       setCheckedCardIds(new Set());
                     }
                   }}
                 >
                   Delete
                 </button>
               </div>
             </div>
           )}

           {/* Card List */}
           <div className="flex-1 overflow-y-auto custom-scrollbar">
             <TableVirtuoso
               className="w-full h-full text-sm text-left custom-scrollbar"
               data={filteredCards}
               components={{
                 Table: (props) => <table className="w-full text-sm text-left" {...props} />,
                 TableHead: forwardRef((props, ref) => <thead className="text-xs text-ui-muted uppercase bg-ui-surface sticky top-0 backdrop-blur-md z-10" {...props} ref={ref as any} />),
                 TableRow: (props) => {
                   const idx = props['data-index'] as number;
                   const card = filteredCards[idx];
                   return (
                     <tr 
                       {...props} 
                       onContextMenu={(e) => {
                         if (card) {
                           e.preventDefault();
                           setContextMenu({ x: e.clientX, y: e.clientY, cardId: card.id });
                           if (!checkedCardIds.has(card.id)) {
                             setSelectedCardId(card.id);
                           }
                         }
                       }}
                     />
                   );
                 },
                 TableBody: forwardRef((props, ref) => <tbody className="divide-y divide-white/5" {...props} ref={ref as any} />),
               }}
               fixedHeaderContent={() => (
                 <tr>
                   <th className="px-4 py-3 font-medium w-10">
                     <input 
                       type="checkbox" 
                       className="rounded border-white/20 bg-ui-surface"
                       checked={checkedCardIds.size === filteredCards.length && filteredCards.length > 0}
                       onChange={toggleAllChecks}
                     />
                   </th>
                   {AVAILABLE_COLUMNS.map(col => {
                     if (!visibleColumns[col.id]) return null;
                     const isSorted = sortConfig.key === col.id;
                     return (
                       <th 
                         key={col.id} 
                         className="px-4 py-3 font-medium hover:bg-ui-surface-hover select-none border-r border-ui-border/30 resize-x overflow-hidden max-w-[500px]"
                       >
                         <div 
                           className="flex items-center gap-1 cursor-pointer w-full h-full min-w-[80px]"
                           onClick={() => {
                             if (isSorted) {
                               setSortConfig({ key: col.id, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                             } else {
                               setSortConfig({ key: col.id, direction: 'asc' });
                             }
                           }}
                         >
                           {col.label}
                           {isSorted && (
                             <span className="text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                           )}
                         </div>
                       </th>
                     );
                   })}
                   <th className="px-4 py-3 font-medium w-10 text-right relative">
                     <button 
                       onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                       className="p-1 hover:bg-ui-surface-hover rounded text-ui-text"
                       title="Columns"
                     >
                        <Eye className="w-4 h-4" />
                     </button>
                     {showColumnDropdown && (
                       <div className="absolute right-0 top-full mt-1 bg-ui-surface border border-ui-border rounded shadow-lg p-2 z-50 flex flex-col gap-1 text-ui-text normal-case w-48 text-left">
                         {AVAILABLE_COLUMNS.map(col => (
                           <label key={col.id} className="flex items-center gap-2 cursor-pointer text-sm">
                             <input 
                               type="checkbox"
                               checked={!!visibleColumns[col.id]}
                               onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.id]: e.target.checked }))}
                             />
                             {col.label}
                           </label>
                         ))}
                       </div>
                     )}
                   </th>
                 </tr>
               )}
               itemContent={(_, card) => {
                 const stripHtml = (html: string) => {
                   const tmp = document.createElement('div');
                   tmp.innerHTML = sanitizeHtml(html);
                   return tmp.textContent || tmp.innerText || '';
                 };

                  const getFirstImage = (html?: any) => {
                    if (typeof html !== 'string') return null;
                    const match = html.match(/<img[^>]+src=\"([^\">]+)\"/);
                    return match ? match[1] : null;
                  };

                  const frontImg = getFirstImage(card.front) || getFirstImage(card.back);
                  const frontText = stripHtml(card.front);
                  const backText = stripHtml(card.back);
                 const detailsText = stripHtml(card.details || '');
                 const isSelected = selectedCardId === card.id;
                 const isChecked = checkedCardIds.has(card.id);

                 const FLAG_COLORS: Record<string, string> = {
                   'red': 'bg-red-500',
                   'orange': 'bg-orange-500',
                   'green': 'bg-green-500',
                   'blue': 'bg-blue-500',
                   'purple': 'bg-purple-500',
                 };

                 return (
                   <>
                     <td className={cn(
                       "px-4 py-3 w-10 cursor-pointer hover:bg-ui-surface transition-colors",
                       isSelected ? "bg-primary/10" : ""
                     )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                       <input 
                         type="checkbox" 
                         className="rounded border-white/20 bg-ui-surface"
                         checked={isChecked}
                         onChange={() => toggleCardCheck(card.id)}
                         onClick={(e) => e.stopPropagation()}
                       />
                     </td>
                     {visibleColumns.front && (
                       <td className={cn(
                        "px-4 py-3 text-ui-text cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          <div className="flex items-center gap-2">
                            {card.flag && FLAG_COLORS[card.flag] && (
                              <div className={`w-2 h-2 rounded-full shrink-0 ${FLAG_COLORS[card.flag]}`} />
                            )}
                            {card.isSuspended && (
                              <span className="bg-yellow-500/20 text-yellow-300 text-[10px] px-1 rounded-sm border border-yellow-500/30 font-bold uppercase shrink-0">Suspended</span>
                            )}
                            {card.isBuried && (
                              <span className="bg-orange-500/20 text-orange-300 text-[10px] px-1 rounded-sm border border-orange-500/30 font-bold uppercase shrink-0">Buried</span>
                            )}
                            {expandAll ? (
                              <div className={cn("whitespace-pre-wrap break-words max-w-lg mt-1 relative card-content-preview text-xs text-ui-text", card.isSuspended ? "opacity-50 line-through" : "")} dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.front) }} />
                            ) : (
                              <span className={cn("line-clamp-1", card.isSuspended ? "opacity-50 line-through" : "")}>{frontText || ((typeof card.front === 'string' && card.front.includes('<img')) ? '[Image]' : '(Empty)')}</span>
                            )}
                          </div>
                       </td>
                     )}
                     {visibleColumns.back && (
                       <td className={cn(
                        "px-4 py-3 text-ui-muted cursor-pointer hover:bg-ui-surface transition-colors max-w-[200px]",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {expandAll ? (
                            <div className="whitespace-pre-wrap break-words max-w-lg card-content-preview text-xs text-ui-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }} />
                          ) : (
                            <div className="line-clamp-1">{backText || ((typeof card.back === 'string' && card.back.includes('<img')) ? '[Image]' : '(Empty)')}</div>
                          )}
                       </td>
                     )}
                     {visibleColumns.details && (
                       <td className={cn(
                        "px-4 py-3 text-ui-muted cursor-pointer hover:bg-ui-surface transition-colors max-w-[200px]",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {expandAll ? (
                            <div className="whitespace-pre-wrap break-words max-w-lg card-content-preview text-xs text-ui-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.details || '') }} />
                          ) : (
                            <div className="line-clamp-1">{detailsText || ((typeof card.details === 'string' && card.details.includes('<img')) ? '[Image]' : '(Empty)')}</div>
                          )}
                       </td>
                     )}
                     {visibleColumns.tags && (
                       <td className={cn(
                        "px-4 py-3 text-ui-muted cursor-pointer hover:bg-ui-surface transition-colors w-40",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {card.tags && card.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {card.tags.slice(0, 2).map((t: string) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[80px]">{t}</span>
                              ))}
                              {card.tags.length > 2 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-surface-hover text-ui-muted border border-ui-border">+{card.tags.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/20">(None)</span>
                          )}
                       </td>
                     )}
                     {visibleColumns.due && (
                       <td className={cn(
                        "px-4 py-3 text-ui-muted whitespace-nowrap cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {card.repetition === 0 ? 'New' : new Date(card.nextReviewDate).toLocaleDateString()}
                       </td>
                     )}
                     {visibleColumns.lastReview && (
                       <td className={cn(
                         "px-4 py-3 text-ui-muted whitespace-nowrap cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {card.repetition === 0 ? 'Never' : new Date(card.nextReviewDate - card.interval * 60 * 1000).toLocaleDateString()}
                       </td>
                     )}
                     {visibleColumns.repetition && (
                       <td className={cn(
                         "px-4 py-3 text-ui-muted whitespace-nowrap cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {card.repetition}
                       </td>
                     )}
                     {visibleColumns.interval && (
                       <td className={cn(
                         "px-4 py-3 text-ui-muted whitespace-nowrap cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {card.repetition === 0 ? '-' : Math.round((card.interval / (60 * 24)) * 10) / 10}
                       </td>
                     )}
                     {visibleColumns.createdAt && (
                       <td className={cn(
                         "px-4 py-3 text-ui-muted whitespace-nowrap cursor-pointer hover:bg-ui-surface transition-colors",
                         isSelected ? "bg-primary/10" : ""
                       )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}>
                          {new Date(card.createdAt).toLocaleDateString()}
                       </td>
                     )}
                     <td className={cn(
                       "px-4 py-3 w-10 cursor-pointer hover:bg-ui-surface transition-colors",
                       isSelected ? "bg-primary/10" : ""
                     )} onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id); }}></td>
                   </>
                 );
               }}
             />
           </div>

           {/* Editor Panel */}
           {selectedCard && (
             <div className="h-1/2 border-t border-ui-border bg-[#0A0D14] flex flex-col">
                <div className="p-3 border-b border-ui-border flex items-center justify-between bg-ui-surface">
                   <div className="font-medium text-ui-text text-sm flex items-center gap-2">
                     <Edit2 className="w-4 h-4" /> Editing Card
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => {
                         if (confirm("Delete this card permanently?")) {
                           deleteCard(selectedCard.id);
                           setSelectedCardId(null);
                         }
                       }}
                       className="p-1.5 text-ui-muted hover:text-red-400 hover:bg-ui-surface-hover rounded-md transition-colors"
                       title="Delete Card"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                     <button 
                       onClick={() => setSelectedCardId(null)}
                       className="p-1.5 text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover rounded-md transition-colors"
                     >
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                   <CardEditor 
                     key={selectedCard.id} // force re-mount when selected card changes
                     card={selectedCard}
                     onUpdate={(id, f, b, d) => updateCard(id, f, b, d)}
                   />
                </div>
             </div>
           )}
         </div>
         </>
        ) : (
          <>
            <div className="p-4 border-b border-ui-border flex flex-col sm:flex-row gap-3 relative flex-wrap items-center">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-ui-muted absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full bg-ui-surface border border-ui-border rounded-xl py-2 pl-10 pr-4 text-ui-text placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              {/* Tag Filter */}
              <div className="relative flex items-center shrink-0">
                <select
                  value={filterTag || ''}
                  onChange={(e) => setFilterTag(e.target.value || null)}
                  className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-3 pr-8 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option value="">All Tags</option>
                  {availableQuestionTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* Flag Filter */}
              <div className="relative flex items-center shrink-0">
                <select
                  value={filterFlag || ''}
                  onChange={(e) => setFilterFlag(e.target.value || null)}
                  className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-3 pr-8 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option value="">All Flags</option>
                  <option value="red">Red</option>
                  <option value="orange">Orange</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                </select>
              </div>
              
              {/* Date Filter */}
              <div className="relative flex items-center shrink-0">
                 <Calendar className="w-4 h-4 text-ui-muted absolute left-3" />
                 <input
                   type="date"
                   value={selectedDate || ''}
                   onChange={(e) => setSelectedDate(e.target.value || null)}
                   className="bg-ui-surface border border-ui-border rounded-lg py-2 pl-9 pr-6 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                 />
                 {selectedDate && (
                   <button onClick={() => setSelectedDate(null)} className="absolute right-2 text-ui-muted hover:text-ui-text">
                     <X className="w-4 h-4" />
                   </button>
                 )}
              </div>

              {/* Study Button */}
              {filteredQuestions.length > 0 && (
                <div className="flex shrink-0 gap-2 items-center">
                  <button 
                    onClick={() => setExpandAll(!expandAll)}
                    className="whitespace-nowrap px-3 py-2 bg-ui-surface-hover border border-ui-border hover:bg-ui-surface text-ui-text rounded-lg transition-colors text-sm font-medium shrink-0 flex items-center justify-center"
                  >
                    {expandAll ? 'Collapse All' : 'Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const notebookId = useStore.getState().createNotebook({
                        name: 'Custom Study Session',
                        questionIds: filteredQuestions.map(q => q.id),
                        mode: 'training'
                      });
                      onNavigate({ type: 'notebook', notebookId });
                    }}
                    className="whitespace-nowrap px-4 py-2 bg-primary-hover hover:bg-primary text-ui-text rounded-lg transition-colors text-sm font-medium shrink-0 flex items-center justify-center"
                  >
                    Study {filteredQuestions.length} Questions
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
              <TableVirtuoso
                className="w-full h-full text-sm text-left custom-scrollbar"
                data={filteredQuestions}
                components={{
                  Table: (props) => <table className="w-full text-sm text-left" {...props} />,
                  TableHead: forwardRef((props, ref) => <thead className="text-xs text-ui-muted uppercase bg-ui-surface sticky top-0 backdrop-blur-md z-10" {...props} ref={ref as any} />),
                  TableRow: (props) => {
                    const idx = props['data-index'] as number;
                    const card = filteredCards[idx];
                    return (
                      <tr 
                        {...props} 
                        onContextMenu={(e) => {
                          if (card) {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, cardId: card.id });
                            if (!checkedCardIds.has(card.id)) {
                              setSelectedCardId(card.id);
                            }
                          }
                        }}
                      />
                    );
                  },
                  TableBody: forwardRef((props, ref) => <tbody className="divide-y divide-white/5" {...props} ref={ref as any} />),
                }}
                fixedHeaderContent={() => (
                  <tr>
                    {AVAILABLE_QUESTION_COLUMNS.map(col => {
                      if (!visibleQuestionColumns[col.id]) return null;
                      const isSorted = sortQuestionConfig.key === col.id;
                      return (
                        <th 
                          key={col.id} 
                          className="px-4 py-3 font-medium hover:bg-ui-surface-hover select-none border-r border-ui-border/30 resize-x overflow-hidden max-w-[500px] cursor-pointer"
                          onClick={() => {
                            setSortQuestionConfig(curr => ({
                              key: col.id,
                              direction: curr.key === col.id && curr.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {isSorted && (
                              <span className="text-[10px] text-primary">
                                {sortQuestionConfig.direction === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 font-medium w-16 text-right relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowQuestionColumnDropdown(!showQuestionColumnDropdown); }}
                        className="p-1 hover:bg-ui-surface-hover hover:text-ui-text rounded"
                        title="Configure Columns"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {showQuestionColumnDropdown && (
                        <div className="absolute right-0 top-full mt-1 bg-ui-surface border border-ui-border rounded shadow-lg p-2 z-50 flex flex-col gap-1 text-ui-text normal-case w-48 text-left">
                          {AVAILABLE_QUESTION_COLUMNS.map(col => (
                            <label key={col.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input 
                                type="checkbox"
                                checked={!!visibleQuestionColumns[col.id]}
                                onChange={(e) => setVisibleQuestionColumns(prev => ({ ...prev, [col.id]: e.target.checked }))}
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </th>
                  </tr>
                )}
                itemContent={(_, q) => {
                  const stripHtml = (html: string) => {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = sanitizeHtml(html);
                    return tmp.textContent || tmp.innerText || '';
                  };
                  
                  let done = 0;
                  let corrects = 0;
                  let markedAnswer = 'N/A';
                  let timeTakenStr = 'N/A';
                  
                  // Latest history entry for this question
                  const latestHistory = [...notebookHistory]
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .find(h => h.results && h.results[q.id] !== undefined);
                    
                  if (latestHistory) {
                     if (latestHistory.answers && latestHistory.answers[q.id]) {
                        const alt = q.alternatives?.find(x => x.id === latestHistory.answers![q.id]);
                        if (alt) markedAnswer = alt.letter;
                     }
                     if (latestHistory.timeSpentSeconds && latestHistory.timeSpentSeconds[q.id] !== undefined) {
                        timeTakenStr = latestHistory.timeSpentSeconds[q.id] + 's';
                     }
                  }

                  notebookHistory.forEach(h => {
                     if (h.results && h.results[q.id] !== undefined) { 
                        done++; 
                        if (h.results[q.id]) corrects++; 
                     }
                  });
                  
                  const statusLabel = done === 0 ? 'Não Feito' : (corrects > 0 ? 'Certo' : 'Errado');
                  const correctAlt = q.alternatives?.find(x => x.isCorrect);

                  return (
                    <>
                      {visibleQuestionColumns.text && (
                        <td className="px-4 py-3 text-ui-text hover:bg-ui-surface cursor-pointer" onClick={() => onNavigate({ type: 'question', questionId: q.id, bankId: q.bankId })}>
                          <div className={!expandAll ? "line-clamp-2" : "whitespace-pre-wrap break-words max-w-lg"}>{stripHtml(q.text) || '(Empty)'}</div>
                        </td>
                      )}
                      {visibleQuestionColumns.correctAnswer && (
                        <td className="px-4 py-3 text-ui-muted">
                           <div className={!expandAll ? "line-clamp-2" : "whitespace-pre-wrap break-words max-w-lg"}>{correctAlt ? `${correctAlt.letter}: ${stripHtml(correctAlt.text)}` : 'N/A'}</div>
                        </td>
                      )}
                      {visibleQuestionColumns.bank && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {questionBanks.find(bk => bk.id === q.bankId)?.name || 'Unknown'}
                        </td>
                      )}
                      {visibleQuestionColumns.status && (
                        <td className="px-4 py-3 text-ui-muted">
                           {statusLabel}
                        </td>
                      )}
                      {visibleQuestionColumns.markedAnswer && (
                        <td className="px-4 py-3 text-ui-muted text-center">
                           {markedAnswer}
                        </td>
                      )}
                      {visibleQuestionColumns.timesDone && (
                        <td className="px-4 py-3 text-ui-muted text-center">
                           {done}
                        </td>
                      )}
                      {visibleQuestionColumns.explanation && (
                        <td className="px-4 py-3 text-ui-muted">
                           <div className={!expandAll ? "line-clamp-2" : "whitespace-pre-wrap break-words max-w-lg"}>{stripHtml(q.explanation) || 'N/A'}</div>
                        </td>
                      )}
                      {visibleQuestionColumns.subject && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {q.subject || '-'}
                        </td>
                      )}
                      {visibleQuestionColumns.specialty && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {q.specialty || '-'}
                        </td>
                      )}
                      {visibleQuestionColumns.area && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {q.area || '-'}
                        </td>
                      )}
                      {visibleQuestionColumns.topic && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {q.topic || '-'}
                        </td>
                      )}
                      {visibleQuestionColumns.subtopic && (
                        <td className="px-4 py-3 text-ui-muted truncate">
                           {q.subArea || '-'}
                        </td>
                      )}
                      {visibleQuestionColumns.timeTaken && (
                        <td className="px-4 py-3 text-ui-muted text-center">
                           {timeTakenStr}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => onNavigate({ type: 'question', questionId: q.id, bankId: q.bankId })}
                          className="px-3 py-1.5 text-xs font-semibold bg-ui-surface-hover hover:bg-ui-border rounded-lg transition-colors border border-ui-border"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  );
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Context Menu for Cards */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div 
            className="fixed z-50 bg-[#161B22] border border-ui-border rounded-lg shadow-xl text-sm py-1 min-w-[200px]"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 text-xs font-semibold text-ui-muted border-b border-ui-border mb-1">
              Card Actions
            </div>
            <button 
              className="w-full text-left px-4 py-2 hover:bg-ui-surface-hover text-ui-text flex items-center justify-between"
              onClick={() => {
                 onNavigate({ type: 'study', cardIds: [contextMenu.cardId] });
                 setContextMenu(null);
              }}
            >
              Study Card
            </button>
            <button 
              className="w-full text-left px-4 py-2 hover:bg-ui-surface-hover text-ui-text"
              onClick={() => {
                 setPreviewCardId(contextMenu.cardId);
                 setContextMenu(null);
              }}
            >
              Preview Card Images
            </button>
            <div className="h-px bg-ui-border my-1" />
            <button 
              className="w-full text-left px-4 py-2 hover:bg-ui-surface-hover text-ui-text"
              onClick={() => {
                 const card = cards.find(c => c.id === contextMenu.cardId);
                 if (card) {
                   const ids = checkedCardIds.has(contextMenu.cardId) ? Array.from(checkedCardIds) : [contextMenu.cardId];
                   bulkEditCards(ids, { isSuspended: !card.isSuspended, isBuried: false });
                   setCheckedCardIds(new Set());
                 }
                 setContextMenu(null);
              }}
            >
              {cards.find(c => c.id === contextMenu.cardId)?.isSuspended ? 'Unsuspend' : 'Suspend'}
            </button>
            <button 
              className="w-full text-left px-4 py-2 hover:bg-ui-surface-hover text-ui-text"
              onClick={() => {
                 const card = cards.find(c => c.id === contextMenu.cardId);
                 if (card) {
                   const ids = checkedCardIds.has(contextMenu.cardId) ? Array.from(checkedCardIds) : [contextMenu.cardId];
                   bulkEditCards(ids, { isBuried: !card.isBuried, isSuspended: false });
                   setCheckedCardIds(new Set());
                 }
                 setContextMenu(null);
              }}
            >
              {cards.find(c => c.id === contextMenu.cardId)?.isBuried ? 'Unbury' : 'Bury'}
            </button>
            <div className="h-px bg-ui-border my-1" />
            <button 
              className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-400"
              onClick={() => {
                 const ids = checkedCardIds.has(contextMenu.cardId) ? Array.from(checkedCardIds) : [contextMenu.cardId];
                 if (confirm(`Delete ${ids.length} card(s)?`)) {
                   ids.forEach(id => deleteCard(id));
                   setCheckedCardIds(new Set());
                 }
                 setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Preview Card Modal */}
      {previewCardId && cards.find(c => c.id === previewCardId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewCardId(null)}>
           <div className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-ui-border">
                <h3 className="font-semibold text-ui-text text-sm uppercase tracking-wider">Card Preview</h3>
                <button onClick={() => setPreviewCardId(null)} className="text-ui-muted hover:text-ui-text"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-base bg-[#0A0D14]">
                <IsolatedHtml 
                   frontHtml={renderCardText(cards.find(c => c.id === previewCardId)!.front, true)}
                   showBack={true}
                   backHtml={renderCardText(cards.find(c => c.id === previewCardId)!.back, true)}
                   detailsHtml={cards.find(c => c.id === previewCardId)!.details ? renderCardText(cards.find(c => c.id === previewCardId)!.details, true) : undefined}
                />
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
