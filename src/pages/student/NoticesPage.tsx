import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { Notice } from '../../types';
import { Bell, Search, Calendar, User, Shield, Megaphone } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';

export function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getNotices().then(data => {
      setNotices(data);
      setLoading(false);
    });
  }, []);

  const filtered = notices.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase()) ||
    n.author_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
            <Megaphone className="w-3.5 h-3.5 text-indigo-400" /> Campus Announcements & Bulletins
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Hostel Notices</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Official communications from wardens and administrative staff
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notices..."
            className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Notices Available"
          description="There are currently no announcements matching your search criteria."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(notice => (
            <div
              key={notice.id}
              className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3 hover:border-indigo-500/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Bell className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    {notice.author_role}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {new Date(notice.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>

              <h3 className="text-base font-bold text-white leading-snug">{notice.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{notice.body}</p>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-indigo-400" />
                  Posted by <span className="text-slate-200 font-semibold">{notice.author_name}</span>
                </span>
                <span className="text-indigo-400 font-medium">Official Dispatch</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
