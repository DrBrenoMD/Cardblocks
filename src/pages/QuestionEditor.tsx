import React, { useState, useEffect } from 'react';
import { useStore, Question, QuestionAlternative } from '../store/useStore';
import { Page } from '../App';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import { RichEditor } from '../components/RichEditor';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const QuestionEditor: React.FC<{ questionId?: string, bankId?: string, onNavigate: (p: Page) => void }> = ({ questionId, bankId, onNavigate }) => {
  const { questions, createQuestion, updateQuestion } = useStore();
  
  const existingQuestion = questionId ? questions.find(q => q.id === questionId) : null;
  const targetBankId = existingQuestion?.bankId || bankId;

  if (!targetBankId) {
    onNavigate({ type: 'library' });
    return null;
  }

  const [subject, setSubject] = useState(existingQuestion?.subject || '');
  const [specialty, setSpecialty] = useState(existingQuestion?.specialty || '');
  const [area, setArea] = useState(existingQuestion?.area || '');
  const [subArea, setSubArea] = useState(existingQuestion?.subArea || '');
  const [topic, setTopic] = useState(existingQuestion?.topic || '');
  const [subTopic, setSubTopic] = useState(existingQuestion?.subTopic || '');
  const [tags, setTags] = useState<string[]>(existingQuestion?.tags || []);
  const [text, setText] = useState(existingQuestion?.text || '');
  const [explanation, setExplanation] = useState(existingQuestion?.explanation || '');
  const [alternatives, setAlternatives] = useState<QuestionAlternative[]>(existingQuestion?.alternatives || []);
  const [tagInput, setTagInput] = useState('');

  const handleAddAlternative = () => {
    const nextLetter = ALPHABET[alternatives.length] || `Opt${alternatives.length + 1}`;
    const newAlt: QuestionAlternative = {
      id: crypto.randomUUID(),
      letter: nextLetter,
      text: '',
      isCorrect: alternatives.length === 0, // First alternative is correct by default
    };
    setAlternatives([...alternatives, newAlt]);
  };

  const handleUpdateAlternative = (id: string, newText: string) => {
    setAlternatives(alts => alts.map(a => a.id === id ? { ...a, text: newText } : a));
  };

  const handleRemoveAlternative = (id: string) => {
    setAlternatives(alts => {
      const remaining = alts.filter(a => a.id !== id);
      // Re-assign letters
      return remaining.map((a, i) => ({ ...a, letter: ALPHABET[i] || `Opt${i + 1}` }));
    });
  };

  const handleSetCorrect = (id: string) => {
    setAlternatives(alts => alts.map(a => ({ ...a, isCorrect: a.id === id })));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = () => {
    const payload = {
      bankId: targetBankId,
      subject,
      specialty,
      area,
      topic,
      subTopic,
      subArea,
      tags,
      text,
      explanation,
      alternatives
    };

    if (existingQuestion) {
      updateQuestion(existingQuestion.id, payload);
      onNavigate({ type: 'bank', bankId: targetBankId });
    } else {
      createQuestion(payload);
      onNavigate({ type: 'bank', bankId: targetBankId });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 animate-fade-in">
      <div className="flex items-center justify-between gap-4 sticky top-0 bg-ui-background/80 backdrop-blur-md z-10 py-2 border-b border-ui-border">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate({ type: 'bank', bankId: targetBankId })}
            className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold tracking-tight text-ui-text">
            {existingQuestion ? 'Edit Question' : 'New Question'}
          </h2>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-ui-muted uppercase tracking-wider">Question Statement</label>
            <div className="border border-ui-border rounded-xl overflow-hidden min-h-[150px]">
              <RichEditor value={text} onChange={setText} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ui-muted uppercase tracking-wider">Options</label>
              <button 
                onClick={handleAddAlternative}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>
            
            <div className="space-y-3">
              {alternatives.map((alt) => (
                <div key={alt.id} className="flex items-start gap-2">
                  <button
                    onClick={() => handleSetCorrect(alt.id)}
                    className={cn(
                      "mt-2 p-1.5 rounded-full transition-colors",
                      alt.isCorrect ? "text-green-500 bg-green-500/10" : "text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover"
                    )}
                    title={alt.isCorrect ? "Correct Option" : "Mark as Correct"}
                  >
                    {alt.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-xs font-bold text-ui-text">{alt.letter})</span>
                    <div className="border border-ui-border rounded-lg overflow-hidden min-h-[40px]">
                      <RichEditor value={alt.text} onChange={(val) => handleUpdateAlternative(alt.id, val)} />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveAlternative(alt.id)}
                    className="mt-8 p-1.5 text-ui-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {alternatives.length === 0 && (
                <div className="p-4 bg-ui-surface border border-ui-border rounded-xl text-center text-sm text-ui-muted border-dashed">
                  No alternatives added yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ui-muted uppercase tracking-wider">Explanation (Optional)</label>
            </div>
            <div className="border border-ui-border rounded-xl overflow-hidden min-h-[100px]">
              <RichEditor value={explanation} onChange={setExplanation} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-ui-surface border border-ui-border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-ui-text flex items-center gap-2">
              Metadata
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Subject (Matéria)</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Constitutional Law"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Specialty (Especialidade)</label>
                <input 
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Area</label>
                <input 
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Fundamental Rights"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Sub-Area</label>
                <input 
                  type="text"
                  value={subArea}
                  onChange={(e) => setSubArea(e.target.value)}
                  placeholder="e.g. Right to Life"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Topic / Tema</label>
                <input 
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Fundamental Rights"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-ui-muted mb-1 block">Sub-Topic / Sub-tema</label>
                <input 
                  type="text"
                  value={subTopic}
                  onChange={(e) => setSubTopic(e.target.value)}
                  placeholder="e.g. Principle of Equality"
                  className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-ui-border">
              <label className="text-xs text-ui-muted mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-[10px] font-medium border border-primary/20">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-ui-text transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input 
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag and press Enter"
                className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
