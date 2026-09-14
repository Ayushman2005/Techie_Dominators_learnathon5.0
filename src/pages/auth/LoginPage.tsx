import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Role } from '../../types';
import {
  Building2,
  Lock,
  Mail,
  User,
  Hash,
  Home,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Briefcase,
  GraduationCap,
  Shield,
  Zap
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { login, register } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Registration state
  const [regRole, setRegRole] = useState<Role>('student');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRollNo, setRegRollNo] = useState('');
  const [regRoom, setRegRoom] = useState('');
  const [regEmpId, setRegEmpId] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (res.ok) {
      success('Welcome back!');
      onLoginSuccess();
    } else {
      setFormError(res.error || 'Invalid credentials');
      toastError('Login Failed', res.error);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setFormError('Please fill out all required fields.');
      return;
    }

    if (regPassword.length < 12) {
      setFormError('Password must be at least 12 characters long.');
      return;
    }

    if (regRole === 'student' && (!regRollNo.trim() || !regRoom.trim())) {
      setFormError('Roll number and room number are required for student accounts.');
      return;
    }

    if (regRole === 'warden' && !regEmpId.trim()) {
      setFormError('Employee ID is required for warden accounts.');
      return;
    }

    setSubmitting(true);
    const res = await register({
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      role: regRole,
      rollNo: regRole === 'student' ? regRollNo.trim() : undefined,
      room: regRole === 'student' ? regRoom.trim() : undefined,
      empId: regRole !== 'student' ? regEmpId.trim() : undefined
    });
    setSubmitting(false);

    if (res.ok) {
      success('Account Created', `Welcome to HostelGrievance as a ${regRole.toUpperCase()}!`);
      onLoginSuccess();
    } else {
      setFormError(res.error || 'Failed to create account');
      toastError('Registration Failed', res.error);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Mesh Orbs */}
      <div className="mesh-glow">
        <div className="mesh-glow-circle-1" />
        <div className="mesh-glow-circle-2" />
        <div className="mesh-glow-circle-3" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Platform Overview & Security Highlights */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" /> Next-Generation Campus Grievance Platform
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Rapid, Transparent <br />
            <span className="gradient-text">Hostel Redressal.</span>
          </h1>

          <p className="text-slate-400 text-base leading-relaxed">
            Enterprise grievance management engineered for collegiate residences. Real-time SLA tracking, technician auditing, photo evidence validation, and direct warden communications.
          </p>

          {/* Value Props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl glass-panel border border-white/5 space-y-1">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div className="text-sm font-bold text-white">Live SLA Timers</div>
              <div className="text-xs text-slate-400">Strict resolution windows & escalation alerts</div>
            </div>
            <div className="p-3.5 rounded-2xl glass-panel border border-white/5 space-y-1">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <div className="text-sm font-bold text-white">Verified Redressal</div>
              <div className="text-xs text-slate-400">Student reviews & proof photos validation</div>
            </div>
            <div className="p-3.5 rounded-2xl glass-panel border border-white/5 space-y-1">
              <Building2 className="w-5 h-5 text-purple-400" />
              <div className="text-sm font-bold text-white">Multi-Hostel Hub</div>
              <div className="text-xs text-slate-400">Dedicated portals for students, wardens & admins</div>
            </div>
          </div>

          {/* Clean Info Box */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Independent Authentication & Access Control</span>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Create a personalized account below or sign in with your registered institutional credentials to access your live hostel dashboard.
            </p>
          </div>
        </div>

        {/* Right Column: Form Card */}
        <div className="lg:col-span-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
            {/* Top Navigation Tabs */}
            <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setFormError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <span>{formError}</span>
              </div>
            )}

            {mode === 'login' ? (
              /* Sign In Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. yourname@university.edu"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-glow py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 mt-2"
                >
                  {submitting ? 'Authenticating...' : 'Sign In to Portal'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* 1-Click Quick Demo Switcher */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                    Instant Demo Accounts (1-Click Fill)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('student@example.test');
                        setPassword('student123');
                        setFormError(null);
                      }}
                      className="p-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 text-indigo-400" />
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('warden@example.test');
                        setPassword('warden123');
                        setFormError(null);
                      }}
                      className="p-2 rounded-xl bg-cyan-600/15 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>Warden</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('admin@example.test');
                        setPassword('admin123');
                        setFormError(null);
                      }}
                      className="p-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex flex-col items-center gap-1 transition-colors"
                    >
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-xs text-slate-400">
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setFormError(null);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                    >
                      Create Account
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              /* Self-Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Role Picker Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole('student')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        regRole === 'student'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('warden')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        regRole === 'warden'
                          ? 'bg-cyan-600/30 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Warden</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('admin')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        regRole === 'admin'
                          ? 'bg-purple-600/30 border-purple-500 text-white shadow-md shadow-purple-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="e.g. john@university.edu"
                      className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                {/* Role-Specific Fields */}
                {regRole === 'student' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Roll Number
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={regRollNo}
                          onChange={e => setRegRollNo(e.target.value)}
                          placeholder="e.g. 24CS101"
                          className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Room Number
                      </label>
                      <div className="relative">
                        <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={regRoom}
                          onChange={e => setRegRoom(e.target.value)}
                          placeholder="e.g. B-204"
                          className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {regRole !== 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Staff Employee ID {regRole === 'admin' ? '(Optional)' : ''}
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required={regRole === 'warden'}
                        value={regEmpId}
                        onChange={e => setRegEmpId(e.target.value)}
                        placeholder={regRole === 'warden' ? 'e.g. WRD-401' : 'e.g. ADM-101'}
                        className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password (Min 12 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={12}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="At least 12 characters"
                      className="w-full pl-10 pr-10 py-2 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-2.5 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-glow py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 mt-2"
                >
                  {submitting ? 'Creating Account...' : `Create ${regRole.charAt(0).toUpperCase() + regRole.slice(1)} Account & Enter`}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-2 text-center">
                  <p className="text-xs text-slate-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setFormError(null);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
