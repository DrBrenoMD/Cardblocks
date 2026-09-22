import React, { useState, useMemo, useRef } from 'react';
import { useStore, Note } from '../store/useStore';
import { Page } from '../App';
import { Edit3, Clock, ArrowLeft, Trash2, Search, Archive, ChevronRight, Download, Plus, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { NotepadModal } from '../components/NotepadModal';
import { sanitizeHtml } from '../lib/utils';
import { cn } from '../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AutoHighlighter } from '../components/AutoHighlighter';

import { MultiSelectFilter } from '../components/MultiSelectFilter';

export const NotepadView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { notes, deleteNote, questions, cards, questionBanks } = useStore();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const notesContainerRef = useRef<HTMLDivElement>(null);

  const getBankId = (note: Note): string | null => {
    if (note.bankId) return note.bankId; // Use specific bankId if available (for standalone)
    if (note.targetType === 'question') {
      return questions.find(q => q.id === note.targetId)?.bankId || null;
    }
    if (note.targetType === 'card') {
       const qid = cards.find(c => c.id === note.targetId)?.sourceQuestionId;
       return questions.find(q => q.id === qid)?.bankId || null;
    }
    return null;
  };

  const getTargetTitle = (note: Note): string => {
    if (note.targetType === 'question') {
      const q = questions.find(q => q.id === note.targetId);
      return q ? q.text.replace(/<[^>]+>/g, '') : 'Deleted Question';
    } else if (note.targetType === 'card') {
      const c = cards.find(c => c.id === note.targetId);
      return c ? c.front.replace(/<[^>]+>/g, '') : 'Deleted Card';
    }
    return 'Standalone Note'; // standalone
  };

  const navigateToSource = (note: Note) => {
    if (note.targetType === 'question') {
      const q = questions.find(q => q.id === note.targetId);
      if (q) onNavigate({ type: 'question', questionId: q.id, bankId: q.bankId });
    }
  };

  const notesByBank = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const bank of questionBanks) {
      map.set(bank.id, []);
    }
    map.set('general', []); // unmatched

    for (const note of notes) {
      const bId = getBankId(note);
      if (bId && map.has(bId)) {
        map.get(bId)!.push(note);
      } else {
        map.get('general')!.push(note);
      }
    }
    return map;
  }, [notes, questionBanks, questions, cards]);

  const filteredNotes = useMemo(() => {
     if (!selectedBankId) return [];
     let bankNotes = notesByBank.get(selectedBankId) || [];
     
     // Note filters based on source questions
     bankNotes = bankNotes.filter(n => {
       if (n.targetType !== 'question' && n.targetType !== 'card') return true; // keep standalone
       
       let qid = n.targetId;
       if (n.targetType === 'card') {
          qid = cards.find(c => c.id === n.targetId)?.sourceQuestionId || '';
       }
       const q = questions.find(x => x.id === qid);
       if (!q) return true; // if question deleted keep note
       
       if (selectedSubjects.length > 0 && !selectedSubjects.includes(q.subject)) return false;
       if (selectedSpecialties.length > 0 && (!q.specialty || !selectedSpecialties.includes(q.specialty))) return false;
       if (selectedAreas.length > 0 && !selectedAreas.includes(q.area)) return false;
       if (selectedTopics.length > 0 && (!q.topic || !selectedTopics.includes(q.topic))) return false;
       if (selectedSubTopics.length > 0 && (!q.subTopic || !selectedSubTopics.includes(q.subTopic))) return false;
       if (selectedTags.length > 0 && !selectedTags.some(t => q.tags.includes(t))) return false;
       
       return true;
     });

     const query = searchQuery.toLowerCase();
     if (!query) return bankNotes.sort((a,b) => b.updatedAt - a.updatedAt);
     
     return bankNotes.filter(n => 
        n.content.toLowerCase().includes(query) || 
        getTargetTitle(n).toLowerCase().includes(query)
     ).sort((a,b) => b.updatedAt - a.updatedAt);
  }, [selectedBankId, notesByBank, searchQuery, selectedSubjects, selectedSpecialties, selectedAreas, selectedTopics, selectedSubTopics, selectedTags, questions, cards]);

  // Extract unique values for filters from notes in this bank
  const getNoteQuestion = (note: Note) => {
    let qid = note.targetId;
    if (note.targetType === 'card') {
      qid = cards.find(c => c.id === note.targetId)?.sourceQuestionId || '';
    }
    return questions.find(x => x.id === qid);
  };
  const bankQuestions = (notesByBank.get(selectedBankId || '') || []).map(getNoteQuestion).filter(Boolean);
  
  const availableSubjects = Array.from(new Set(bankQuestions.map(q => q!.subject).filter(Boolean)));
  const availableSpecialties = Array.from(new Set(bankQuestions.filter(q => selectedSubjects.length === 0 || selectedSubjects.includes(q!.subject)).map(q => q!.specialty).filter(Boolean)));
  const availableAreas = Array.from(new Set(bankQuestions.filter(q => (selectedSubjects.length === 0 || selectedSubjects.includes(q!.subject)) && (selectedSpecialties.length === 0 || selectedSpecialties.includes(q!.specialty||''))).map(q => q!.area).filter(Boolean)));
  const availableTopics = Array.from(new Set(bankQuestions.filter(q => selectedAreas.length === 0 || selectedAreas.includes(q!.area)).map(q => q!.topic).filter(Boolean)));
  const availableSubTopics = Array.from(new Set(bankQuestions.filter(q => selectedTopics.length === 0 || selectedTopics.includes(q!.topic||'')).map(q => q!.subTopic).filter(Boolean)));
  const availableTags = Array.from(new Set(bankQuestions.flatMap(q => q!.tags).filter(Boolean)));

  const handleExportPDF = async () => {
    if (!notesContainerRef.current) return;
    const element = notesContainerRef.current;
    
    // Temporarily apply white background and black text for pdf
    const originalBg = element.style.backgroundColor;
    const originalColor = element.style.color;
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#000000';
    element.classList.add('pdf-exporting'); // custom class to override dark mode styles if needed

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('notes_export.pdf');
    } finally {
      element.style.backgroundColor = originalBg;
      element.style.color = originalColor;
      element.classList.remove('pdf-exporting');
    }
  };

  if (selectedBankId) {
    const bankName = selectedBankId === 'general' ? 'General Notes' : questionBanks.find(b => b.id === selectedBankId)?.name;
    
    return (
      <AutoHighlighter className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedBankId(null); setSearchQuery(''); }}
              className="p-2 hover:bg-ui-surface rounded-full transition-colors text-ui-muted"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
              <Edit3 className="w-6 h-6 text-amber-500" />
              {bankName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
               onClick={handleExportPDF}
               className="flex items-center gap-2 px-3 py-2 bg-ui-surface border border-ui-border rounded-xl text-sm font-semibold hover:bg-ui-surface-hover transition-colors shadow-sm"
               title="Export as PDF"
            >
               <Download className="w-4 h-4" />
               <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button
               onClick={() => setIsCreatingNew(true)}
               className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
            >
               <Plus className="w-4 h-4" />
               New Note
            </button>
          </div>
        </div>

        <div className="bg-ui-surface p-2 rounded-xl flex items-center gap-2 border border-ui-border">
          <Search className="w-5 h-5 text-ui-muted ml-2 shrink-0" />
          <input 
            type="text"
            placeholder="Search notes in this bank..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-ui-text flex-1 text-sm py-1"
          />
        </div>

        {(availableSubjects.length > 0 || availableSpecialties.length > 0 || availableAreas.length > 0 || availableTopics.length > 0) && (
          <div className="bg-ui-surface p-4 rounded-xl border border-ui-border space-y-3 shadow-sm">
            <h3 className="text-xs font-semibold text-ui-muted uppercase tracking-wider">Note Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <MultiSelectFilter label="Subject" placeholder="Select Subject..." options={availableSubjects as string[]} selectedValues={selectedSubjects} onChange={setSelectedSubjects} />
               <MultiSelectFilter label="Specialty" placeholder="Select Specialty..." options={availableSpecialties as string[]} selectedValues={selectedSpecialties} onChange={setSelectedSpecialties} />
               <MultiSelectFilter label="Area" placeholder="Select Area..." options={availableAreas as string[]} selectedValues={selectedAreas} onChange={setSelectedAreas} />
               <MultiSelectFilter label="Topic" placeholder="Select Topic..." options={availableTopics as string[]} selectedValues={selectedTopics} onChange={setSelectedTopics} />
               <MultiSelectFilter label="Sub-Topic" placeholder="Select Sub-topic..." options={availableSubTopics as string[]} selectedValues={selectedSubTopics} onChange={setSelectedSubTopics} />
            </div>
          </div>
        )}

        <div className="space-y-4" ref={notesContainerRef}>
          {filteredNotes.length === 0 ? (
             <div className="text-ui-muted py-8 text-center text-sm">No notes found.</div>
          ) : (
            <div className="flex flex-col gap-6">
               {filteredNotes.map(note => (
                 <div key={note.id} className="bg-ui-surface border border-ui-border rounded-xl p-6 hover:border-ui-border-hover transition-colors flex flex-col group relative">
                   <div className="flex justify-between items-start mb-4 border-b border-ui-border pb-3">
                     <div className="flex-1">
                        <p className="text-xs font-semibold text-ui-muted mb-1 flex items-center gap-1.5">
                          {note.targetType === 'question' && <BookOpen className="w-3 h-3 text-primary" />}
                          Origin: 
                          {note.targetType === 'question' ? (
                            <button onClick={() => navigateToSource(note)} className="text-primary hover:underline line-clamp-1 text-left">
                               {getTargetTitle(note)}
                            </button>
                          ) : (
                            <span className="text-ui-text line-clamp-1">{getTargetTitle(note)}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-ui-muted">
                           <Clock className="w-3 h-3" /> {format(note.updatedAt, 'MMM d, yy HH:mm')}
                        </div>
                     </div>
                     <div className="flex gap-2 shrink-0 items-center">
                       <button
                         onClick={() => setSelectedNote(note)}
                         className="p-1.5 text-ui-muted hover:bg-primary/10 hover:text-primary rounded transition-colors opacity-0 group-hover:opacity-100"
                         title="Edit Note"
                       >
                         <Edit3 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (confirm("Delete this note?")) deleteNote(note.id);
                         }}
                         className="p-1.5 text-ui-muted hover:bg-red-500/10 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                   
                   <div 
                     className="prose prose-sm dark:prose-invert flex-1 text-ui-text text-base leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                   />
                 </div>
               ))}
            </div>
          )}
        </div>

        {selectedNote && (
          <NotepadModal
            targetId={selectedNote.targetId}
            targetType={selectedNote.targetType}
            onClose={() => setSelectedNote(null)}
          />
        )}
        
        {isCreatingNew && (
          <NotepadModal
            targetId={`standalone_${Date.now()}`}
            targetType="standalone"
            bankId={selectedBankId === 'general' ? undefined : selectedBankId}
            onClose={() => setIsCreatingNew(false)}
          />
        )}
      </AutoHighlighter>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
        <Edit3 className="w-6 h-6 text-amber-500" />
        Notepad Banks
      </h2>
      <p className="text-ui-muted">Select a question bank to view organized notes.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {questionBanks.map(bank => {
            const count = notesByBank.get(bank.id)?.length || 0;
            return (
              <button 
                key={bank.id}
                onClick={() => setSelectedBankId(bank.id)}
                className="bg-ui-surface border border-ui-border p-5 rounded-2xl flex items-center justify-between text-left hover:border-ui-border-hover hover:-translate-y-1 transition-all group"
              >
                <div>
                  <h3 className="font-bold text-ui-text text-lg flex items-center gap-2">
                    <Archive className="w-5 h-5 text-ui-muted" />
                    {bank.name}
                  </h3>
                  <p className="text-sm text-ui-muted mt-1">{count} Notes</p>
                </div>
                <ChevronRight className="w-5 h-5 text-ui-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            )
         })}
         
         {/* General / Unmatched Notes */}
         <button 
            onClick={() => setSelectedBankId('general')}
            className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex items-center justify-between text-left hover:bg-amber-500/20 hover:-translate-y-1 transition-all group"
          >
            <div>
              <h3 className="font-bold text-amber-500 text-lg flex items-center gap-2">
                 <Edit3 className="w-5 h-5" />
                 General Notes
              </h3>
              <p className="text-sm text-amber-500/70 mt-1">{notesByBank.get('general')?.length || 0} Notes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
      </div>
    </div>
  );
};
