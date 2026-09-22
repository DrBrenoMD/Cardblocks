import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import { get, set, del } from 'idb-keyval';
import { Rating } from '../lib/sm2';
import { generateId } from '../lib/utils';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};


export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  details?: string;
  tags?: string[];
  flag?: string; // 'red' | 'orange' | 'green' | 'blue' | 'purple'
  isSuspended?: boolean;
  isBuried?: boolean;
  repetition: number;
  interval: number; // in minutes
  easeFactor: number;
  nextReviewDate: number; // timestamp
  createdAt: number;
  sourceQuestionId?: string; // Referência à questão que gerou este card
}

export interface QuestionAlternative {
  id: string;
  letter: string;
  text: string; // HTML support
  isCorrect: boolean;
}

export interface Question {
  id: string;
  bankId: string;
  subject: string;
  specialty?: string;
  area: string;
  topic?: string;
  subTopic?: string;
  subArea: string;
  tags: string[];
  flag?: string;
  text: string; // HTML support
  alternatives: QuestionAlternative[];
  explanation: string; // HTML support
  createdAt: number;
  updatedAt: number;
  importedAt?: number;
  averageTimeSeconds?: number;
  lastExecutionDate?: number;
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  questionIds: string[];
  mode: 'training' | 'exam';
  timeLimitPerQuestion?: number; // em segundos
  createdAt: number;
}

export interface Note {
  id: string;
  targetType: 'question' | 'card' | 'standalone';
  targetId: string;
  bankId?: string; // Add bankId tracking
  content: string; // HTML
  createdAt: number;
  updatedAt: number;
}

export interface NotebookStats {
  id: string; // unique execution ID
  notebookId: string;
  completedAt: string; // ISO date string preferred, or timestamp
  score: number;
  correct: number;
  total: number;
  mode: 'training' | 'exam';
  results?: Record<string, boolean>; // Question ID -> correct (true/false)
  answers?: Record<string, string>; // Question ID -> selected alternative ID
  timeSpentSeconds?: Record<string, number>; // Question ID -> time spent in seconds
}

export interface DeckSettings {
  againMinutes?: number;
  hardMinMinutes?: number;
  hardMultiplier?: number;
  goodMultiplier?: number;
  easyMultiplier?: number;
  cardsPerBlock?: number;
  cardOrder?: 'newFirst' | 'reviewsFirst' | 'random';
}

export interface Deck {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: number;
  settings?: DeckSettings;
}

export interface ShortcutsConfig {
  showAnswer: string;
  again: string;
  hard: string;
  good: string;
  easy: string;
  playTTS: string;
  bury: string;
  suspend: string;
  undo: string;
  redo: string;
}

export interface AppSettings {
  againMinutes: number;
  hardMultiplier: number;
  hardMinMinutes: number;
  goodMultiplier: number;
  easyMultiplier: number;
  
  newAgainMinutes: number;
  newHardMinutes: number;
  newGoodMinutes: number;
  newEasyMinutes: number;

  cardsPerBlock: number;
  cardOrder: 'newFirst' | 'reviewsFirst' | 'random';
  theme?: 'dark' | 'light' | 'midnight' | 'forest' | 'dracula' | 'ocean' | 'sunset' | 'nord' | 'rose' | 'sepia' | 'paty';
  language?: 'en' | 'pt';
  shortcuts?: ShortcutsConfig;
  ttsVoiceURI?: string;
  ttsRate?: number;
  ttsPitch?: number;
}

const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  showAnswer: 'space|enter',
  again: '1',
  hard: '2',
  good: '3|enter',
  easy: '4',
  playTTS: 'p',
  bury: 'ctrl+k',
  suspend: 'ctrl+j',
  undo: 'ctrl+z',
  redo: 'ctrl+shift+z|ctrl+y'
};

export const DEFAULT_SETTINGS: AppSettings = {
  againMinutes: 1,
  hardMultiplier: 1.2,
  hardMinMinutes: 24 * 60, // 1 day
  goodMultiplier: 2.5,
  easyMultiplier: 3.5,
  
  newAgainMinutes: 15,
  newHardMinutes: 24 * 60,       // 1 day
  newGoodMinutes: 4 * 24 * 60,   // 4 days
  newEasyMinutes: 10 * 24 * 60,  // 10 days

  cardsPerBlock: 5,
  cardOrder: 'newFirst',
  shortcuts: DEFAULT_SHORTCUTS,
  ttsRate: 1,
  ttsPitch: 1,
  theme: 'ocean'
};

interface AppState {
  decks: Deck[];
  cards: Flashcard[];
  settings: AppSettings;
  
  // Phase 2: Questions and Banks
  questionBanks: QuestionBank[];
  questions: Question[];
  notebooks: Notebook[];
  notes: Note[];
  notebookHistory: NotebookStats[];
  
  createQuestionBank: (name: string, description?: string) => string;
  updateQuestionBank: (id: string, name: string, description?: string) => void;
  deleteQuestionBank: (id: string) => void;

  createQuestion: (question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateQuestion: (id: string, updates: Partial<Omit<Question, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteQuestion: (id: string) => void;

  createNotebook: (notebook: Omit<Notebook, 'id' | 'createdAt'>) => string;
  updateNotebook: (id: string, updates: Partial<Omit<Notebook, 'id' | 'createdAt'>>) => void;
  deleteNotebook: (id: string) => void;

  createNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  addNotebookHistory: (stats: Omit<NotebookStats, 'id'>) => void;

  createDeck: (name: string, parentId?: string | null) => string;
  deleteDeck: (id: string) => void;
  updateDeck: (id: string, name: string) => void;
  updateDeckSettings: (id: string, settings: DeckSettings) => void;
  moveDeck: (id: string, parentId: string | null) => void;
  
  createCard: (deckId: string, front: string, back: string, details?: string, tags?: string[], flag?: string, sourceQuestionId?: string) => void;
  updateCard: (id: string, front: string, back: string, details?: string, tags?: string[], flag?: string, sourceQuestionId?: string) => void;
  deleteCard: (id: string) => void;
  toggleSuspendCard: (id: string) => void;
  toggleBuryCard: (id: string) => void;
  bulkEditCards: (cardIds: string[], updates: Partial<Flashcard>) => void;
  advanceCardsToNow: (cardIds: string[]) => void;
  
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  
  importCardsCsv: (deckId: string, cardsGroup: {front: string, back: string}[]) => void;
  importApkgCards: (deckId: string, cardsGroup: Omit<Flashcard, 'id'|'deckId'>[]) => void;
  importProfile: (data: string) => boolean;
  exportDeckSet: (deckId: string) => string;
  importDeckSet: (data: string, targetParentId?: string | null) => void;
  resetSettings: () => void;
  resetAllData: () => void;

  reviewLog: Record<string, number>; // YYYY-MM-DD to count
  reviewHistory: Record<string, string[]>; // YYYY-MM-DD to [cardIds...]
  lastReviewSnapshot: {
    cards: Flashcard[];
    todayStr: string;
    logCountBefore: number;
    historyBefore: string[];
  } | null;
  undoLastReview: () => void;
  reviewCards: (cardIds: string[], rating: Rating) => void;
  reviewCardsCustom: (cardIds: string[], days: number) => void;
}

export const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
      decks: [],
      cards: [],
      settings: DEFAULT_SETTINGS,
      questionBanks: [],
      questions: [],
      notebooks: [],
      notes: [],
      notebookHistory: [],
      reviewLog: {},
      reviewHistory: {},
      lastReviewSnapshot: null,
      
      createQuestionBank: (name, description) => {
        const id = generateId();
        set(state => ({ questionBanks: [...state.questionBanks, { id, name, description, createdAt: Date.now() }] }));
        return id;
      },
      updateQuestionBank: (id, name, description) => set(state => ({
        questionBanks: state.questionBanks.map(qb => qb.id === id ? { ...qb, name, description } : qb)
      })),
      deleteQuestionBank: (id) => set(state => ({
        questionBanks: state.questionBanks.filter(qb => qb.id !== id),
        questions: state.questions.filter(q => q.bankId !== id) // Cascade
      })),

      createQuestion: (question) => {
        const id = generateId();
        const now = Date.now();
        set(state => ({ questions: [...state.questions, { ...question, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateQuestion: (id, updates) => set(state => ({
        questions: state.questions.map(q => q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q)
      })),
      deleteQuestion: (id) => set(state => ({
        questions: state.questions.filter(q => q.id !== id)
      })),

      createNotebook: (notebook) => {
        const id = generateId();
        set(state => ({ notebooks: [...state.notebooks, { ...notebook, id, createdAt: Date.now() }] }));
        return id;
      },
      updateNotebook: (id, updates) => set(state => ({
        notebooks: state.notebooks.map(n => n.id === id ? { ...n, ...updates } : n)
      })),
      deleteNotebook: (id) => set(state => ({
        notebooks: state.notebooks.filter(n => n.id !== id)
      })),

      createNote: (note) => {
        const id = generateId();
        const now = Date.now();
        set(state => ({ notes: [...state.notes, { ...note, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateNote: (id, content) => set(state => ({
        notes: state.notes.map(n => n.id === id ? { ...n, content, updatedAt: Date.now() } : n)
      })),
      deleteNote: (id) => set(state => ({
        notes: state.notes.filter(n => n.id !== id)
      })),

      addNotebookHistory: (stats) => set(state => ({
        notebookHistory: [
          ...state.notebookHistory,
          { ...stats, id: crypto.randomUUID() }
        ]
      })),

      undoLastReview: () => set((state) => {
        if (!state.lastReviewSnapshot) return state;
        const { cards: oldCards, todayStr, logCountBefore, historyBefore } = state.lastReviewSnapshot;
        
        const oldCardMap = new Map(oldCards.map(c => [c.id, c]));
        const nextCards = state.cards.map(c => oldCardMap.has(c.id) ? oldCardMap.get(c.id)! : c);
        
        return {
          cards: nextCards,
          reviewLog: {
            ...state.reviewLog,
            [todayStr]: logCountBefore
          },
          reviewHistory: {
            ...state.reviewHistory,
            [todayStr]: historyBefore
          },
          lastReviewSnapshot: null
        };
      }),
      
      createDeck: (name, parentId = null) => {
        const id = generateId();
        set((state) => ({
          decks: [...state.decks, { id, name, parentId, createdAt: Date.now() }]
        }));
        return id;
      },
      
      deleteDeck: (id) => set((state) => {
        // Find all subdecks recursively to delete them as well
        const getSubdecks = (parentId: string): string[] => {
          const children = state.decks.filter(d => d.parentId === parentId).map(d => d.id);
          let all = [...children];
          children.forEach(childId => {
            all = [...all, ...getSubdecks(childId)];
          });
          return all;
        };
        const idsToDelete = [id, ...getSubdecks(id)];
        
        return {
           decks: state.decks.filter(d => !idsToDelete.includes(d.id)),
           cards: state.cards.filter(c => !idsToDelete.includes(c.deckId))
        };
      }),
      
      updateDeck: (id, name) => set((state) => ({
        decks: state.decks.map(d => d.id === id ? { ...d, name } : d)
      })),

      updateDeckSettings: (id, settings) => set((state) => ({
        decks: state.decks.map(d => d.id === id ? { ...d, settings: { ...d.settings, ...settings } } : d)
      })),

      moveDeck: (id, parentId) => set((state) => {
        // Prevent cyclic parenting (can't make a deck a child of itself or its descendants)
        const getSubdecks = (parentId: string): string[] => {
          const children = state.decks.filter(d => d.parentId === parentId).map(d => d.id);
          let all = [...children];
          children.forEach(childId => {
            all = [...all, ...getSubdecks(childId)];
          });
          return all;
        };
        
        if (parentId && (parentId === id || getSubdecks(id).includes(parentId))) {
          return state; // Invalid move
        }

        return {
          decks: state.decks.map(d => d.id === id ? { ...d, parentId } : d)
        };
      }),
      
      createCard: (deckId, front, back, details = '', tags = [], flag, sourceQuestionId) => set((state) => ({
        cards: [...state.cards, {
          id: generateId(),
          deckId,
          front,
          back,
          details,
          tags,
          flag,
          sourceQuestionId,
          repetition: 0,
          interval: 0, // 0 indicates it's new
          easeFactor: 2.5,
          nextReviewDate: Date.now(), // available immediately
          createdAt: Date.now(),
        }]
      })),
      
      updateCard: (id, front, back, details, tags, flag, sourceQuestionId) => set((state) => ({
        cards: state.cards.map(c => c.id === id ? { 
          ...c, 
          front, 
          back, 
          details: details ?? c.details,
          tags: tags ?? c.tags,
          flag: flag !== undefined ? flag : c.flag,
          sourceQuestionId: sourceQuestionId ?? c.sourceQuestionId
        } : c)
      })),
      
      deleteCard: (id) => set((state) => ({
        cards: state.cards.filter(c => c.id !== id)
      })),

      toggleSuspendCard: (id) => set((state) => ({
        cards: state.cards.map(c => c.id === id ? { ...c, isSuspended: !c.isSuspended } : c)
      })),
      
      toggleBuryCard: (id) => set((state) => ({
        cards: state.cards.map(c => c.id === id ? { ...c, isBuried: !c.isBuried } : c)
      })),

      bulkEditCards: (cardIds, updates) => set((state) => ({
        cards: state.cards.map(c => cardIds.includes(c.id) ? { ...c, ...updates } : c)
      })),

      advanceCardsToNow: (cardIds) => set((state) => {
        const now = Date.now();
        return {
          cards: state.cards.map(c => 
            cardIds.includes(c.id) ? { ...c, nextReviewDate: now } : c
          )
        };
      }),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      importCardsCsv: (deckId, cardsGroup) => set((state) => {
        const now = Date.now();
        const newCards = cardsGroup.map(c => ({
          id: generateId(),
          deckId,
          front: c.front,
          back: c.back,
          tags: [],
          repetition: 0,
          interval: 0, 
          easeFactor: 2.5,
          nextReviewDate: now, 
          createdAt: now,
        }));
        return { cards: [...state.cards, ...newCards] };
      }),

      importApkgCards: (deckId, cardsGroup) => set((state) => {
        const newCards = cardsGroup.map(c => ({
          ...c,
          id: generateId(),
          deckId,
        }));
        return { cards: [...state.cards, ...newCards] };
      }),

      importProfile: (data) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.decks && parsed.cards) {
            set({
               decks: parsed.decks,
               cards: parsed.cards,
               settings: parsed.settings || DEFAULT_SETTINGS,
               reviewLog: parsed.reviewLog || {},
               reviewHistory: parsed.reviewHistory || {},
               lastReviewSnapshot: null,
               questionBanks: parsed.questionBanks || [],
               questions: parsed.questions || [],
               notebooks: parsed.notebooks || [],
               notes: parsed.notes || [],
               notebookHistory: parsed.notebookHistory || []
            });
            return true;
          }
        } catch (e) {
          console.error("Failed to parse profile", e);
        }
        return false;
      },
      
      exportDeckSet: (deckId) => {
        const state = get();
        const getSubdecks = (parentId: string): string[] => {
          const children = state.decks.filter(d => d.parentId === parentId).map(d => d.id);
          let all = [...children];
          children.forEach(childId => {
            all = [...all, ...getSubdecks(childId)];
          });
          return all;
        };
        const deckIds = [deckId, ...getSubdecks(deckId)];
        const exportedDecks = state.decks.filter(d => deckIds.includes(d.id));
        const exportedCards = state.cards.filter(c => deckIds.includes(c.deckId));
        return JSON.stringify({ decks: exportedDecks, cards: exportedCards }, null, 2);
      },

      importDeckSet: (data, targetParentId = null) => set((state) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.decks && parsed.cards) {
            const idMap = new Map<string, string>();
            const now = Date.now();
            
            // Generate new IDs for decks and fix parentIds
            const newDecks = parsed.decks.map((d: any) => {
              const newId = generateId();
              idMap.set(d.id, newId);
              return { ...d, id: newId, createdAt: now };
            });
            
            newDecks.forEach((d: any) => {
               if (d.parentId && idMap.has(d.parentId)) {
                 d.parentId = idMap.get(d.parentId);
               } else if (!d.parentId || !idMap.has(d.parentId)) { // root of the imported set
                 d.parentId = targetParentId;
               }
            });

            // Generate new IDs for cards
            const newCards = parsed.cards.map((c: any) => ({
               ...c,
               id: generateId(),
               deckId: idMap.get(c.deckId) || c.deckId, // fallback just in case
               createdAt: now,
               nextReviewDate: now, // reset study history
               repetition: 0,
               interval: 0,
               easeFactor: 2.5
            }));
            
            return {
              decks: [...state.decks, ...newDecks],
              cards: [...state.cards, ...newCards]
            };
          }
        } catch (e) {
          console.error("Failed to parse deck set", e);
        }
        return state;
      }),

      resetSettings: () => set(() => ({ settings: DEFAULT_SETTINGS })),

      resetAllData: () => set(() => ({
        decks: [],
        cards: [],
        questionBanks: [],
        questions: [],
        notebooks: [],
        notes: [],
        settings: DEFAULT_SETTINGS,
        reviewLog: {},
        reviewHistory: {},
        lastReviewSnapshot: null
      })),
      
      reviewCards: (cardIds, rating) => set((state) => {
        const nowObj = new Date();
        const now = nowObj.getTime();
        const todayStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
        const s = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };

        const updatedCards = state.cards.map(card => {
          if (cardIds.includes(card.id)) {
            const deck = state.decks.find(d => d.id === card.deckId);
            const deckSettings = deck?.settings || {};
            const cardSettings = { ...s, ...deckSettings };

            let nextInterval = card.interval;
            let repetition = card.repetition + 1;
            const isNew = card.repetition === 0;

            if (rating === 'again') {
              nextInterval = isNew ? cardSettings.newAgainMinutes : cardSettings.againMinutes;
              repetition = 0;
            } else if (rating === 'hard') {
              nextInterval = isNew ? cardSettings.newHardMinutes : Math.max(cardSettings.hardMinMinutes, card.interval * cardSettings.hardMultiplier);
            } else if (rating === 'good') {
              // Ensure good is always explicitly greater than hard
              const calculatedGood = card.interval * cardSettings.goodMultiplier;
              const hardBase = isNew ? cardSettings.newHardMinutes : Math.max(cardSettings.hardMinMinutes, card.interval * cardSettings.hardMultiplier);
              nextInterval = isNew ? cardSettings.newGoodMinutes : Math.max(hardBase * 1.2, calculatedGood, 1440);
            } else if (rating === 'easy') {
              // Ensure easy is always greater than good
              const calculatedEasy = card.interval * cardSettings.easyMultiplier;
              const goodBase = isNew ? cardSettings.newGoodMinutes : Math.max(1440, card.interval * cardSettings.goodMultiplier);
              nextInterval = isNew ? cardSettings.newEasyMinutes : Math.max(goodBase * 1.3, calculatedEasy, 4 * 1440);
            }

            return {
              ...card,
              repetition,
              interval: nextInterval,
              nextReviewDate: now + nextInterval * 60 * 1000,
            };
          }
          return card;
        });
        
        return { 
          cards: updatedCards,
          reviewLog: {
            ...state.reviewLog,
            [todayStr]: (state.reviewLog[todayStr] || 0) + cardIds.length
          },
          reviewHistory: {
            ...state.reviewHistory,
            [todayStr]: [...((state.reviewHistory || {})[todayStr] || []), ...cardIds]
          },
          lastReviewSnapshot: {
            cards: state.cards.filter(c => cardIds.includes(c.id)),
            todayStr,
            logCountBefore: state.reviewLog[todayStr] || 0,
            historyBefore: (state.reviewHistory || {})[todayStr] || []
          }
        };
      }),

      reviewCardsCustom: (cardIds, days) => set((state) => {
        const nowObj = new Date();
        const now = nowObj.getTime();
        const todayStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
        const nextInterval = days * 24 * 60; // in minutes
        
        const updatedCards = state.cards.map(card => {
          if (cardIds.includes(card.id)) {
            return {
              ...card,
              repetition: card.repetition + 1,
              interval: nextInterval,
              nextReviewDate: now + nextInterval * 60 * 1000,
            };
          }
          return card;
        });

        return { 
          cards: updatedCards,
          reviewLog: {
            ...state.reviewLog,
            [todayStr]: (state.reviewLog[todayStr] || 0) + cardIds.length
          },
          reviewHistory: {
            ...state.reviewHistory,
            [todayStr]: [...((state.reviewHistory || {})[todayStr] || []), ...cardIds]
          },
          lastReviewSnapshot: {
            cards: state.cards.filter(c => cardIds.includes(c.id)),
            todayStr,
            logCountBefore: state.reviewLog[todayStr] || 0,
            historyBefore: (state.reviewHistory || {})[todayStr] || []
          }
        };
      }),
    }),
    {
      name: 'anki-block-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  ), { partialize: (state) => ({ decks: state.decks, cards: state.cards }) }
  )
);
