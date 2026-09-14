import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import type { Hostel, User } from '../../types';
import {
  User as UserIcon,
  Building,
  Home,
  Hash,
  Mail,
  Shield,
  Phone,
  HeartPulse,
  Briefcase
} from 'lucide-react';
import { CardSkeleton } from '../../components/common/Skeleton';

export function StudentProfilePage() {
  const { user } = useAuth();
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [warden, setWarden] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfileMetadata() {
      if (user?.warden) {
        setWarden(user.warden);
      }
      try {
        const [hostels, wardens] = await Promise.all([
          api.getHostels().catch(() => []),
          api.getWardens().catch(() => [])
        ]);

        if (user?.hostelId) {
          const matchedHostel = hostels.find(h => h.id === user.hostelId);
          if (matchedHostel) setHostel(matchedHostel);
        } else if (hostels.length > 0) {
          setHostel(hostels[0]);
        }

        if (!user?.warden) {
          if (user?.wardenId) {
            const matchedWarden = wardens.find(w => w.id === user.wardenId);
            if (matchedWarden) setWarden(matchedWarden);
          } else if (wardens.length > 0) {
            setWarden(wardens[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load profile metadata:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfileMetadata();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Student & Hostel Profile</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Your registered institutional identity, room allocation, and emergency contacts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name || 'Registered Student'}</h2>
              <p className="text-xs text-slate-400">{user?.email || 'N/A'}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5" /> Verified Student ID: {user?.id}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-indigo-400" /> Roll Number
              </span>
              <span className="font-bold text-white text-sm block">
                {user?.rollNo || 'Not specified'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-indigo-400" /> Room Allotted
              </span>
              <span className="font-bold text-white text-sm block">
                {user?.room || 'Not assigned'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-indigo-400" /> Hostel Block
              </span>
              <span className="font-bold text-white text-sm block">
                {hostel ? hostel.name : (user?.hostelId || 'Campus Residence')}
              </span>
            </div>
          </div>

          {/* Assigned Warden Card */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Assigned Hostel Warden
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">● Active Duty</span>
            </div>
            {warden ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{warden.name}</div>
                  <div className="text-xs text-slate-400">
                    {warden.email} {warden.empId ? `• Emp ID: ${warden.empId}` : ''}
                  </div>
                </div>
                <a
                  href={`mailto:${warden.email}`}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold transition-colors"
                >
                  Send Email
                </a>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                No individual warden mapped yet. Contact chief hostel office for inquiries.
              </div>
            )}
          </div>
        </div>

        {/* Emergency Contacts Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <HeartPulse className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Emergency Helplines</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="text-slate-400 font-medium">Campus Medical Clinic</div>
              <div className="text-sm font-bold text-rose-300">+91 98765 11223</div>
              <div className="text-[10px] text-slate-500">24/7 Ambulance & First Aid</div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="text-slate-400 font-medium">Security Control Room</div>
              <div className="text-sm font-bold text-indigo-300">+91 98765 99887</div>
              <div className="text-[10px] text-slate-500">Main Gate & Campus Patrol</div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="text-slate-400 font-medium">Hostel Maintenance Duty</div>
              <div className="text-sm font-bold text-cyan-300">+91 98765 55443</div>
              <div className="text-[10px] text-slate-500">Electrician / Plumber Desk</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
