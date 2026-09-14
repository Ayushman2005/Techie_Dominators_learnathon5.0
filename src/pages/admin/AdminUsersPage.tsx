import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { User, Role, Hostel } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { CardSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Users,
  Plus,
  Search,
  Filter,
  Trash2,
  Shield,
  GraduationCap,
  Briefcase,
  CheckCircle2
} from 'lucide-react';

export function AdminUsersPage() {
  const { success, error: toastError } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wardens, setWardens] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Add User Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [role, setRole] = useState<Role>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Welcome123456');
  const [room, setRoom] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [empId, setEmpId] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [wardenId, setWardenId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, h, w] = await Promise.all([
        api.getUsers(),
        api.getHostels(),
        api.getWardens()
      ]);
      setUsers(u);
      setHostels(h);
      setWardens(w);
      if (h.length > 0 && !hostelId) setHostelId(h[0].id);
      if (w.length > 0 && !wardenId) setWardenId(w[0].id);
    } catch (err: any) {
      toastError('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await api.createUser({
      name,
      email,
      password,
      role,
      room: role === 'student' ? room : undefined,
      rollNo: role === 'student' ? rollNo : undefined,
      empId: role !== 'student' ? empId : undefined,
      wardenId: role === 'student' && wardenId ? wardenId : undefined,
      hostelId: hostelId || undefined
    });
    setSubmitting(false);

    if (res.ok) {
      success('User Created', `${name} added as ${role}.`);
      setModalOpen(false);
      setName('');
      setEmail('');
      setRoom('');
      setRollNo('');
      setEmpId('');
      loadData();
    } else {
      toastError('Failed to create user', res.error);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate or remove user "${userName}"?`)) return;
    const res = await api.deleteUser(id);
    if (res.ok) {
      success('User Removed');
      loadData();
    } else {
      toastError('Failed to delete', res.error);
    }
  };

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.rollNo && u.rollNo.toLowerCase().includes(search.toLowerCase())) ||
      (u.empId && u.empId.toLowerCase().includes(search.toLowerCase()));
    return matchRole && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5 text-purple-400" /> Identity & Access Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">System Users</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Provision and configure permissions for students, hostel wardens, and administrators
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-glow inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, roll number, or employee ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'student', 'warden', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                  roleFilter === r
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {r === 'all' ? 'All Roles' : `${r}s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-6 space-y-4">
            <CardSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Users Found"
              description="No user records matched the selected filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Roll / Emp ID</th>
                  <th className="py-3.5 px-4">Room / Hostel</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{u.name}</div>
                      <div className="text-slate-400 text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold uppercase text-[10px] px-2 py-0.5 rounded-md ${
                          u.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : u.role === 'warden'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {u.role === 'admin' && <Shield className="w-3 h-3" />}
                        {u.role === 'warden' && <Briefcase className="w-3 h-3" />}
                        {u.role === 'student' && <GraduationCap className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 font-medium">
                      {u.rollNo || u.empId || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {u.room ? `Room ${u.room}` : 'Main Campus'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Provision New User"
        subtitle="Create an institutional account with designated permissions"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['student', 'warden', 'admin'] as const).map(r => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                    role === r
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rajiv Kumar"
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">University Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. rajiv@example.test"
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Password</label>
            <input
              type="text"
              required
              minLength={12}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          {role === 'student' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  placeholder="24BCE2001"
                  className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Room Number</label>
                <input
                  type="text"
                  required
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  placeholder="C-104"
                  className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Hostel Warden</label>
                <select
                  value={wardenId}
                  onChange={e => setWardenId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">None (Select Warden)</option>
                  {wardens.map(w => (
                    <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                      {w.name} ({w.empId || w.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Employee ID</label>
              <input
                type="text"
                required
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                placeholder="EMP-5001"
                className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
              />
            </div>
          )}

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
              disabled={submitting}
              className="btn-glow px-5 py-2 rounded-xl text-xs font-bold"
            >
              {submitting ? 'Creating...' : 'Provision User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
