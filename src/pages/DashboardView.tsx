import React from 'react';
import { useStore } from '../store/useStore';
import { Page } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, PieChart as PieChartIcon } from 'lucide-react';

export const DashboardView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { questions } = useStore();
  
  const subjects = questions.reduce((acc, q) => {
    if (!q.subject) return acc;
    acc[q.subject] = (acc[q.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(subjects).map(([name, count]) => ({ name, count }));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate({ type: 'library' })}
          className="p-2 -ml-2 rounded-full hover:bg-ui-surface text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-ui-text flex items-center gap-2">
          <PieChartIcon className="w-6 h-6 text-primary" />
          Dashboard
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-ui-surface border border-ui-border p-6 rounded-xl shadow-sm text-center">
          <div className="text-sm font-semibold text-ui-muted uppercase tracking-wider mb-2">Total Questions</div>
          <div className="text-4xl font-bold text-ui-text">{questions.length}</div>
        </div>
        <div className="bg-ui-surface border border-ui-border p-6 rounded-xl shadow-sm text-center">
          <div className="text-sm font-semibold text-ui-muted uppercase tracking-wider mb-2">Subjects</div>
          <div className="text-4xl font-bold text-ui-text">{Object.keys(subjects).length}</div>
        </div>
      </div>

      <div className="bg-ui-surface border border-ui-border p-6 rounded-xl shadow-sm h-80">
        <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wider mb-6">Questions per Subject</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
            <Tooltip 
              cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
            />
            <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
