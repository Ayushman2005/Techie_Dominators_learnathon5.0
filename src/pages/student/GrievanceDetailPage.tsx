import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/apiClient';
import type { Grievance, Comment } from '../../types';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CardSkeleton } from '../../components/common/Skeleton';
import {
  ArrowLeft,
  Clock,
  Send,
  Star,
  Download,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  User,
  Calendar,
  Layers
} from 'lucide-react';

interface GrievanceDetailPageProps {
  id: string;
  onBack: () => void;
}

export function GrievanceDetailPage({ id, onBack }: GrievanceDetailPageProps) {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [grievance, setGrievance] = useState<Grievance | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Review Modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Warden action state (if accessed by warden)
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'Open' | 'In Progress' | 'Resolved'>('In Progress');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchGrievance = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await api.getGrievance(id);
    if (res.ok && res.grievance) {
      setGrievance(res.grievance);
    } else if (!silent) {
      toastError('Error', res.error || 'Failed to load grievance details');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchGrievance();
    // Real-time polling every 4 seconds for live comments and status transitions
    const timer = setInterval(() => {
      fetchGrievance(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim().length < 3) return;

    setPostingComment(true);
    const res = await api.addComment(id, commentText);
    setPostingComment(false);

    if (res.ok) {
      setCommentText('');
      fetchGrievance();
      success('Comment added');
    } else {
      toastError('Failed to post remark', res.error);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toastError('Feedback required', 'Please share brief feedback on the resolution');
      return;
    }

    setSubmittingReview(true);
    const res = await api.submitReview(id, {
      rating,
      feedback,
      file: reviewFile || undefined
    });
    setSubmittingReview(false);

    if (res.ok) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      success('Review Submitted', 'Thank you for rating the service resolution!');
      setReviewOpen(false);
      fetchGrievance();
    } else {
      toastError('Review Failed', res.error);
    }
  };

  const handleWardenStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingStatus(true);
    const res = await api.updateStatus(id, newStatus, statusNote || undefined);
    setUpdatingStatus(false);
    if (res.ok) {
      success('Status Updated', `Grievance transitioned to ${newStatus}`);
      setStatusUpdateOpen(false);
      setStatusNote('');
      fetchGrievance();
    } else {
      toastError('Update Failed', res.error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <button onClick={onBack} className="p-2 rounded-xl glass-panel text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!grievance) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white">Grievance Not Found</h3>
        <p className="text-sm text-slate-400 mt-1 mb-6">This ticket may have been deleted or is not accessible.</p>
        <button onClick={onBack} className="btn-glow px-4 py-2 rounded-xl text-sm font-semibold">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isResolved = grievance.status.toLowerCase() === 'resolved';
  const isInProgress = grievance.status.toLowerCase().includes('progress');

  // 5-stage timeline calculation
  const timelineStages = [
    { label: 'Submitted', completed: true, active: false },
    { label: 'Under Review', completed: true, active: !isInProgress && !isResolved },
    { label: 'Work In Progress', completed: isInProgress || isResolved, active: isInProgress },
    { label: 'Resolved', completed: isResolved, active: isResolved && !grievance.review },
    { label: 'Feedback Verified', completed: !!grievance.review, active: false }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">{grievance.id}</span>
              <StatusBadge status={grievance.status} size="sm" />
              <PriorityBadge priority={grievance.priority} size="sm" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">{grievance.title}</h1>
          </div>
        </div>

        {/* Action button: student satisfaction review OR warden status update */}
        <div className="flex items-center gap-2">
          {user?.role === 'student' && isResolved && !grievance.review && (
            <button
              onClick={() => setReviewOpen(true)}
              className="btn-glow inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg"
            >
              <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
              Rate Resolution
            </button>
          )}

          {(user?.role === 'warden' || user?.role === 'admin') && (
            <button
              onClick={() => {
                setNewStatus(grievance.status);
                setStatusUpdateOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition-colors"
            >
              Update Ticket Status
            </button>
          )}
        </div>
      </div>

      {/* 5-Stage Visual Progress Stepper */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Redressal Lifecycle Tracker
        </div>
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-white/10 z-0" />
          {timelineStages.map((stage, idx) => {
            const isDone = stage.completed;
            const isCurrent = stage.active;

            return (
              <div key={stage.label} className="relative z-10 flex flex-col items-center group">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20'
                      : isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-white/10'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-2 font-medium text-center hidden sm:block ${
                    isDone ? 'text-emerald-400 font-semibold' : isCurrent ? 'text-indigo-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grievance Core Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Category</span>
            <span className="font-bold text-white">{grievance.category}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Reported By</span>
            <span className="font-bold text-white">
              {grievance.student?.name || 'Student'} ({grievance.student?.room || 'Room N/A'})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Inspection Window</span>
            <span className="font-bold text-white">{grievance.availableTime || 'Anytime'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Created Date</span>
            <span className="font-bold text-white">
              {new Date(grievance.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Issue Description</h4>
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-900/40 p-4 rounded-xl border border-white/5">
            {grievance.description}
          </div>
        </div>

        {/* Attachments Section */}
        {grievance.attachments && grievance.attachments.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Evidence Attachments</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {grievance.attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-xs font-semibold text-white truncate max-w-[200px]">{att.filename}</div>
                      <div className="text-[10px] text-slate-400">{(att.sizeBytes / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution Review Card (if already reviewed) */}
        {grievance.review && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">Verified Resolution Review</span>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= grievance.review!.rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-300 italic">"{grievance.review.feedback}"</p>
          </div>
        )}
      </div>

      {/* Discussion & Official Remarks Thread */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Live Discussion & Inspection Remarks</h4>
          </div>
          <span className="text-xs text-slate-400">{grievance.comments?.length || 0} remarks</span>
        </div>

        {/* Comments Feed */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {(!grievance.comments || grievance.comments.length === 0) ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No remarks logged yet. Post an inquiry or update below.
            </div>
          ) : (
            grievance.comments.map(c => {
              const isAuthorWarden = c.author?.role === 'warden' || c.author?.role === 'admin';
              const isCurrentUser = c.authorId === user?.id;

              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isAuthorWarden
                      ? 'bg-indigo-950/30 border-indigo-500/30 ml-4'
                      : isCurrentUser
                      ? 'bg-white/5 border-white/10 mr-4'
                      : 'bg-slate-900/40 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{c.author?.name || 'User'}</span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          isAuthorWarden
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {c.author?.role || 'student'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Post Comment Input */}
        <form onSubmit={handlePostComment} className="flex gap-2 pt-2">
          <input
            type="text"
            required
            minLength={3}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Type a remark, technician ETA inquiry, or update..."
            className="flex-1 px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={postingComment || commentText.trim().length < 3}
            className="btn-glow px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0"
          >
            {postingComment ? 'Posting...' : 'Send'}
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Satisfaction Review Modal */}
      <Modal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Student Satisfaction & Resolution Review"
        subtitle="Verify that the problem was resolved to your satisfaction"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Service Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-slate-500 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-amber-300 ml-2">
                {rating === 5 ? 'Excellent ⭐⭐⭐⭐⭐' : rating === 4 ? 'Good ⭐⭐⭐⭐' : rating === 3 ? 'Average ⭐⭐⭐' : 'Needs Improvement'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Feedback Remarks</label>
            <textarea
              required
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Technician arrived promptly, fixed the leak, and cleaned the area."
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Proof Photo of Fixed Work (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setReviewFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingReview}
              className="btn-glow px-5 py-2 rounded-xl text-xs font-bold shadow-lg"
            >
              {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Warden Status Update Modal */}
      <Modal
        isOpen={statusUpdateOpen}
        onClose={() => setStatusUpdateOpen(false)}
        title="Update Grievance Status"
        subtitle={`Action for ${grievance.id}`}
      >
        <form onSubmit={handleWardenStatusUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Transition Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Open', 'In Progress', 'Resolved'] as const).map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    newStatus === s
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Warden Inspection / Action Note (Optional)
            </label>
            <textarea
              rows={3}
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
              placeholder="e.g. Electrician assigned. Parts ordered. Work scheduled for tomorrow 10 AM."
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setStatusUpdateOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingStatus}
              className="btn-glow px-5 py-2 rounded-xl text-xs font-bold"
            >
              {updatingStatus ? 'Updating...' : 'Confirm Status Change'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
