import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Bot } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="p-2 bg-brand-600 rounded-lg text-white shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight flex items-center gap-2">
              CASEFLOW AI
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                The Escalation Referee
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automate the routine. Escalate the uncertain. Keep humans accountable.
            </p>
          </div>
        </Link>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-slate-400 hidden md:inline">
            Challenge A: The Escalation Referee | MLAI 2026
          </span>
          <Link
            to="/verify"
            className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-md transition shadow"
          >
            Verify Engine
          </Link>
        </div>
      </div>
    </header>
  );
};
