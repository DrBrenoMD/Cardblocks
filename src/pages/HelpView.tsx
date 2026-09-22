import React from 'react';
import { Page } from '../App';
import { Info, HelpCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

export const HelpView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate({ type: 'home' })}
          className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <HelpCircle className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ui-text">Help & Documentation</h2>
        </div>
      </div>

      <div className="space-y-6">
        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Decks & Subdecks
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            You can organize your cards into Decks. To create a <strong>Subdeck</strong>, simply create a new deck with the name format <code>Parent Deck::Child Deck</code>. Cardblocks supports multi-level Deck hierarchies, similar to Anki.
            You can drag and drop decks to re-arrange or move them.
          </p>
        </section>

        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Importing from Anki
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            Cardblocks allows you to import Anki Collections (<code>.apkg</code>) natively in the browser. 
            On the home screen, click the "Import .apkg" button to select an Anki export file.
            Media (images & audios) inside the Anki package will be converted into base64 and imported automatically. Subdeck hierarchies are also preserved.
          </p>
        </section>

        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Card Creating & Cloze Deletions
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            A Card contains a "Front" and a "Back". It may also contain "Details" (extra info) and Tags.
            We provide a <strong>Rich Editor</strong> and an <strong>Image Occlusion Tool</strong> for creating cards.
          </p>
          <ul className="list-disc pl-5 text-ui-muted text-sm space-y-2">
            <li><strong>Cloze deletions:</strong> You can create fill-in-the-blank cards using cloze syntax: <code>{"{{c1::hidden text}}"}</code>. In the Rich Text Editor, simply select text and click the <code>[ ... ]</code> button to hide it.</li>
            <li><strong>Text-to-Speech (TTS):</strong> During review, there is a TTS button allowing you to hear the card's text spoken.</li>
            <li><strong>Image Occlusion:</strong> Inside the Deck View when adding a Card, you can switch to the "Image Occlusion" tab. Upload an image, draw rectangles over the parts you want to hide, and Cardblocks will generate a flashcard for each covered part (like Anki's Image Occlusion).</li>
          </ul>
        </section>

        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Studying & Keyboard Shortcuts
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            Our app uses a Spaced Repetition Algorithm (SuperMemo-2 based) to schedule your reviews. When answering a card, you can rate your memory: Again, Hard, Good, or Easy.
          </p>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            You can navigate quickly with your keyboard. By default:
          </p>
          <ul className="list-disc pl-5 text-ui-muted text-sm space-y-2">
            <li><strong>Space</strong>: Show Answer</li>
            <li><strong>1</strong>: Again</li>
            <li><strong>2</strong>: Hard</li>
            <li><strong>3</strong>: Good</li>
            <li><strong>4</strong>: Easy</li>
          </ul>
          <p className="text-ui-muted text-sm mt-4">
            <em>You can customize these shortcuts in the Settings page.</em>
          </p>
        </section>

        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Browse View
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed mb-4">
            The Browse View lets you search and manage all your cards. You can:
          </p>
          <ul className="list-disc pl-5 text-ui-muted text-sm space-y-2">
            <li>Toggle visibility of columns (Front, Back, Tags, Details, Next Review, etc.)</li>
            <li>Select multiple cards at once to bulk delete them.</li>
            <li>Edit a selected card using the editor panel on the right.</li>
            <li>Sort the table by any column.</li>
            <li>Filter by tags or specific text in the search bar.</li>
          </ul>
        </section>
        
        <section className="bg-ui-surface border border-ui-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-ui-text mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-ui-muted" /> Themes & Settings
          </h3>
          <p className="text-ui-muted text-sm leading-relaxed">
            By visiting the <strong>Settings</strong> page, you'll be able to quickly apply different colored themes to the application, adjust your auto-play TTS settings, edit keyboard bindings, toggle font choices, and import/export native JSON backups.
          </p>
        </section>
      </div>
    </div>
  );
};
