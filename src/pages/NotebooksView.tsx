import React, { useState } from 'react';
import { useStore, Notebook } from '../store/useStore';
import { Page } from '../App';
import { ScrollText, Plus, Search, Trash2, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { NotebookDashboard } from '../components/NotebookDashboard';

export const NotebooksView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { notebooks, deleteNotebook } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = notebooks.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-primary" />
            Notebooks
          </h2>
          <p className="text-sm text-ui-muted mt-1">Study questions in Training or Exam mode</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navigate to the creator */}
          <button 
            onClick={() => onNavigate({ type: 'notebookCreator' } as any)} 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Notebook
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notebooks..."
          className="w-full pl-10 pr-4 py-3 bg-ui-surface border border-ui-border rounded-xl text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(notebook => (
          <motion.div 
            key={notebook.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onNavigate({ type: 'notebook', notebookId: notebook.id })}
            className="group bg-ui-surface hover:bg-ui-surface-hover border border-ui-border p-5 rounded-xl cursor-pointer transition-all flex flex-col h-40 shadow-sm hover:shadow-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 flex gap-2" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => {
                  if (confirm("Delete this notebook?")) {
                    deleteNotebook(notebook.id);
                  }
                }}
                className="p-1.5 text-ui-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete Notebook"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="pr-10 mb-2">
              <h3 className="font-semibold text-ui-text truncate text-lg">{notebook.name}</h3>
              <span className={cn(
                "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mt-1",
                notebook.mode === 'exam' ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              )}>
                {notebook.mode} Mode
              </span>
            </div>
            
            <p className="text-sm text-ui-muted flex-1 mt-2">
              {notebook.questionIds.length} questions
            </p>
            
            <div className="mt-auto pt-4 border-t border-ui-border flex justify-between items-center text-sm">
              <span className="text-ui-muted font-medium">
                {notebook.timeLimitPerQuestion ? `${notebook.timeLimitPerQuestion}s per question` : 'Untimed'}
              </span>
              <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
                Start <Play className="w-3 h-3 ml-0.5 fill-current" />
              </span>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center bg-ui-surface/50 border border-ui-border rounded-xl border-dashed">
            <ScrollText className="w-12 h-12 text-ui-muted mx-auto mb-3 opacity-50" />
            <p className="text-ui-text font-medium">No notebooks found</p>
            <p className="text-ui-muted text-sm mt-1 mb-4">You can create notebooks from question banks or search results to practice specific topics.</p>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-ui-border">
        <NotebookDashboard onNavigate={onNavigate} />
      </div>
    </div>
  );
};
