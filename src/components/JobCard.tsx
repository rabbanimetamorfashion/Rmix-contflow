import React from 'react';
import { Job } from '../types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { Clock, User, Trash2, ArrowRight, CheckCircle2, RotateCcw, Link as LinkIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { AppUser, useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  users?: AppUser[];
  key?: React.Key;
}

export function JobCard({ job, onClick, users = [] }: JobCardProps) {
  const { user } = useAuth();
  const isMasterAdmin = user?.role === 'master_admin';
  const isAssignee = user?.uid && (job.assigneeId === user.uid || job.assigneeIds?.includes(user.uid));

  const getStatusColor = (status: Job['status']) => {
    switch(status) {
      case 'open': return 'bg-amber-50 text-amber-700';
      case 'assigned': return 'bg-indigo-50 text-indigo-700';
      case 'in_progress': return 'bg-indigo-50 text-indigo-700';
      case 'completed': return 'bg-emerald-50 text-emerald-700';
      case 'posted': return 'bg-violet-50 text-violet-700';
    }
  };

  const getBorderColor = (status: Job['status']) => {
    switch(status) {
      case 'open': return 'border-l-amber-400 border-t-slate-100 border-r-slate-100 border-b-slate-100 opacity-100';
      case 'assigned': return 'border-l-indigo-400 border-t-slate-100 border-r-slate-100 border-b-slate-100 opacity-100';
      case 'in_progress': return 'border-l-indigo-500 border-t-slate-100 border-r-slate-100 border-b-slate-100 opacity-100';
      case 'completed': return 'border-l-emerald-400 border-t-slate-100 border-r-slate-100 border-b-slate-100 opacity-75';
      case 'posted': return 'border-l-violet-400 border-t-slate-100 border-r-slate-100 border-b-slate-100 opacity-75';
    }
  };

  const getStatusLabel = (status: Job['status']) => {
    return status.replace('_', ' ');
  };

  // Warning if deadline is within 2 days or past
  const isDeadlineApproaching = job.deadline && job.status !== 'completed' && 
                                (job.deadline - Date.now()) < 172800000;

  // Resolve assignees
  let assignees: AppUser[] = [];
  if (job.assigneeIds && job.assigneeIds.length > 0) {
    assignees = users.filter(u => job.assigneeIds?.includes(u.uid));
  } else if (job.assigneeId) {
    const single = users.find(u => u.uid === job.assigneeId);
    if (single) assignees = [single];
  }

  const creator = users.find(u => u.uid === job.creatorId);

  const completedChecklists = job.checklists?.filter(c => c.isCompleted).length || 0;
  const totalChecklists = job.checklists?.length || 0;

  const [hasUnread, setHasUnread] = React.useState(false);
  React.useEffect(() => {
    if (!job.id) return;
    const lastViewed = localStorage.getItem(`job_viewed_${job.id}`);
    if (job.updatedAt && (!lastViewed || job.updatedAt > parseInt(lastViewed))) {
      setHasUnread(true);
    } else {
      setHasUnread(false);
    }
  }, [job.updatedAt, job.id]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the card open layout
    if (!job?.id || !isMasterAdmin || !window.confirm("Are you sure you want to delete this job order? This action is irreversible.")) return;
    try {
      await deleteDoc(doc(db, 'jobs', job.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete job order.');
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, newStatus: Job['status']) => {
    e.stopPropagation();
    if (!job?.id || !isAssignee) return;

    if (newStatus === 'completed' && !job.gdriveLink) {
      alert("Please attach a Google Drive Output link inside the card before finishing this job.");
      return;
    }
    
    // Optimistic UI could be added here, but Firestore onSnapshot handles it fast enough
    try {
      const updates: Partial<Job> = { status: newStatus };
      if (newStatus === 'in_progress' && job.status === 'assigned') {
        updates.startedAt = Date.now();
      } else if (newStatus === 'completed') {
        updates.finishedAt = Date.now();
      }
      await updateDoc(doc(db, 'jobs', job.id), updates);
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => onClick(job)}
      className={cn("bg-white p-4 rounded-xl border-l-4 border-t border-r border-b shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col h-full relative group/card", getBorderColor(job.status))}
    >
      {isMasterAdmin && (
        <button 
          onClick={handleDelete}
          className="absolute top-2 right-2 bg-red-50 text-red-600 p-1.5 rounded-full lg:opacity-0 lg:group-hover/card:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm z-10"
          title="Delete Job"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex justify-between items-start mb-2 pr-8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Order #{job.id ? job.id.slice(0, 6).toUpperCase() : 'NEW'}
        </span>
        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", getStatusColor(job.status))}>
          {getStatusLabel(job.status).toUpperCase()}
        </span>
      </div>
      
      <div className="flex items-start gap-1.5 mb-1 pr-2">
        <h3 className="font-bold text-slate-800 leading-snug">{job.title}</h3>
        {hasUnread && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5 shadow-sm" title="New updates" />}
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 mb-3 flex-1">{job.description}</p>
      
      {/* Meta Specs: Creator & Dates */}
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-4 space-y-1">
        {creator && (
          <div className="flex justify-between text-[9px] font-bold text-slate-500">
            <span className="uppercase tracking-wider">Ordered By:</span>
            <span className="text-slate-700">{creator.displayName}</span>
          </div>
        )}
        <div className="flex justify-between text-[9px]">
          <span className="font-bold uppercase tracking-wider text-slate-400">Ordered:</span>
          <span className="text-slate-600">{format(job.createdAt, 'MMM d, HH:mm')}</span>
        </div>
        {job.assignedAt && (
          <div className="flex justify-between text-[9px]">
            <span className="font-bold uppercase tracking-wider text-slate-400">Assigned:</span>
            <span className="text-indigo-600 font-medium">{format(job.assignedAt, 'MMM d, HH:mm')}</span>
          </div>
        )}
        {job.startedAt && (
          <div className="flex justify-between text-[9px]">
            <span className="font-bold uppercase tracking-wider text-slate-400">Started:</span>
            <span className="text-indigo-600 font-medium">{format(job.startedAt, 'MMM d, HH:mm')}</span>
          </div>
        )}
        {job.finishedAt && (
          <div className="flex justify-between text-[9px]">
            <span className="font-bold uppercase tracking-wider text-slate-400">Finished:</span>
            <span className="text-emerald-600 font-medium">{format(job.finishedAt, 'MMM d, HH:mm')}</span>
          </div>
        )}
      </div>

      {job.gdriveLink && (
        <div className="mb-3 border-b border-slate-100 pb-3">
          <a href={job.gdriveLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded border border-indigo-100 transition-colors w-full justify-center">
            <LinkIcon className="w-3 h-3 flex-shrink-0" />
            <span className="line-clamp-1 break-all">Open Drive Link</span>
          </a>
        </div>
      )}

      <div className="space-y-3 mt-auto">
        {/* Progress Bar */}
        {(job.status === 'in_progress' || job.status === 'completed' || totalChecklists > 0) && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <span>Progress</span>
              {totalChecklists > 0 ? (
                <span className="text-indigo-600">{completedChecklists}/{totalChecklists} Tasks</span>
              ) : (
                <span>{job.progress}% Complete</span>
              )}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
              <div 
                className={cn("h-1.5 rounded-full transition-all text-transparent", job.progress === 100 ? "bg-emerald-500" : "bg-indigo-500")} 
                style={{ width: `${job.progress}%` }} 
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-slate-50">
          <div className="flex items-center">
            {assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {assignees.slice(0, 3).map(a => (
                  <div key={a.uid} title={a.displayName} className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center border-2 border-white uppercase z-10 hover:z-20 shadow-sm">
                    {a.displayName?.[0] || 'U'}
                  </div>
                ))}
                {assignees.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center border-2 border-white z-0 shadow-sm">
                    +{assignees.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unassigned</span>
              </div>
            )}
          </div>

          <div className={cn("flex flex-col text-right", isDeadlineApproaching ? "text-amber-600 font-bold" : "text-slate-700")}>
            <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Deadline</span>
            <span className="text-xs font-bold line-clamp-1">
              {job.deadline ? format(job.deadline, 'MMM d, yyyy') : (job.requestedDeadline ? `Req: ${format(job.requestedDeadline, 'MMM d')}` : 'None')}
            </span>
          </div>
        </div>

        {/* Status Action Buttons for Assignees */}
        {isAssignee && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            {job.status === 'assigned' && (
              <button 
                onClick={(e) => handleStatusChange(e, 'in_progress')}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors shadow-sm"
              >
                Start Progress <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {job.status === 'in_progress' && (
              <button 
                onClick={(e) => handleStatusChange(e, 'completed')}
                className={cn("w-full flex items-center justify-center gap-1.5 py-1.5 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors shadow-sm", job.gdriveLink ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-400 opacity-80 cursor-not-allowed")}
                title={!job.gdriveLink ? "Drive link required to finish" : ""}
              >
                <CheckCircle2 className="w-3 h-3" /> Finish Job
              </button>
            )}
            {job.status === 'completed' && (
              <button 
                onClick={(e) => handleStatusChange(e, 'in_progress')}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded transition-colors"
                title="Move back to On Progress for revision"
              >
                <RotateCcw className="w-3 h-3" /> Needs Revision
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
