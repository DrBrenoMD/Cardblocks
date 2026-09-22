import React, { useState, useMemo } from 'react';
import { useStore, Question } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Plus, Search, Edit2, Trash2, LayoutGrid, Filter, Zap, Upload, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import { sanitizeHtml } from '../lib/utils';
import { CardCreationModal } from '../components/CardCreationModal';
import { TableVirtuoso } from 'react-virtuoso';

const AVAILABLE_COLUMNS = [
  { id: 'text', label: 'Question' },
  { id: 'subject', label: 'Subject' },
  { id: 'area', label: 'Area' },
  { id: 'subArea', label: 'Sub-Area' },
  { id: 'topic', label: 'Topic' },
  { id: 'tags', label: 'Tags' },
  { id: 'difficulty', label: 'Difficulty' },
];

export const QuestionBankDetail: React.FC<{ bankId: string, onNavigate: (p: Page) => void }> = ({ bankId, onNavigate }) => {
  const { questionBanks, questions, deleteQuestion } = useStore();
  
  const bank = questionBanks.find(b => b.id === bankId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceQuestionForCard, setSourceQuestionForCard] = useState<Question | null>(null);

  // Table state
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    text: true,
    subject: true,
    area: true,
    subArea: false,
    topic: false,
    tags: true,
    difficulty: false
  });
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'text', direction: 'asc' });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  if (!bank) {
    onNavigate({ type: 'library' });
    return null;
  }

  const bankQuestions = questions.filter(q => q.bankId === bankId);

  const filteredQuestions = useMemo(() => {
    let result = bankQuestions;
    if (searchQuery.trim()) {
      const s = searchQuery.toLowerCase();
      const stripHtml = (html: string) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = sanitizeHtml(html);
        return tmp.textContent || tmp.innerText || '';
      };
      result = result.filter(q => 
        stripHtml(q.text).toLowerCase().includes(s) ||
        q.subject?.toLowerCase().includes(s) ||
        q.area?.toLowerCase().includes(s) ||
        q.subArea?.toLowerCase().includes(s) ||
        q.topic?.toLowerCase().includes(s) ||
        q.tags?.some(t => t.toLowerCase().includes(s))
      );
    }

    return result.sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof Question] || '';
      let valB: any = b[sortConfig.key as keyof Question] || '';
      
      if (sortConfig.key === 'text') {
         const stripHtml = (h: string) => { const t = document.createElement('div'); t.innerHTML=sanitizeHtml(h); return t.textContent||t.innerText; };
         valA = stripHtml(a.text).toLowerCase();
         valB = stripHtml(b.text).toLowerCase();
      } else if (sortConfig.key === 'tags') {
         valA = a.tags.join(', ');
         valB = b.tags.join(', ');
      } else if (typeof valA === 'string') {
         valA = valA.toLowerCase();
         valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [bankQuestions, searchQuery, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setCheckedIds(new Set(filteredQuestions.map(q => q.id)));
    else setCheckedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${checkedIds.size} questions?`)) {
      checkedIds.forEach(id => deleteQuestion(id));
      setCheckedIds(new Set());
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate({ type: 'library' })}
            className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
              {bank.name}
            </h2>
            <p className="text-sm text-ui-muted">{bankQuestions.length} Questions</p>
          </div>
        </div>
        <button 
          onClick={() => onNavigate({ type: 'question', bankId: bank.id })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Question</span>
        </button>
      </div>

      <div className="bg-ui-surface border border-ui-border rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
        <div className="p-3 border-b border-ui-border flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-[#0A0D14] border border-ui-border rounded-lg py-1.5 pl-9 pr-3 text-sm text-ui-text focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            {checkedIds.size > 0 && (
              <div className="flex items-center gap-2 mr-2 border-r border-ui-border pr-2 shrink-0">
                <span className="text-xs font-semibold text-primary px-2">{checkedIds.size} selected</span>
                <button 
                  onClick={handleBulkDelete}
                  className="px-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold rounded transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
            
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0D14] border border-ui-border rounded-lg text-sm text-ui-text hover:bg-ui-surface-hover shrink-0">
              <Filter className="w-4 h-4 text-ui-muted" /> Filter
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <TableVirtuoso 
            data={filteredQuestions}
            fixedHeaderContent={() => (
              <tr className="text-xs text-ui-muted uppercase bg-ui-surface/95 backdrop-blur-md sticky top-0 z-10 shadow-sm border-b border-ui-border">
                <th className="px-4 py-3 font-medium w-12 text-center">
                  <input 
                    type="checkbox"
                    checked={filteredQuestions.length > 0 && checkedIds.size === filteredQuestions.length}
                    onChange={handleSelectAll}
                    className="rounded bg-ui-background border-ui-border text-primary focus:ring-primary"
                  />
                </th>
                {AVAILABLE_COLUMNS.filter(c => visibleColumns[c.id]).map(col => {
                  const isSorted = sortConfig.key === col.id;
                  return (
                    <th key={col.id} className="px-4 py-3 font-medium text-left select-none cursor-pointer hover:bg-ui-surface-hover transition-colors" onClick={() => handleSort(col.id)}>
                      <div className="flex items-center gap-1">
                        {col.label}
                        {isSorted && (
                          <span className="text-[10px] text-primary">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 font-medium w-32 text-right relative">
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
                         <label key={col.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-ui-surface-hover px-2 py-1 rounded">
                           <input 
                             type="checkbox"
                             checked={!!visibleColumns[col.id]}
                             onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.id]: e.target.checked }))}
                             className="rounded bg-ui-background border-ui-border text-primary focus:ring-primary"
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
               const stripHtml = (h: string) => { const t = document.createElement('div'); t.innerHTML=sanitizeHtml(h); return t.textContent||t.innerText; };
               const textPreview = stripHtml(q.text);
               const isChecked = checkedIds.has(q.id);
               
               return (
                 <tr className={cn("group border-b border-ui-border/50 transition-colors", isChecked ? "bg-primary/5" : "hover:bg-ui-surface-hover")}>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(checkedIds);
                          if (e.target.checked) next.add(q.id); else next.delete(q.id);
                          setCheckedIds(next);
                        }}
                        className="rounded bg-ui-background border-ui-border text-primary focus:ring-primary"
                      />
                    </td>
                    {visibleColumns.text && (
                      <td className="px-4 py-3" onClick={() => onNavigate({ type: 'question', questionId: q.id, bankId: bank.id })}>
                        <div className="line-clamp-2 text-ui-text text-sm cursor-pointer hover:text-primary transition-colors">{textPreview}</div>
                      </td>
                    )}
                    {visibleColumns.subject && <td className="px-4 py-3 text-sm text-ui-muted truncate max-w-[120px]">{q.subject}</td>}
                    {visibleColumns.area && <td className="px-4 py-3 text-sm text-ui-muted truncate max-w-[120px]">{q.area}</td>}
                    {visibleColumns.subArea && <td className="px-4 py-3 text-sm text-ui-muted truncate max-w-[120px]">{q.subArea}</td>}
                    {visibleColumns.topic && <td className="px-4 py-3 text-sm text-ui-muted truncate max-w-[120px]">{q.topic}</td>}
                    {visibleColumns.tags && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {q.tags.slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 bg-ui-background border border-ui-border rounded text-[10px] text-ui-muted truncate max-w-[80px]">{t}</span>)}
                          {q.tags.length > 2 && <span className="text-[10px] text-ui-muted">+{q.tags.length - 2}</span>}
                        </div>
                      </td>
                    )}
                    {visibleColumns.difficulty && <td className="px-4 py-3 text-sm text-ui-muted">{q.difficulty}</td>}
                    <td className="px-4 py-3 text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => setSourceQuestionForCard(q)}
                           className="p-1.5 text-ui-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                           title="Generate Flashcard"
                         >
                           <Zap className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => { if (confirm("Delete?")) deleteQuestion(q.id); }}
                           className="p-1.5 text-ui-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                 </tr>
               );
            }}
          />
          {filteredQuestions.length === 0 && (
            <div className="py-20 text-center text-ui-muted border-dashed">
              <LayoutGrid className="w-12 h-12 text-ui-muted mx-auto mb-3 opacity-50" />
              <p className="text-ui-text font-medium">No questions found</p>
            </div>
          )}
        </div>
      </div>
      
      {sourceQuestionForCard && (
        <CardCreationModal 
          sourceQuestion={sourceQuestionForCard} 
          onClose={() => setSourceQuestionForCard(null)} 
        />
      )}
    </div>
  );
};
