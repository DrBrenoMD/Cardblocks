import React, { useState } from 'react';
import { Page } from '../App';
import { Archive, ScrollText } from 'lucide-react';
import { QuestionBanksView } from './QuestionBanksView';
import { NotebooksView } from './NotebooksView';
import { cn } from '../lib/utils';

export const LibraryView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'notebooks' | 'banks'>('notebooks');

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-6 border-b border-ui-border pb-2">
        <button
          onClick={() => setActiveTab('notebooks')}
          className={cn(
            "pb-2 border-b-2 font-semibold text-lg flex items-center gap-2 transition-colors",
            activeTab === 'notebooks' ? "border-primary text-primary" : "border-transparent text-ui-muted hover:text-ui-text"
          )}
        >
          <ScrollText className="w-5 h-5" />
          Notebooks
        </button>
        <button
          onClick={() => setActiveTab('banks')}
          className={cn(
            "pb-2 border-b-2 font-semibold text-lg flex items-center gap-2 transition-colors",
            activeTab === 'banks' ? "border-primary text-primary" : "border-transparent text-ui-muted hover:text-ui-text"
          )}
        >
          <Archive className="w-5 h-5" />
          Manage Qbanks
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'notebooks' ? (
          <NotebooksView onNavigate={onNavigate} />
        ) : (
          <QuestionBanksView onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
};
