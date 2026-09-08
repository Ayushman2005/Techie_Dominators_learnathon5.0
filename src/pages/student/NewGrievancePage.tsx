import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/apiClient';
import { GRIEVANCE_CATEGORIES, GrievanceCategory } from '../../types';
import {
  Droplets,
  Zap,
  Wifi,
  Sparkles,
  Home,
  Shield,
  HelpCircle,
  Clock,
  Flame,
  ArrowLeft,
  UploadCloud,
  X,
  FileText,
  CheckCircle2,
  Wrench
} from 'lucide-react';

interface NewGrievancePageProps {
  onBack: () => void;
  onCreated: (id: string) => void;
}

export function NewGrievancePage({ onBack, onCreated }: NewGrievancePageProps) {
  const { success, error: toastError } = useToast();

  const [category, setCategory] = useState<GrievanceCategory>('Water');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableTime, setAvailableTime] = useState('Weekdays 4:00 PM - 7:00 PM');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Water':
        return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'Electricity':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Internet':
        return <Wifi className="w-5 h-5 text-indigo-400" />;
      case 'Cleanliness':
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
      case 'Room':
        return <Home className="w-5 h-5 text-purple-400" />;
      case 'Maintenance':
        return <Wrench className="w-5 h-5 text-orange-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const priorityOptions = [
    { id: 'low', label: 'Low', sla: '48h SLA', color: 'border-emerald-500/30 text-emerald-300' },
    { id: 'medium', label: 'Medium', sla: '24h SLA', color: 'border-amber-500/30 text-amber-300' },
    { id: 'high', label: 'High', sla: '12h SLA', color: 'border-orange-500/30 text-orange-300' },
    { id: 'urgent', label: 'Urgent', sla: '4h SLA Emergency', color: 'border-rose-500/30 text-rose-300' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 5 * 1024 * 1024) {
        toastError('File too large', 'Attachment must be under 5 MB');
        return;
      }
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (title.trim().length < 5) {
      setFormError('Title must be at least 5 characters long.');
      return;
    }
    if (description.trim().length < 20) {
      setFormError('Please provide a detailed description (at least 20 characters).');
      return;
    }

    setSubmitting(true);
    const res = await api.createGrievance({
      title,
      category,
      description,
      priority,
      availableTime,
      file: file || undefined
    });
    setSubmitting(false);

    if (res.ok && res.grievance) {
      // Trigger festive celebration confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      success('Grievance Logged', `Ticket ${res.grievance.id} is now queued for resolution.`);
      onCreated(res.grievance.id);
    } else {
      setFormError(res.error || 'Failed to submit grievance');
      toastError('Submission Failed', res.error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-white">File New Grievance</h2>
          <p className="text-xs text-slate-400">Submit an issue for swift inspection and technician dispatch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
            {formError}
          </div>
        )}

        {/* 1. Category Picker */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            1. Select Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {GRIEVANCE_CATEGORIES.map(cat => {
              const selected = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                    selected
                      ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-lg shadow-indigo-500/15 scale-[1.02]'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white/5">{getCategoryIcon(cat)}</div>
                  <span className="text-xs font-semibold">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Priority Urgency & SLA */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            2. Priority Level & Estimated SLA
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {priorityOptions.map(opt => {
              const selected = priority === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setPriority(opt.id as any)}
                  className={`p-3 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                    selected
                      ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold capitalize">{opt.label}</span>
                    {opt.id === 'urgent' && <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
                  </div>
                  <span className={`text-[10px] font-semibold ${opt.color}`}>{opt.sla}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Issue Details */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            3. Issue Details
          </label>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Title (Brief description)</label>
            <input
              type="text"
              required
              minLength={5}
              maxLength={200}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Geyser in 2nd floor bathroom not heating"
              className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Detailed Description (Min 20 characters)</label>
            <textarea
              required
              minLength={20}
              maxLength={5000}
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Specify the exact location, symptoms, when it started, and any steps already attempted..."
              className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
            />
            <div className="text-[11px] text-slate-400 text-right mt-1">
              {description.length} / 5000 characters
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Preferred Room Inspection Time
            </label>
            <input
              type="text"
              value={availableTime}
              onChange={e => setAvailableTime(e.target.value)}
              placeholder="e.g. Tomorrow 5 PM - 8 PM"
              className="w-full px-4 py-2 rounded-xl glass-input text-sm"
            />
          </div>
        </div>

        {/* 4. Attachment (Optional Proof) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            4. Photo or Document Evidence (Optional)
          </label>

          {!file ? (
            <label className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-white/5 cursor-pointer transition-all">
              <UploadCloud className="w-8 h-8 text-indigo-400 mb-2 animate-float" />
              <span className="text-sm font-semibold text-slate-200">Click to upload or drag & drop</span>
              <span className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP, or PDF (Max 5 MB)</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</div>
                  <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glow px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xl shadow-indigo-600/30"
          >
            {submitting ? 'Submitting Grievance...' : 'Submit Grievance'}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
