import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import type { GrievanceAnalytics, User } from '../../types';
import { CardSkeleton } from '../../components/common/Skeleton';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Building,
  Users,
  ShieldAlert,
  BarChart3,
  Award,
  Calendar,
  AlertCircle,
  Radio,
  RefreshCw
} from 'lucide-react';

export function AdminDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [analytics, setAnalytics] = useState<GrievanceAnalytics | null>(null);
  const [wardens, setWardens] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchRealtimeAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [aData, wData] = await Promise.all([
        api.getAnalytics(),
        api.getWardens()
      ]);
      setAnalytics(aData);
      setWardens(wData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch real-time analytics:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRealtimeAnalytics();
    // Real-time polling every 5 seconds for actual live metrics
    const interval = setInterval(() => {
      fetchRealtimeAnalytics();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // 100% Real-time actual metrics from database
  const total = analytics?.totalGrievances ?? 0;
  const resolved = analytics?.resolved ?? 0;
  const open = analytics?.open ?? 0;
  const inProgress = analytics?.inProgress ?? 0;
  const resolutionRate = analytics?.resolutionRatePct ?? 0;
  const avgHours = analytics?.avgResolutionHours !== null && analytics?.avgResolutionHours !== undefined
    ? `${analytics.avgResolutionHours} hrs`
    : 'N/A';
  const overdueCount = analytics?.overdueCount ?? 0;

  // Actual Real-time category data from database
  const categoryData = analytics?.byCategory || {};
  const categoryEntries = Object.entries(categoryData);
  const maxCategoryVal = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([_, c]) => c)) : 1;

  // Actual Real-time monthly inflow from database
  const monthlyData = analytics?.monthlyVolume || [];
  const maxMonthlyVal = monthlyData.length > 0 ? Math.max(...monthlyData.map(m => m.count)) : 1;

  // Actual Real-time warden performance from database
  const performanceMap = new Map((analytics?.wardenPerformance || []).map(p => [p.wardenId, p]));

  // Merge with all actual registered wardens from the database
  const actualWardenRows = wardens.map(w => {
    const perf = performanceMap.get(w.id);
    return {
      wardenId: w.id,
      wardenName: w.name,
      wardenEmpId: w.empId || 'N/A',
      totalGrievances: perf?.totalGrievances ?? 0,
      resolved: perf?.resolved ?? 0,
      open: perf?.open ?? 0,
      inProgress: perf?.inProgress ?? 0,
      resolutionRatePct: perf?.resolutionRatePct ?? 0,
      avgResolutionHours: perf?.avgResolutionHours ?? null
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Executive Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Real-Time Database Sync
            </div>
            <span className="text-[11px] text-slate-400">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Administrative Command Hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Global grievance intelligence, SLA compliance, and warden turnaround metrics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchRealtimeAnalytics(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl glass-panel hover:bg-white/10 text-slate-300 transition-colors"
            title="Force Live Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => onNavigate('admin-users')}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold glass-panel hover:bg-white/10 text-slate-200 border border-white/10"
          >
            Manage Users
          </button>
          <button
            onClick={() => onNavigate('admin-audit')}
            className="btn-glow px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/20"
          >
            Security Audit Trail
          </button>
        </div>
      </div>

      {/* KPI Cards (100% Real-Time Actual Counts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{resolutionRate}%</div>
          <div className="text-[11px] text-emerald-400/80">Actual database resolution rate</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Avg Turnaround Time</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400">{avgHours}</div>
          <div className="text-[11px] text-cyan-400/80">Calculated from closed tickets</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Total Campus Volume</span>
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{total}</div>
          <div className="text-[11px] text-slate-500">
            {resolved} resolved • {open} open • {inProgress} in progress
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>SLA At-Risk / Overdue</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400">{overdueCount}</div>
          <div className="text-[11px] text-rose-400/80">Action required immediately</div>
        </div>
      </div>

      {/* Dynamic Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Volume Trajectory (Pure SVG Chart with Actual Inflow Data) */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Monthly Grievance Inflow</h3>
              <p className="text-xs text-slate-400">Real-time trajectory from database records</p>
            </div>
            <span className="text-xs font-semibold text-indigo-400 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Live Inflow
            </span>
          </div>

          {/* SVG Area Chart with actual data */}
          <div className="pt-4">
            {monthlyData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                <Calendar className="w-8 h-8 text-slate-600 mb-2" />
                No monthly grievance volume records logged in the database yet.
                <span className="text-slate-500 mt-1">New submissions will appear here in real-time.</span>
              </div>
            ) : (
              <div className="h-56 w-full flex items-end gap-3 px-2">
                {monthlyData.map(d => {
                  const heightPct = Math.max(15, Math.round((d.count / maxMonthlyVal) * 100));
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="text-[11px] font-bold text-indigo-300">
                        {d.count}
                      </div>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full rounded-xl bg-gradient-to-t from-indigo-600/30 to-indigo-500 group-hover:to-cyan-400 transition-all duration-300 shadow-md group-hover:shadow-indigo-500/30"
                      />
                      <span className="text-xs font-medium text-slate-400">{d.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution Breakdown (Actual Database Data Only) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Issue Category Breakdown</h3>
              <p className="text-xs text-slate-400">Actual defects distribution across facilities</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {categoryEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No category data recorded in the system yet.
              </div>
            ) : (
              categoryEntries.map(([cat, count]) => {
                const pct = Math.round((count / maxCategoryVal) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">{cat}</span>
                      <span className="text-slate-400">{count} {count === 1 ? 'ticket' : 'tickets'}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Warden SLA Performance Leaderboard (Actual Database Data Only) */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Warden SLA Performance</h3>
          </div>
          <span className="text-xs text-slate-400">Real-time resolution metrics per warden</span>
        </div>

        {actualWardenRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No warden accounts registered in the database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Warden Name</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Total Handled</th>
                  <th className="py-3 px-4">Resolved</th>
                  <th className="py-3 px-4">In Progress</th>
                  <th className="py-3 px-4">Resolution Rate</th>
                  <th className="py-3 px-4">Avg SLA Turnaround</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {actualWardenRows.map(w => (
                  <tr key={w.wardenId} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{w.wardenName}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{w.wardenEmpId}</td>
                    <td className="py-3.5 px-4 text-slate-200">{w.totalGrievances}</td>
                    <td className="py-3.5 px-4 text-emerald-400 font-semibold">{w.resolved}</td>
                    <td className="py-3.5 px-4 text-cyan-400">{w.inProgress}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        {w.resolutionRatePct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {w.avgResolutionHours !== null ? `${w.avgResolutionHours} hrs` : 'N/A (No tickets closed)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
