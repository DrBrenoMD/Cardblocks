import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { Layers, Plus, Search, Archive, MoreVertical, Trash2, Edit2, Play, Upload, Download } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { ImportBankModal } from '../components/ImportBankModal';

export const QuestionBanksView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questionBanks, questions, createQuestionBank, deleteQuestionBank, updateQuestionBank } = useStore();
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const filteredBanks = questionBanks.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const startCreate = () => {
    setNameInput('');
    setDescInput('');
    setIsCreating(true);
    setEditingId(null);
  };

  const startEdit = (b: { id: string, name: string, description?: string }) => {
    setNameInput(b.name);
    setDescInput(b.description || '');
    setIsCreating(false);
    setEditingId(b.id);
  };

  const handleSave = () => {
    if (!nameInput.trim()) return;
    
    if (isCreating) {
      createQuestionBank(nameInput.trim(), descInput.trim());
    } else if (editingId) {
      updateQuestionBank(editingId, nameInput.trim(), descInput.trim());
    }
    
    setIsCreating(false);
    setEditingId(null);
  };
  
  const cancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
            <Archive className="w-6 h-6 text-primary" />
            Question Banks
          </h2>
          <p className="text-sm text-ui-muted mt-1">Manage and organize your question repository</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-ui-surface border border-ui-border rounded-xl text-sm font-semibold hover:bg-ui-surface-hover transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button 
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Bank
          </button>
        </div>
      </div>

      {(isCreating || editingId) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-ui-surface p-4 rounded-xl border border-ui-border shadow-md space-y-4"
        >
          <h3 className="font-semibold text-ui-text">{isCreating ? 'Create Question Bank' : 'Edit Question Bank'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-ui-muted uppercase tracking-wider mb-1 block">Name</label>
              <input 
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. History Questions, Math 101..."
                className="w-full px-3 py-2 bg-ui-surface-hover border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ui-muted uppercase tracking-wider mb-1 block">Description (Optional)</label>
              <input 
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Brief description..."
                className="w-full px-3 py-2 bg-ui-surface-hover border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button 
              onClick={handleSave}
              disabled={!nameInput.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button 
              onClick={cancelEdit}
              className="px-4 py-2 hover:bg-ui-surface-hover text-ui-muted hover:text-ui-text font-medium rounded-lg transition-colors border border-transparent"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search question banks..."
          className="w-full pl-10 pr-4 py-3 bg-ui-surface border border-ui-border rounded-xl text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBanks.map(bank => {
          const count = questions.filter(q => q.bankId === bank.id).length;
          return (
            <motion.div 
              key={bank.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-ui-surface hover:bg-ui-surface-hover border border-ui-border p-5 rounded-xl cursor-pointer transition-all flex flex-col h-40 shadow-sm hover:shadow-md"
              onClick={() => onNavigate({ type: 'bank', bankId: bank.id })}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-ui-text truncate text-lg">{bank.name}</h3>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => startEdit(bank)}
                    className="p-1.5 text-ui-muted hover:text-ui-text hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${bank.name}"? This will delete all its questions!`)) {
                        deleteQuestionBank(bank.id);
                      }
                    }}
                    className="p-1.5 text-ui-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-ui-muted line-clamp-2 flex-1">
                {bank.description || "No description"}
              </p>
              
              <div className="mt-4 pt-4 border-t border-ui-border flex justify-between items-center text-sm">
                <span className="text-ui-muted font-medium">{count} questions</span>
                <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
                  Enter <Play className="w-3 h-3 ml-0.5 fill-current" />
                </span>
              </div>
            </motion.div>
          );
        })}
        {filteredBanks.length === 0 && (
          <div className="col-span-full py-12 text-center bg-ui-surface/50 border border-ui-border rounded-xl border-dashed">
            <Archive className="w-12 h-12 text-ui-muted mx-auto mb-3 opacity-50" />
            <p className="text-ui-text font-medium">No question banks found</p>
            <p className="text-ui-muted text-sm mt-1 mb-4">
              {searchQuery ? "Try a different search query" : "Create your first bank to start adding questions"}
            </p>
            {!searchQuery && (
              <button 
                onClick={startCreate}
                className="px-4 py-2 bg-ui-surface border border-ui-border hover:bg-ui-surface-hover text-ui-text font-medium rounded-lg transition-colors text-sm"
              >
                Create Question Bank
              </button>
            )}
          </div>
        )}
      </div>
      
      {showImportModal && (
        <ImportBankModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
};
