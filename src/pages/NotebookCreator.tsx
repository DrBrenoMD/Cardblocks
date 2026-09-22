import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Save, Search, LayoutGrid, Timer, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

import { MultiSelectFilter } from '../components/MultiSelectFilter';

export const NotebookCreator: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questionBanks, questions, createNotebook } = useStore();
  
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'training' | 'exam'>('training');
  const [useTimeLimit, setUseTimeLimit] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60); // Default to 60s
  
  const [selectedBanks, setSelectedBanks] = useState<Record<string, boolean>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const handleToggleBank = (id: string) => {
    setSelectedBanks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedBankCount = Object.values(selectedBanks).filter(Boolean).length;
  
  let validQuestionIds = questions
    .filter(q => {
       if (selectedBankCount > 0 && !selectedBanks[q.bankId]) return false;
       if (selectedSubjects.length > 0 && !selectedSubjects.includes(q.subject)) return false;
       if (selectedSpecialties.length > 0 && (!q.specialty || !selectedSpecialties.includes(q.specialty))) return false;
       if (selectedAreas.length > 0 && !selectedAreas.includes(q.area)) return false;
       if (selectedTopics.length > 0 && (!q.topic || !selectedTopics.includes(q.topic))) return false;
       if (selectedSubTopics.length > 0 && (!q.subTopic || !selectedSubTopics.includes(q.subTopic))) return false;
       if (selectedTags.length > 0 && !selectedTags.some(t => q.tags.includes(t))) return false;
       return true;
    })
    .map(q => q.id);

  // Extract unique values for filters
  const availableSubjects = Array.from(new Set(questions.map(q => q.subject).filter(Boolean)));
  const availableSpecialties = Array.from(new Set(questions.filter(q => selectedSubjects.length === 0 || selectedSubjects.includes(q.subject)).map(q => q.specialty).filter(Boolean)));
  const availableAreas = Array.from(new Set(questions.filter(q => (selectedSubjects.length === 0 || selectedSubjects.includes(q.subject)) && (selectedSpecialties.length === 0 || selectedSpecialties.includes(q.specialty||''))).map(q => q.area).filter(Boolean)));
  const availableTopics = Array.from(new Set(questions.filter(q => selectedAreas.length === 0 || selectedAreas.includes(q.area)).map(q => q.topic).filter(Boolean)));
  const availableSubTopics = Array.from(new Set(questions.filter(q => selectedTopics.length === 0 || selectedTopics.includes(q.topic||'')).map(q => q.subTopic).filter(Boolean)));
  const availableTags = Array.from(new Set(questions.flatMap(q => q.tags).filter(Boolean)));

  const handleCreate = () => {
    if (!name.trim() || validQuestionIds.length === 0) return;
    
    // Shuffle questions optionally, or just leave as is. We'll leave as is.
    const notebookId = createNotebook({
      name: name.trim(),
      mode,
      questionIds: validQuestionIds,
      timeLimitPerQuestion: useTimeLimit ? timeLimit : undefined
    });
    
    onNavigate({ type: 'library' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate({ type: 'library' })}
          className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
          New Notebook
        </h2>
        <div className="flex-1" />
        <button 
          onClick={handleCreate}
          disabled={!name.trim() || validQuestionIds.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Create Notebook
        </button>
      </div>

      <div className="bg-ui-surface border border-ui-border rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <label className="text-sm font-semibold text-ui-muted uppercase tracking-wider mb-2 block">Notebook Name</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Constitutional Law Simulation 1"
            className="w-full px-4 py-3 bg-ui-surface-hover border border-ui-border rounded-xl text-ui-text focus:outline-none focus:border-primary transition-colors text-lg"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wider">Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('training')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  mode === 'training' ? "border-emerald-500 bg-emerald-500/10" : "border-ui-border hover:bg-ui-surface-hover"
                )}
              >
                <div className="font-semibold text-ui-text">Training</div>
                <div className="text-xs text-ui-muted mt-1">See answers and explanations immediately after each question.</div>
              </button>
              <button
                onClick={() => setMode('exam')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  mode === 'exam' ? "border-purple-500 bg-purple-500/10" : "border-ui-border hover:bg-ui-surface-hover"
                )}
              >
                <div className="font-semibold text-ui-text">Exam</div>
                <div className="text-xs text-ui-muted mt-1">Simulate an exam. View results and explanations only at the end.</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wider">Time Limit</h3>
            <div className="p-4 rounded-xl border border-ui-border bg-ui-surface-hover space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useTimeLimit}
                  onChange={(e) => setUseTimeLimit(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-ui-border bg-ui-surface focus:ring-primary focus:ring-offset-ui-surface"
                />
                <span className="text-sm font-medium text-ui-text">Enable Time Limit per Question</span>
              </label>

              {useTimeLimit && (
                <div className="pl-6 flex items-center gap-3">
                  <input 
                    type="number"
                    min="10"
                    max="600"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 bg-ui-surface border border-ui-border rounded-lg text-ui-text focus:outline-none focus:border-primary"
                  />
                  <span className="text-sm text-ui-muted">seconds per question</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-6 border-t border-ui-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wider">Source Question Banks</h3>
            <span className="text-sm text-ui-text font-medium bg-ui-surface-hover px-2 py-1 rounded-md">
              {validQuestionIds.length} total questions
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {questionBanks.map((bank) => {
              const count = questions.filter(q => q.bankId === bank.id).length;
              return (
                <button
                  key={bank.id}
                  onClick={() => handleToggleBank(bank.id)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all relative overflow-hidden",
                    selectedBanks[bank.id] ? "border-primary bg-primary/10" : "border-ui-border hover:bg-ui-surface-hover"
                  )}
                >
                  <div className="font-semibold text-ui-text truncate pr-6">{bank.name}</div>
                  <div className="text-xs text-ui-muted mt-1">{count} questions</div>
                  
                  {selectedBanks[bank.id] && (
                    <div className="absolute top-3 right-3 text-primary">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              );
            })}
            {questionBanks.length === 0 && (
              <div className="col-span-full p-4 text-center text-sm text-ui-muted bg-ui-surface-hover rounded-xl border border-dashed border-ui-border">
                You haven't created any question banks yet.
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-ui-border">
          <div className="col-span-full flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wider">Advanced Filters</h3>
          </div>

          <MultiSelectFilter label="Subject / Matéria" placeholder="Select Subject..." options={availableSubjects} selectedValues={selectedSubjects} onChange={setSelectedSubjects} />
          <MultiSelectFilter label="Specialty / Especialidade" placeholder="Select Specialty..." options={availableSpecialties as string[]} selectedValues={selectedSpecialties} onChange={setSelectedSpecialties} />
          <MultiSelectFilter label="Area" placeholder="Select Area..." options={availableAreas} selectedValues={selectedAreas} onChange={setSelectedAreas} />
          <MultiSelectFilter label="Topic / Tema" placeholder="Select Topic..." options={availableTopics as string[]} selectedValues={selectedTopics} onChange={setSelectedTopics} />
          <MultiSelectFilter label="Sub-topic / Sub-tema" placeholder="Select Sub-topic..." options={availableSubTopics as string[]} selectedValues={selectedSubTopics} onChange={setSelectedSubTopics} />
          <MultiSelectFilter label="Tags" placeholder="Select Tags..." options={availableTags} selectedValues={selectedTags} onChange={setSelectedTags} />
        </div>
      </div>
    </div>
  );
};
