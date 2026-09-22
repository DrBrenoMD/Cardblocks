import { useState, FormEvent, useRef, ChangeEvent } from 'react';
import { useStore, Deck, Flashcard } from '../store/useStore';
import { Page } from '../App';
import { Plus, Trash2, Folder, ChevronRight, ChevronDown, GripVertical, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { Heatmap } from '../components/Heatmap';
import { useTranslation } from '../lib/i18n';

interface HomeProps {
  onNavigate: (page: Page) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const { decks, cards, createDeck, deleteDeck, moveDeck, importApkgCards } = useStore();
  const [newDeckName, setNewDeckName] = useState('');
  const [expandedDecks, setExpandedDecks] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const apkgInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      let parsedCards: { front: string, back: string, tags: string[], originalDeckId: string }[] = [];
      let deckNamesByAnkiId: Record<string, string> = {};
      let fileName = file.name.replace(/\.[^/.]+$/, "");

      if (ext === 'apkg') {
        const { importFromApkg } = await import('../lib/anki');
        const res = await importFromApkg(file);
        parsedCards = res.parsedCards;
        fileName = res.fileName;
        const ankiDecks = Object.values(res.decksMap || {});
        for (const d of ankiDecks) {
          deckNamesByAnkiId[d.id] = d.name;
        }
      } else if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : (data.cards || []);
        parsedCards = arr.map((c: any) => ({
          front: c.front || c.question || '',
          back: c.back || c.answer || '',
          tags: Array.isArray(c.tags) ? c.tags : (c.tags ? c.tags.split(',') : []),
          originalDeckId: 'default'
        }));
        deckNamesByAnkiId['default'] = fileName;
      } else if (ext === 'csv') {
        const text = await file.text();
        const rows = text.split('\n');
        parsedCards = rows.map(r => {
          const cols = r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            front: cols[0] || '',
            back: cols[1] || '',
            tags: cols[2] ? cols[2].split(' ') : [],
            originalDeckId: 'default'
          };
        }).filter(c => c.front || c.back);
        deckNamesByAnkiId['default'] = fileName;
      } else {
        throw new Error('Unsupported file format');
      }
      
      const createdDecksByName: Record<string, string> = {};
      const { createDeck, importApkgCards, decks } = useStore.getState();

      const getOrCreateDeckByPath = (path: string): string => {
        if (createdDecksByName[path]) return createdDecksByName[path];
        
        let currentPath = '';
        let parentId: string | null = null;
        
        const parts = path.split('::');
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}::${part}` : part;
          
          if (!createdDecksByName[currentPath]) {
            // Check if it already exists in the store by name and parent
            const existing = decks.find(d => d.name === part && d.parentId === parentId);
            if (existing) {
              createdDecksByName[currentPath] = existing.id;
            } else {
              const newId = createDeck(part, parentId);
              createdDecksByName[currentPath] = newId;
            }
          }
          parentId = createdDecksByName[currentPath];
        }
        return createdDecksByName[path];
      };
      
      const defaultDeckId = getOrCreateDeckByPath(fileName || "Imported Deck");

      const cardsByDeckId: Record<string, Omit<Flashcard, 'id'|'deckId'>[]> = {};
      let importCount = 0;

      for (const c of parsedCards) {
        const dName = deckNamesByAnkiId[c.originalDeckId];
        const targetDeckId = dName ? getOrCreateDeckByPath(dName) : defaultDeckId;
        
        if (!cardsByDeckId[targetDeckId]) {
          cardsByDeckId[targetDeckId] = [];
        }
        cardsByDeckId[targetDeckId].push({
          front: c.front,
          back: c.back,
          tags: c.tags,
          repetition: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: Date.now(),
          createdAt: Date.now(),
          isSuspended: false,
          isBuried: false,
        });
        importCount++;
      }

      for (const [deckId, cards] of Object.entries(cardsByDeckId)) {
        if (cards.length > 0) {
          importApkgCards(deckId, cards as any);
        }
      }
      
      alert(`Imported ${importCount} cards successfully.`);
      setShowCreateModal(false);
    } catch (err: any) {
      alert(`Error importing deck: ${err.message}`);
    } finally {
      if (apkgInputRef.current) apkgInputRef.current.value = '';
      setImporting(false);
    }
  };
  
  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createDeck(newDeckName.trim(), null);
    setNewDeckName('');
    setShowCreateModal(false);
  };

  const getDueCardsCount = (deckId: string) => {
    const now = Date.now();
    // Recursively get all children deck ids
    const getSubdecks = (id: string): string[] => {
      const children = decks.filter(d => d.parentId === id).map(d => d.id);
      let all = [...children];
      children.forEach(child => all = [...all, ...getSubdecks(child)]);
      return all;
    };
    const allIds = [deckId, ...getSubdecks(deckId)];
    return cards.filter(c => allIds.includes(c.deckId) && c.nextReviewDate <= now && !c.isSuspended && !c.isBuried).length;
  };

  const getTotalCount = (deckId: string) => {
    const getSubdecks = (id: string): string[] => {
      const children = decks.filter(d => d.parentId === id).map(d => d.id);
      let all = [...children];
      children.forEach(child => all = [...all, ...getSubdecks(child)]);
      return all;
    };
    const allIds = [deckId, ...getSubdecks(deckId)];
    return cards.filter(c => allIds.includes(c.deckId)).length;
  };

  const toggleExpand = (id: string) => {
    setExpandedDecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderDeckTree = (parentId: string | null = null, depth = 0) => {
    const levelDecks = decks.filter(d => (d.parentId || null) === parentId);
    
    return levelDecks.map(deck => {
      const dueCount = getDueCardsCount(deck.id);
      const totalCount = getTotalCount(deck.id);
      const hasChildren = decks.some(d => d.parentId === deck.id);
      const isExpanded = expandedDecks[deck.id];

      return (
        <div 
          key={deck.id} 
          className="w-full"
        >
          <div 
             className="glass-panel p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative group hover:ring-1 hover:ring-indigo-500/50 transition-all shadow-sm"
             style={{ marginLeft: `${depth * 1.5}rem` }}
             draggable
             onDragStart={(e) => {
               e.dataTransfer.setData('deckId', deck.id);
               // Add a slight transparency to the dragging element
               e.currentTarget.style.opacity = '0.5';
             }}
             onDragEnd={(e) => {
               e.currentTarget.style.opacity = '1';
             }}
             onDragOver={(e) => {
               e.preventDefault(); // Necessary to allow dropping
               e.dataTransfer.dropEffect = 'move';
             }}
             onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const sourceId = e.dataTransfer.getData('deckId');
                if (sourceId && sourceId !== deck.id) {
                  moveDeck(sourceId, deck.id);
                  setExpandedDecks(prev => ({ ...prev, [deck.id]: true }));
                }
             }}
          >
            <div className="flex items-center gap-3 overflow-hidden">
               <div className="text-white/20 cursor-grab active:cursor-grabbing hover:text-ui-muted">
                 <GripVertical className="w-4 h-4" />
               </div>
               {hasChildren ? (
                 <button onClick={(e) => { e.stopPropagation(); toggleExpand(deck.id) }} className="text-ui-muted hover:text-ui-text p-1">
                   {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                 </button>
               ) : (
                 <div className="w-7"></div>
               )}
               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'browse', deckId: deck.id }) }}
                 className="text-ui-muted hover:text-primary transition-colors"
                 title="Browse cards in this deck"
               >
                 <Folder className="w-5 h-5" />
               </button>
               <h3 className="font-semibold text-lg text-ui-text truncate" title={deck.name}>
                 {deck.name}
               </h3>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:ml-auto">
               <div className="flex gap-2 text-sm mr-2">
                 <div className="px-3 py-1 rounded bg-primary/20 text-primary font-medium whitespace-nowrap">
                   {dueCount} Due
                 </div>
                 <div className="px-3 py-1 rounded bg-ui-surface text-ui-muted font-medium whitespace-nowrap">
                   {totalCount} Cards
                 </div>
               </div>
               
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   const subName = prompt(`Name for new subdeck under "${deck.name}":`);
                   if (subName && subName.trim()) {
                     createDeck(subName.trim(), deck.id);
                     setExpandedDecks(prev => ({ ...prev, [deck.id]: true }));
                   }
                 }}
                 className="p-2 bg-ui-surface text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover rounded-xl transition-colors"
                 title="Add Subdeck"
               >
                 <Plus className="w-4 h-4" />
               </button>

               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'deck', deckId: deck.id }) }}
                 className="px-3 py-1.5 bg-ui-surface border border-ui-border font-medium text-ui-text hover:bg-ui-surface-hover rounded-lg text-sm transition-colors"
               >
                 Manage
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); onNavigate({ type: 'study', deckId: deck.id }) }}
                 disabled={dueCount === 0}
                 className="px-4 py-1.5 bg-primary font-medium text-ui-text hover:bg-primary-hover disabled:opacity-50 disabled:bg-primary/50 rounded-lg text-sm transition-colors"
               >
                 Study
               </button>
               
               <button 
                 onClick={(e) => {
                   e.preventDefault();
                   if (confirm(`Are you sure you want to delete "${deck.name}" and ALL its subdecks and cards?`)) {
                     deleteDeck(deck.id);
                   }
                 }}
                 className="text-ui-muted hover:text-red-400 p-2 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                 title="Delete deck"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="mt-2 space-y-2">
               {renderDeckTree(deck.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ui-text">{t.home.decks}</h2>
          <p className="text-ui-muted mt-1">{t.home.search}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-ui-text px-4 py-2 rounded-lg font-medium hover:bg-primary-hover flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.home.createDeck}</span>
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[#0A0D14]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ui-surface border border-ui-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col mt-[-10vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-ui-border">
              <h3 className="font-semibold text-lg text-ui-text">Add Deck</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-ui-muted hover:text-ui-text p-1 rounded-full hover:bg-ui-surface-hover transition-colors"
              >
                <Trash2 className="w-4 h-4 opacity-0" /> {/* Just spacing, use pure layout or an 'X' icon if imported. Using generic close button */}
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              <form onSubmit={handleCreate} className="space-y-3">
                <label className="block text-sm font-medium text-ui-muted">New Deck Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder={t.home.deckNameLabel}
                    autoFocus
                    className="flex-1 px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-ui-text placeholder-ui-muted focus:outline-none focus:border-primary focus:bg-ui-surface transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={!newDeckName.trim()}
                    className="bg-primary text-ui-text px-4 py-2 rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors shrink-0"
                  >
                    Create
                  </button>
                </div>
              </form>

              <div className="relative">
                 <div className="absolute inset-0 flex items-center">
                   <span className="w-full border-t border-ui-border"></span>
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-ui-surface px-2 text-ui-muted">Or import</span>
                 </div>
              </div>

              <div>
                <input 
                  type="file" 
                  accept=".apkg,.csv,.json" 
                  className="hidden" 
                  ref={apkgInputRef} 
                  onChange={handleImportFile} 
                />
                <button
                  onClick={() => apkgInputRef.current?.click()}
                  disabled={importing}
                  className="w-full bg-ui-background border border-ui-border text-ui-text px-4 py-3 rounded-lg font-medium hover:bg-ui-surface-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importing ? "Importing..." : "Import Deck (.apkg, .csv, .json)"}</span>
                </button>
                <p className="text-xs text-ui-muted text-center mt-2">
                  Imports flashcards, tags, and deck structures from Anki.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="glass-panel text-center py-16 rounded-xl border-dashed">
          <Folder className="w-12 h-12 text-ui-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ui-text mb-2">{t.home.noDecks}</h3>
          <p className="text-ui-muted">{t.home.search}</p>
        </div>
      ) : (
        <div 
          className="flex flex-col gap-2 min-h-[50px] pb-10"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
             e.preventDefault();
             const sourceId = e.dataTransfer.getData('deckId');
             if (sourceId) {
               moveDeck(sourceId, null);
             }
          }}
        >
          {renderDeckTree(null, 0)}
          
          <div className="mt-4 p-4 border-2 border-dashed border-ui-border rounded-xl text-center text-ui-muted text-sm hidden group-[.is-dragging]:block">
             Drop here to move to root level
          </div>
        </div>
      )}
      
      <Heatmap onNavigate={onNavigate} />
    </div>
  );
}
