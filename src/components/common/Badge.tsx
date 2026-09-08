import React from 'react';
import type { GrievanceStatus } from '../../types';
import { Clock, CheckCircle2, AlertOctagon, Flame, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatusBadgeProps {
  status: GrievanceStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const norm = status?.toLowerCase() || '';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5'
  }[size];

  if (norm === 'resolved') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        Resolved
      </span>
    );
  }

  if (norm === 'in progress' || norm === 'in_progress') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 ${sizeClasses}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
        In Progress
      </span>
    );
  }

  // Default: Open
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
      <Clock className="w-3.5 h-3.5 text-amber-400" />
      Open
    </span>
  );
}

interface PriorityBadgeProps {
  priority?: string;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority = 'medium', size = 'md' }: PriorityBadgeProps) {
  const p = priority.toLowerCase();
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (p) {
    case 'urgent':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse ${sizeClasses}`}>
          <Flame className="w-3 h-3 text-rose-400" />
          Urgent
        </span>
      );
    case 'high':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 ${sizeClasses}`}>
          <ArrowUp className="w-3 h-3 text-orange-400" />
          High
        </span>
      );
    case 'low':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
          <ArrowDown className="w-3 h-3 text-emerald-400" />
          Low
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-500/15 text-slate-300 border border-slate-500/30 ${sizeClasses}`}>
          <Minus className="w-3 h-3 text-slate-400" />
          Medium
        </span>
      );
  }
}
