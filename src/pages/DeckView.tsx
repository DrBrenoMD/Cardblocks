import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useStore, Flashcard } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, Upload, Eye, EyeOff, Download, Tag as TagIcon, Flag, Settings } from 'lucide-react';
import { sanitizeHtml } from '../lib/utils';
import { RichEditor } from '../components/RichEditor';
import { renderCardText } from '../lib/utils';
import { IsolatedHtml } from '../components/IsolatedHtml';
import Papa from 'papaparse';
import { useTranslation } from '../lib/i18n';

interface DeckViewProps {
  deckId: string;
  onNavigate: (page: Page) => void;
}

export function DeckView({ deckId, onNavigate }: DeckViewProps) {
  const { decks, cards, createCard, updateCard, deleteCard, importCardsCsv, exportDeckSet, importDeckSet, updateDeckSettings, settings: globalSettings } = useStore();
  const deck = decks.find(d => d.id === deckId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [details, setDetails] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [flag, setFlag] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  
  const deckCards = cards.filter(c => c.deckId === deckId).sort((a, b) => b.createdAt - a.createdAt);
  const filteredDeckCards = deckCards.filter(c => 
    c.front.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!deck) {
    onNavigate({ type: 'home' });
    return null;
  }

  const handleUpdateDeckSettings = (key: string, value: any) => {
    updateDeckSettings(deck.id, { [key]: value });
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!front.trim()) return;
    createCard(deckId, front.trim(), back.trim(), details.trim(), tags, flag || undefined);
    setFront('');
    setBack('');
    setDetails('');
    setTags([]);
    setFlag('');
    setTagInput('');
  };

  const handleExportDeck = () => {
    const data = exportDeckSet(deckId);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deck-${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUnifiedImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'apkg') {
        const { importFromApkg } = await import('../lib/anki');
        const { decksMap, parsedCards, fileName } = await importFromApkg(file);
        
        const ankiDecks = Object.values(decksMap || {});
        const deckNamesByAnkiId: Record<string, string> = {};
        for (const d of ankiDecks) {
          deckNamesByAnkiId[d.id] = d.name;
        }

        const cardsByDeckId: Record<string, Omit<Flashcard, 'id'|'deckId'>[]> = {};
        let importCount = 0;

        for (const c of parsedCards) {
          // Flatten into this deck instead of creating subdecks
          if (!cardsByDeckId[deckId]) cardsByDeckId[deckId] = [];
          cardsByDeckId[deckId].push({
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

        if (cardsByDeckId[deckId]?.length > 0) {
          useStore.getState().importApkgCards(deckId, cardsByDeckId[deckId] as any);
        }
        alert(`Imported ${importCount} cards successfully.`);
      } else if (ext === 'json') {
        const text = await file.text();
        // If it's a Deck Set exported by this app (has decks and cards):
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && !Array.isArray(data) && data.decks && data.cards) {
           importDeckSet(text, deckId);
           alert('Deck set imported successfully as subdecks!');
        } else {
           // Array of cards
           const arr = Array.isArray(data) ? data : (data.cards || []);
           const newCards = arr.map((c: any) => ({
             front: c.front || c.question || '',
             back: c.back || c.answer || ''
           })).filter((c: any) => c.front || c.back);
           if (newCards.length > 0) {
             importCardsCsv(deckId, newCards);
             alert(`Successfully imported ${newCards.length} cards!`);
           }
        }
      } else if (ext === 'csv') {
        Papa.parse(file, {
          complete: (results) => {
            const rows = results.data as string[][];
            const newCards: {front: string, back: string}[] = [];
            
            rows.forEach(row => {
              if (row.length >= 2 && row[0]?.trim() && row[1]?.trim()) {
                newCards.push({ front: row[0].trim(), back: row[1].trim() });
              }
            });
            
            if (newCards.length > 0) {
              importCardsCsv(deckId, newCards);
              alert(`Successfully imported ${newCards.length} cards!`);
            } else {
              alert('No valid cards found in the CSV. Make sure it has at least "Front,Back" columns without headers padding.');
            }
          },
          error: (error) => {
            alert("Error parsing CSV: " + error.message);
          }
        });
      }
    } catch (err: any) {
      alert(`Error importing: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="flex items-center gap-2 text-ui-muted hover:text-ui-text mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.study.backToDecks}</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-ui-text">{deck.name}</h2>
          <div className="flex flex-wrap items-center gap-3">
             <input 
               type="file" 
               accept=".csv,.json,.apkg" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleUnifiedImport} 
             />
             <button
               onClick={() => fileInputRef.current?.click()}
               className="bg-ui-surface-hover hover:bg-ui-surface-hover text-ui-text px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
               title="Import cards or decks"
             >
               <Upload className="w-4 h-4" />
               Import
             </button>

             <button
               onClick={handleExportDeck}
               className="bg-ui-surface-hover hover:bg-ui-surface-hover text-ui-text px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
               title="Export deck and all subdecks to a JSON file"
             >
               <Download className="w-4 h-4" />
               JSON
             </button>

               {/* APKG removed */}

             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showSettings ? 'bg-primary text-ui-text' : 'bg-ui-surface-hover text-ui-text'}`}
               title="Deck Settings"
             >
               <Settings className="w-4 h-4" />
               Settings
             </button>

            <div className="stat-pill border border-ui-border text-ui-text">
              {deckCards.length} {t.deck.totalCards}
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="glass-panel p-5 space-y-6 border-2 border-primary/20">
          <h3 className="text-lg font-medium text-ui-text border-b border-ui-border pb-2">Deck-Specific Settings</h3>
          <p className="text-sm text-ui-muted">These settings override the global app settings for this deck.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">{t.settings.cardOrder}</label>
              <select 
                value={deck?.settings?.cardOrder || globalSettings.cardOrder || 'newFirst'}
                onChange={(e) => handleUpdateDeckSettings('cardOrder', e.target.value)}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
              >
                <option value="newFirst">{t.settings.orderNewFirst}</option>
                <option value="reviewsFirst">{t.settings.orderReviewsFirst}</option>
                <option value="random">{t.settings.orderRandom}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Cards per Block</label>
              <input 
                type="number" min="1" max="100"
                value={deck?.settings?.cardsPerBlock || globalSettings.cardsPerBlock}
                onChange={(e) => handleUpdateDeckSettings('cardsPerBlock', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Again Interval (mins)</label>
              <input 
                type="number" step="1"
                value={deck?.settings?.againMinutes || globalSettings.againMinutes}
                onChange={(e) => handleUpdateDeckSettings('againMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Hard Min Interval (mins)</label>
              <input 
                type="number" step="1"
                value={deck?.settings?.hardMinMinutes || globalSettings.hardMinMinutes}
                onChange={(e) => handleUpdateDeckSettings('hardMinMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Hard Multiplier</label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.hardMultiplier || globalSettings.hardMultiplier}
                onChange={(e) => handleUpdateDeckSettings('hardMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Good Multiplier</label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.goodMultiplier || globalSettings.goodMultiplier}
                onChange={(e) => handleUpdateDeckSettings('goodMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">Easy Multiplier</label>
              <input 
                type="number" step="0.1"
                value={deck?.settings?.easyMultiplier || globalSettings.easyMultiplier}
                onChange={(e) => handleUpdateDeckSettings('easyMultiplier', Number(e.target.value))}
                className="w-full px-3 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
               onClick={() => {
                 // To reset deck settings, we unset them from the Deck object.
                 const newDecks = useStore.getState().decks.map(d => 
                   d.id === deck.id ? { ...d, settings: undefined } : d
                 );
                 useStore.setState({ decks: newDecks });
                 alert("Deck settings reset to global defaults.");
               }}
               className="text-sm text-ui-muted hover:text-red-400 transition-colors"
            >
              Reset to Global Defaults
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-ui-text">{t.deck.addCard}</h3>
          <button 
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface hover:bg-ui-surface-hover rounded-lg text-sm text-ui-muted transition-colors"
          >
            {showPreview ? <><EyeOff className="w-4 h-4" /> {t.common.edit}</> : <><Eye className="w-4 h-4" /> Preview</>}
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex justify-between items-center bg-ui-surface p-3 rounded-lg border border-ui-border mb-4">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <TagIcon className="w-4 h-4 text-ui-muted" />
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-xs">
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-ui-text transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().toLowerCase();
                      if (!tags.includes(newTag)) setTags([...tags, newTag]);
                      setTagInput('');
                    }
                  }}
                  placeholder="Add tag (Enter)..." 
                  className="bg-transparent border-none text-xs text-ui-text placeholder-white/30 focus:outline-none focus:ring-0 w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-ui-muted" />
                <div className="flex gap-2">
                  {[
                    { value: '', label: 'None', color: 'bg-ui-surface-hover' },
                    { value: 'red', label: 'Red', color: 'bg-red-500' },
                    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
                    { value: 'green', label: 'Green', color: 'bg-green-500' },
                    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
                    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
                  ].map(f => (
                    <button
                      key={f.value || 'none'}
                      type="button"
                      onClick={() => setFlag(f.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${f.color} ${(flag || '') === f.value ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      title={f.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-2">Front (Question)</label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-ui-surface border border-ui-border rounded-lg min-h-[100px] text-ui-text prose prose-invert"
                   dangerouslySetInnerHTML={{ __html: renderCardText(front) || '<span class="text-ui-muted">Empty</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={front} 
                  onChange={setFront} 
                  placeholder="Content for the front of the card..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-2">Back (Answer)</label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-ui-surface border border-ui-border rounded-lg min-h-[100px] text-ui-text prose prose-invert"
                   dangerouslySetInnerHTML={{ __html: renderCardText(back) || '<span class="text-ui-muted">Empty</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={back} 
                  onChange={setBack} 
                  placeholder="Content for the back of the card..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-2">Details (Optional)</label>
              {showPreview ? (
                 <div 
                   className="p-4 bg-ui-surface border border-ui-border rounded-lg min-h-[100px] text-ui-text prose prose-invert"
                   dangerouslySetInnerHTML={{ __html: renderCardText(details) || '<span class="text-ui-muted">Empty</span>' }}
                 />
              ) : (
                <RichEditor 
                  value={details} 
                  onChange={setDetails} 
                  placeholder="Additional context or details shown after answering..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (front.trim()) handleCreate(e as any); } }}
                />
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={!front.trim()}
              className="bg-primary text-ui-text px-5 py-2 rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Card</span>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-medium text-white/90">Existing Cards ({filteredDeckCards.length})</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search cards..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 w-full sm:w-64 px-4 py-2 bg-ui-surface border border-ui-border rounded-lg text-ui-text placeholder-white/30 focus:outline-none focus:border-primary text-sm"
            />
            <button 
              onClick={() => setExpandAll(!expandAll)}
              className="px-3 py-2 bg-ui-surface hover:bg-ui-surface-hover border border-ui-border rounded-lg text-ui-text text-sm whitespace-nowrap transition-colors"
            >
              {expandAll ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
        
        {deckCards.length === 0 ? (
          <div className="text-center py-10 glass-panel border-dashed">
            <p className="text-ui-muted">No cards in this deck yet.</p>
          </div>
        ) : filteredDeckCards.length === 0 ? (
          <div className="text-center py-10 glass-panel border-dashed">
            <p className="text-ui-muted">No cards match your search.</p>
          </div>
        ) : (
          <Virtuoso
            useWindowScroll
            data={filteredDeckCards}
            itemContent={(_, card) => (
              <div className="mb-3">
                <CardRow 
                  key={card.id} 
                  card={card} 
                  onUpdate={(id, f, b, d, t, flag) => updateCard(id, f, b, d, t, flag)}
                  onDelete={(id) => deleteCard(id)}
                  expandAll={expandAll}
                />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}

import { CardEditor } from '../components/CardEditor';

const CardRow: React.FC<{ 
  card: Flashcard, 
  onUpdate: (id: string, f: string, b: string, details?: string, tags?: string[], flag?: string) => void,
  onDelete: (id: string) => void,
  expandAll?: boolean
}> = ({ card, onUpdate, onDelete, expandAll = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isExpanded = expandAll || expanded;

  if (isEditing) {
    return (
      <div className="card-item !bg-primary/10 !border-primary/30 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-semibold text-primary">Editing Card</div>
        </div>
        <CardEditor 
          card={card} 
          onUpdate={(id, f, b, d, tags, flag) => {
            onUpdate(id, f, b, d, tags, flag);
          }} 
        />
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-ui-border">
          <button 
            onClick={() => setIsEditing(false)}
            className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-ui-text rounded-md transition-colors font-medium text-sm"
          >
            Done Editing
          </button>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const isDue = card.nextReviewDate <= now;

  const FLAG_COLORS: Record<string, string> = {
    'red': 'bg-red-500',
    'orange': 'bg-orange-500',
    'green': 'bg-green-500',
    'blue': 'bg-blue-500',
    'purple': 'bg-purple-500',
  };

  return (
    <div 
      className="card-item flex flex-col sm:flex-row gap-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex-1 p-2 relative">
        {card.flag && FLAG_COLORS[card.flag] && (
           <div className={`absolute top-2 right-2 w-3 h-3 rounded-full shadow-sm z-10 ${FLAG_COLORS[card.flag]}`} />
        )}
        <IsolatedHtml 
          className={`w-full max-w-none text-ui-text break-words ${!isExpanded ? 'line-clamp-2' : ''}`}
          layout="grid"
          frontHtml={sanitizeHtml(card.front)}
          showBack={true}
          backHtml={sanitizeHtml(card.back)}
          detailsHtml={isExpanded && card.details ? sanitizeHtml(card.details) : undefined}
        />
        {card.tags && card.tags.length > 0 && isExpanded && (
          <div className="flex flex-wrap gap-1 mt-4 ml-2">
            {card.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-start sm:items-center justify-between sm:flex-col gap-2 min-w-[80px]" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1">
           <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-ui-muted hover:text-primary hover:bg-indigo-400/10 rounded-md transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              if (confirm('Delete this card?')) onDelete(card.id);
            }}
            className="p-1.5 text-ui-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-right sm:text-center mt-auto">
          {isDue ? (
             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
               Due
             </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ui-surface-hover text-ui-muted border border-ui-border" title={new Date(card.nextReviewDate).toLocaleString()}>
               Later
             </span>
          )}
        </div>
      </div>
    </div>
  );
}
