import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { Hostel } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { CardSkeleton } from '../../components/common/Skeleton';
import { Building2, Plus, Calendar, Shield, Users } from 'lucide-react';

export function AdminHostelsPage() {
  const { success, error: toastError } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [hostelName, setHostelName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadHostels = async () => {
    setLoading(true);
    try {
      const data = await api.getHostels();
      setHostels(data);
    } catch (err: any) {
      toastError('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHostels();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelName.trim()) return;

    setCreating(true);
    const res = await api.createHostel(hostelName);
    setCreating(false);

    if (res.ok) {
      success('Hostel Added', `${hostelName} has been registered.`);
      setModalOpen(false);
      setHostelName('');
      loadHostels();
    } else {
      toastError('Failed to add hostel', res.error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5 text-purple-400" /> Residential Infrastructure
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Campus Hostels</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registered dormitory blocks, facility wings, and warden assignments
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-glow inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Hostel Block
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hostels.map(h => (
            <div
              key={h.id}
              className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{h.name}</h3>
                  <span className="text-[11px] font-mono text-slate-400">ID: {h.id}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  ● Operational
                </span>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'Active'}
                </span>
                <span className="text-purple-400 font-medium">Block Active</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Hostel Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register Hostel Block"
        subtitle="Add a new residential building to the campus registry"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Hostel Block Name</label>
            <input
              type="text"
              required
              value={hostelName}
              onChange={e => setHostelName(e.target.value)}
              placeholder="e.g. Tagore International Hostel Wing C"
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn-glow px-5 py-2 rounded-xl text-xs font-bold"
            >
              {creating ? 'Adding...' : 'Register Hostel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
