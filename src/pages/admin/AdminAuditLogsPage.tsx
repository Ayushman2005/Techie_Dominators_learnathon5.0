import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { AuditLog, AuditLogStats } from '../../types';
import { useToast } from '../../context/ToastContext';
import { CardSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Download,
  Terminal
} from 'lucide-react';

export function AdminAuditLogsPage() {
  const { error: toastError } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        api.getAuditLogs({ limit: 100 }),
        api.getAuditStats()
      ]);
      setLogs(lRes.logs || []);
      setStats(sRes);
    } catch (err: any) {
      if (!silent) toastError('Error', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Real-time polling every 4 seconds for live security activity stream
    const timer = setInterval(() => {
      loadData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const filtered = logs.filter(log => {
    const matchRole = roleFilter === 'all' || log.actorRole === roleFilter;
    const matchStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchSearch =
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.eventType.toLowerCase().includes(search.toLowerCase()) ||
      (log.actorName && log.actorName.toLowerCase().includes(search.toLowerCase())) ||
      (log.ipAddress && log.ipAddress.includes(search));
    return matchRole && matchStatus && matchSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> success
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" /> failure
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Info className="w-3 h-3" /> info
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" /> Tamper-Evident Security Log
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Audit & Activity Trail</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete cryptographic audit trail of user access, status mutations, and security events
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-3">
            <div className="glass-panel px-3.5 py-2 rounded-xl text-xs border border-white/10 text-right">
              <span className="text-slate-400 block text-[10px]">Total Security Events</span>
              <span className="font-extrabold text-white text-sm">{stats.totalEvents}</span>
            </div>
          </div>
        )}
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
              placeholder="Search by action, actor, event type, or IP address..."
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs text-slate-200 cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Roles</option>
              <option value="student" className="bg-slate-900 text-white">Student</option>
              <option value="warden" className="bg-slate-900 text-white">Warden</option>
              <option value="admin" className="bg-slate-900 text-white">Admin</option>
              <option value="system" className="bg-slate-900 text-white">System</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs text-slate-200 cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Outcomes</option>
              <option value="success" className="bg-slate-900 text-white">Success</option>
              <option value="failure" className="bg-slate-900 text-white">Failure</option>
              <option value="warning" className="bg-slate-900 text-white">Warning</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-6 space-y-4">
            <CardSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Audit Logs Found"
              description="No security events match the selected criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Action Summary</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(log => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}{' '}
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{log.actorName || 'System'}</div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">
                          {log.eventType}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-medium max-w-xs truncate">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && log.details && (
                        <tr>
                          <td colSpan={7} className="bg-slate-950/60 p-4 border-b border-white/10">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono mb-1.5">
                              <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Event Payload Metadata
                            </div>
                            <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
