import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { User } from '../../types';
import { Search, UserCheck, Mail, Hash, Home, Shield, Users } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';

export function WardenStudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getUsers({ role: 'student' }).then(users => {
      setStudents(users);
      setLoading(false);
    });
  }, []);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNo && s.rollNo.toLowerCase().includes(search.toLowerCase())) ||
    (s.room && s.room.toLowerCase().includes(search.toLowerCase())) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" /> Hostel Resident Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Hostel Students</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registered residents assigned to your supervision
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, roll no, or room..."
            className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="No student records match the search query."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(st => (
            <div
              key={st.id}
              className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                  {st.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white truncate">{st.name}</div>
                  <div className="text-xs text-slate-400 truncate">{st.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Roll No</span>
                  <div className="font-mono font-bold text-cyan-300">{st.rollNo || 'N/A'}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Room</span>
                  <div className="font-bold text-white">{st.room || 'N/A'}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Resident ID: {st.id}</span>
                <a
                  href={`mailto:${st.email}`}
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
