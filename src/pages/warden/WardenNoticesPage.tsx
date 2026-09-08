import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/apiClient';
import type { Notice } from '../../types';
import { Megaphone, Plus, Trash2, Calendar, User, CheckCircle2 } from 'lucide-react';
import { CardSkeleton } from '../../components/common/Skeleton';

export function WardenNoticesPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishing, setPublishing] = useState(false);

  const loadNotices = async () => {
    try {
      const data = await api.getNotices();
      setNotices(data);
    } catch (err: any) {
      toastError('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setPublishing(true);
    const res = await api.createNotice({
      title,
      body,
      hostel_id: user?.hostelId || null
    });
    setPublishing(false);

    if (res.ok) {
      success('Notice Published', 'Students can now view this broadcast in their feed.');
      setTitle('');
      setBody('');
      loadNotices();
    } else {
      toastError('Failed to publish', res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    const res = await api.deleteNotice(id);
    if (res.ok) {
      success('Notice removed');
      loadNotices();
    } else {
      toastError('Failed to delete notice', res.error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
          <Megaphone className="w-3.5 h-3.5 text-cyan-400" /> Broadcast Studio
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Hostel Notice Publishing</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Draft emergency advisories, maintenance schedules, or curfew notifications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Composer Form */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Plus className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Publish New Announcement</h3>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Notice Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Water Tank Cleaning Schedule on Saturday"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Announcement Body</label>
              <textarea
                required
                rows={5}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Provide specific instructions, affected rooms/blocks, and timelines..."
                className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full btn-glow py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              {publishing ? 'Broadcasting...' : 'Broadcast to Hostel'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Existing Notices Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">Active Notices History</h3>
            <span className="text-xs text-slate-400">{notices.length} published</span>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : notices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 glass-panel rounded-2xl">
              No notices published yet. Use the composer on the left to broadcast your first announcement.
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div
                  key={n.id}
                  className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-sm text-white">{n.title}</h4>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{n.body}</p>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                    <span>By {n.author_name} ({n.author_role})</span>
                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
