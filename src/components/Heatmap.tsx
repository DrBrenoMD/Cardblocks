import { useMemo, useState, useEffect, useRef } from 'react';
import { useStore, Flashcard } from '../store/useStore';
import { cn } from '../lib/utils';
import { addDays, subDays, getDay, format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { sanitizeHtml } from '../lib/utils';
import { X, Calendar as CalendarIcon, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { CardEditor } from './CardEditor';
import { Page } from '../App';

export function Heatmap({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { reviewLog, reviewHistory, cards, decks, advanceCardsToNow, updateCard } = useStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [heatmapMonth, setHeatmapMonth] = useState(new Date());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDate(null);
        setEditingCardId(null);
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedDate(null);
        setEditingCardId(null);
      }
    };

    if (selectedDate) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedDate]);

  const { data, padStart } = useMemo(() => {
    const dates: { date: string; isFuture: boolean; dayOfWeek: number; count: number }[] = [];
    const now = new Date();
    
    // Future prediction map:
    const predictionMap: Record<string, number> = {};
    const nowLocal = new Date();
    const todayStrLocal = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;

    cards.forEach(c => {
       if (c.repetition === 0) return;
       let dateStr;
       if (c.nextReviewDate < Date.now()) {
         dateStr = todayStrLocal; // Count as due today
       } else {
         const d = new Date(c.nextReviewDate);
         dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       }
       predictionMap[dateStr] = (predictionMap[dateStr] || 0) + 1;
    });

    const start = startOfMonth(heatmapMonth);
    const end = endOfMonth(heatmapMonth);
    const daysInMonth = eachDayOfInterval({ start, end });

    daysInMonth.forEach(d => {
       const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       // Consider future if the date is after today
       const dTime = new Date(dateStr + 'T00:00:00').getTime();
       const todayTime = new Date(todayStrLocal + 'T00:00:00').getTime();
       const isFuture = dTime > todayTime;
       
       dates.push({
         date: dateStr,
         isFuture,
         dayOfWeek: getDay(d),
         count: isFuture ? (predictionMap[dateStr] || 0) : (reviewLog[dateStr] || 0)
       });
    });
    
    const padStart = start.getDay();

    return { data: dates, padStart };
  }, [reviewLog, cards, heatmapMonth]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getColorClass = (count: number, isFuture: boolean) => {
    if (count === 0) return 'bg-ui-surface border border-ui-border';
    
    const intensity = Math.ceil((count / maxCount) * 4); // 1 to 4
    
    if (isFuture) {
       // Orange/Yellow for future
       if (intensity === 1) return 'bg-orange-500/30 border border-orange-500/20 text-orange-200';
       if (intensity === 2) return 'bg-orange-500/50 border border-orange-500/40 text-orange-100';
       if (intensity === 3) return 'bg-orange-500/70 border border-orange-500/60 text-ui-text';
       return 'bg-orange-400 border border-orange-400/80 text-ui-text font-medium';
    } else {
       // Green for past done
       if (intensity === 1) return 'bg-green-500/30 border border-green-500/20 text-green-200';
       if (intensity === 2) return 'bg-green-500/50 border border-green-500/40 text-green-100';
       if (intensity === 3) return 'bg-green-500/70 border border-green-500/60 text-ui-text';
       return 'bg-green-400 border border-green-400/80 text-ui-text font-medium';
    }
  };

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Cards for selected date overlay
  const selectedCards = useMemo(() => {
    if (!selectedDate) return [];
    
    let result: { card: Flashcard, status: 'scheduled' | 'reviewed' | 'both' }[] = [];
    
    // Scheduled for this date
    const scheduled = cards.filter(card => {
      if (card.repetition === 0) return false;
      
      const d = new Date(card.nextReviewDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayStr}`;
      
      // If the card was due in the past, consider it scheduled for TODAY instead of its past date
      // unless we are specifically looking at a DATE in the future.
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (card.nextReviewDate < now.getTime()) {
        return todayStr === selectedDate;
      }
      
      return dateStr === selectedDate;
    });
    
    // Reviewed on this date
    const reviewedIds = (reviewHistory || {})[selectedDate] || [];
    const reviewedIdsSet = new Set(reviewedIds);
    
    scheduled.forEach(card => {
      const isReviewed = reviewedIdsSet.has(card.id);
      result.push({
        card,
        status: isReviewed ? 'both' : 'scheduled'
      });
    });

    if (reviewedIds.length > 0) {
      const reviewed = cards.filter(card => reviewedIdsSet.has(card.id));
      const scheduledIds = new Set(scheduled.map(c => c.id));
      const uniqueReviewed = reviewed.filter(c => !scheduledIds.has(c.id));
      uniqueReviewed.forEach(card => {
        result.push({
          card,
          status: 'reviewed'
        });
      });
    }
    
    return result;
  }, [selectedDate, cards, reviewHistory]);

  const selDayData = data.find(d => d.date === selectedDate);

  return (
    <div ref={containerRef} className="glass-panel p-5 mt-8 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
         <div className="flex items-center gap-4">
           <h3 className="text-lg font-medium text-ui-text">Activity Calendar</h3>
           <div className="flex items-center gap-2">
             <button
               onClick={() => setHeatmapMonth(prev => subMonths(prev, 1))}
               className="p-1 px-2 hover:bg-ui-surface-hover rounded-md text-ui-text transition-colors"
             >
               <ChevronLeft className="w-4 h-4" />
             </button>
             <span className="text-sm font-medium text-ui-text min-w-[120px] text-center capitalize">
               {format(heatmapMonth, 'MMMM yyyy')}
             </span>
             <button
               onClick={() => setHeatmapMonth(prev => addMonths(prev, 1))}
               className="p-1 px-2 hover:bg-ui-surface-hover rounded-md text-ui-text transition-colors"
             >
               <ChevronRight className="w-4 h-4" />
             </button>
           </div>
         </div>
         <div className="flex gap-4 text-[10px] text-ui-muted uppercase font-semibold">
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-green-500 border border-green-500 rounded-[2px]" /> Reviewed</div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-400 border border-orange-400 rounded-[2px]" /> Scheduled</div>
         </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2 sm:gap-3 relative">
        {dayNames.map(d => (
          <div key={d} className="text-center text-xs font-medium text-ui-muted pb-2">
            {d}
          </div>
        ))}
        
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square rounded-xl border border-dashed border-ui-border bg-transparent" />
        ))}
        
        {data.map((day, i) => {
          const dateObj = new Date(day.date + 'T00:00:00'); // Parse local
          const isToday = day.date === new Date().toISOString().split('T')[0];
          const isSelected = day.date === selectedDate;
          
          return (
            <div 
              key={i}
              onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
              title={`${day.date}: ${day.count} cards ${day.isFuture ? 'scheduled' : 'reviewed'}`}
              className={cn(
                "flex flex-col items-center justify-between p-1 sm:p-2 aspect-square rounded-lg transition-all hover:scale-105 group",
                getColorClass(day.count, day.isFuture),
                isToday ? "ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-[#0f172a]" : ""
              )}
            >
              <div className={cn("text-[10px] w-full text-right opacity-70", day.count === 0 && "text-ui-muted")}>
                {dateObj.getDate()}
              </div>
              <div className={cn("text-xs sm:text-sm mt-auto pb-1 mx-auto", day.count === 0 && "opacity-0")}>
                {day.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Overlay */}
      {selectedDate && selDayData && (
        <div className="absolute inset-0 bg-[#0A0D14]/95 backdrop-blur-md z-10 p-5 rounded-2xl flex flex-col pt-12">
           <button 
             onClick={() => setSelectedDate(null)}
             className="absolute top-4 right-4 p-2 bg-ui-surface hover:bg-ui-surface-hover rounded-full text-ui-muted hover:text-ui-text transition-colors"
           >
             <X className="w-5 h-5" />
           </button>
           
           <h4 className="text-lg font-medium text-ui-text mb-1">
             {format(new Date(selectedDate + 'T00:00:00'), 'PP')}
           </h4>
           <div className="flex flex-wrap gap-2 sm:gap-3 text-sm mb-4 items-center">
             {selectedCards.filter(c => c.status === 'reviewed' || c.status === 'both').length > 0 && (
               <span className="text-green-400">
                 {selectedCards.filter(c => c.status === 'reviewed' || c.status === 'both').length} reviewed
               </span>
             )}
             {selectedCards.filter(c => c.status === 'scheduled' || c.status === 'both').length > 0 && (
               <span className="text-orange-400">
                 {selectedCards.filter(c => c.status === 'scheduled' || c.status === 'both').length} scheduled
               </span>
             )}
             {selectedCards.length === 0 && (
               <span className="text-ui-muted">No activity</span>
             )}
             
             {/* Action Buttons */}
             {onNavigate && (
               <button
                 onClick={() => onNavigate({ type: 'browse', date: selectedDate })}
                 className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface hover:bg-ui-surface-hover text-ui-text rounded-lg transition-colors text-xs font-medium"
               >
                 <CalendarIcon className="w-3.5 h-3.5" /> Browse Date
               </button>
             )}
             {selDayData.isFuture && selectedCards.some(c => c.status === 'scheduled' || c.status === 'both') && (
               <button
                 onClick={() => {
                   if (confirm("Advance review for these cards to now?")) {
                     const scheduledIds = selectedCards.filter(c => c.status === 'scheduled' || c.status === 'both').map(c => c.card.id);
                     advanceCardsToNow(scheduledIds);
                     setSelectedDate(null); // Close overlay after modifying
                   }
                 }}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-indigo-500/30 text-primary rounded-md transition-colors text-xs font-medium"
               >
                 <FastForward className="w-3.5 h-3.5" /> Advance Cards
               </button>
             )}
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
             {editingCardId ? (
               <div className="h-full flex flex-col">
                 <button 
                   onClick={() => setEditingCardId(null)}
                   className="mb-3 flex items-center gap-1 text-ui-muted hover:text-ui-text transition-colors text-sm w-fit"
                 >
                   <ChevronLeft className="w-4 h-4" /> Back to list
                 </button>
                 <div className="flex-1 bg-[#0A0D14] rounded-xl overflow-hidden p-3 border border-ui-border overflow-y-auto custom-scrollbar">
                    {cards.find(c => c.id === editingCardId) && (
                      <CardEditor 
                        card={cards.find(c => c.id === editingCardId)!} 
                        onUpdate={(id, f, b, d) => updateCard(id, f, b, d)} 
                      />
                    )}
                 </div>
               </div>
             ) : selectedCards.length > 0 ? (
               <div className="space-y-3">
                 {selectedCards.map(({ card, status }) => {
                    const deck = decks.find(d => d.id === card.deckId);
                    const stripHtml = (html: string) => {
                      const tmp = document.createElement('div');
                      tmp.innerHTML = sanitizeHtml(html);
                      return tmp.textContent || tmp.innerText || '';
                    };
                    return (
                      <div 
                        key={card.id} 
                        onClick={() => setEditingCardId(card.id)}
                        className="bg-ui-surface border border-ui-border p-3 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-ui-surface-hover transition-colors"
                      >
                        <div className="flex-1 min-w-0 pointer-events-none">
                           <div className="flex items-center gap-2 mb-1">
                             <div className="text-[10px] text-primary font-semibold uppercase tracking-wider truncate">
                               {deck?.name || 'Unknown Deck'}
                             </div>
                             {status === 'scheduled' && (
                               <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-orange-500/20 text-orange-300 uppercase font-bold tracking-wider">Scheduled</span>
                             )}
                             {status === 'reviewed' && (
                               <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-green-500/20 text-green-300 uppercase font-bold tracking-wider">Reviewed</span>
                             )}
                             {status === 'both' && (
                               <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary uppercase font-bold tracking-wider">Reviewed & Scheduled</span>
                             )}
                           </div>
                           <div className="text-sm text-white/90 truncate">
                             {stripHtml(card.front) || '(Empty)'}
                           </div>
                        </div>
                      </div>
                    )
                 })}
               </div>
             ) : (
                <div className="flex h-full items-center justify-center text-ui-muted text-sm">
                 {selDayData.isFuture 
                   ? "Data not easily available for future projections for specific cards."
                   : "No historical card-level breakdown available for this date."}
               </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
}
