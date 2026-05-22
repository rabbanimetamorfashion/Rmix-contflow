import React, { useState } from 'react';
import { Job, ChecklistItem } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Trash2, ArrowRight, CheckCircle2, RotateCcw, Link as LinkIcon, CheckSquare, ListTodo, ChevronDown, ChevronUp } from 'lucide-react';
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
  const isEditingAllowed = user?.role === 'admin' || user?.role === 'master_admin';
  const isAssignee = user?.uid && (job.assigneeId === user.uid || job.assigneeIds?.includes(user.uid));

  const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);

  // Warm tactile status color styles
  const getStatusColor = (status: Job['status']) => {
    switch(status) {
      case 'open': return 'bg-amber-100/70 text-amber-900 border border-amber-200/50';
      case 'assigned': return 'bg-orange-50 text-orange-900 border border-orange-200/50';
      case 'in_progress': return 'bg-amber-50 text-amber-900 border border-amber-200/60';
      case 'completed': return 'bg-emerald-50 text-emerald-900 border border-emerald-200/60';
      case 'posted': return 'bg-violet-50 text-violet-900 border border-violet-200/60';
    }
  };

  const getBorderColor = (status: Job['status']) => {
    switch(status) {
      case 'open': return 'border-l-amber-500 border-t-[#EBE6DE] border-r-[#EBE6DE] border-b-[#DCD5CB]';
      case 'assigned': return 'border-l-orange-500 border-t-[#EBE6DE] border-r-[#EBE6DE] border-b-[#DCD5CB]';
      case 'in_progress': return 'border-l-[#C2593E] border-t-[#EBE6DE] border-r-[#EBE6DE] border-b-[#DCD5CB]';
      case 'completed': return 'border-l-emerald-500 border-t-[#EBE6DE] border-r-[#EBE6DE] border-b-[#DCD5CB]';
      case 'posted': return 'border-l-violet-500 border-[#EBE6DE]';
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

  const [hasUnread, setHasUnread] = useState(false);
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
    if (!job?.id || (!isAssignee && !isEditingAllowed)) return;

    if (newStatus === 'completed' && !job.gdriveLink) {
      alert("Please attach a Google Drive Output link inside the card before finishing this job.");
      return;
    }
    
    try {
      const updates: Partial<Job> = { status: newStatus, updatedAt: Date.now() };
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

  // Direct Interactive Checklist toggle inside Kanban card! Extremely convenient!
  const handleChecklistToggle = async (e: React.MouseEvent, itemId: string, currentCompleted: boolean) => {
    e.stopPropagation();
    if (!job.id) return;
    
    const updatedChecklists = (job.checklists || []).map(item => {
      if (item.id === itemId) {
        return { ...item, isCompleted: !currentCompleted };
      }
      return item;
    });

    const completedCount = updatedChecklists.filter(c => c.isCompleted).length;
    const totalCount = updatedChecklists.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    try {
      await updateDoc(doc(db, 'jobs', job.id), {
        checklists: updatedChecklists,
        progress: progressPercent,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
    }
  };

  // Nice Job category categorization
  const getJobTypeColorAndBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('video') || t.includes('reels') || t.includes('shoot') || t.includes('bumper')) {
      return 'bg-amber-100 text-[#8C4A32]'; // warmth peach/copper
    }
    if (t.includes('poster') || t.includes('flyer') || t.includes('katalog') || t.includes('banner') || t.includes('display')) {
      return 'bg-emerald-100 text-emerald-950'; // natural print sage
    }
    return 'bg-orange-100 text-orange-950'; // warm digital amber
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={() => onClick(job)}
      className={cn(
        "bg-white p-4.5 rounded-2xl border-l-[5px] border-t border-r border-b cursor-pointer transition-all flex flex-col h-full relative group/card shadow-[0_2px_4px_rgba(34,27,24,0.02),0_6px_16px_rgba(34,27,24,0.03)] hover:shadow-[0_8px_24px_rgba(34,27,24,0.06)]", 
        getBorderColor(job.status)
      )}
    >
      {isMasterAdmin && (
        <button 
          onClick={handleDelete}
          className="absolute top-3.5 right-3.5 bg-red-50 text-red-600 p-2 rounded-xl lg:opacity-0 lg:group-hover/card:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm z-10"
          title="Delete Job"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Header Info */}
      <div className="flex justify-between items-center mb-2.5 pr-8">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Order #{job.id ? job.id.slice(0, 6).toUpperCase() : 'NEW'}
        </span>
        <span className={cn("px-2.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wide uppercase", getStatusColor(job.status))}>
          {getStatusLabel(job.status)}
        </span>
      </div>
      
      {/* Title & Unread indicator */}
      <div className="flex items-start gap-1.5 mb-2 pr-2">
        <h3 className="font-bold text-[#221B18] text-[14px] leading-snug tracking-tight hover:text-[#C2593E] transition-colors">{job.title}</h3>
        {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-[#C2593E] flex-shrink-0 mt-1 shadow-sm ring-2 ring-white animate-pulse" title="New updates" />}
      </div>
      
      {/* Category Badges */}
      {job.jobType && (
        <div className="flex flex-wrap gap-1 mb-3">
          <span className={cn("text-[8px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider", getJobTypeColorAndBadge(job.jobType))}>
            {job.jobType.replace(/_/g, ' ')}
          </span>
          <span className="text-[8px] bg-[#FAF6F0] text-[#8C6A5C] px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-[#EBE6DE]">
            {Array.isArray(job.brand) ? job.brand.join(', ') : job.brand}
          </span>
          {job.campaign && (
            <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider line-clamp-1 max-w-[120px]">
              {job.campaign}
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1 leading-relaxed">{job.description}</p>
      
      {/* Mini Meta-Specs Card (Physical ticket feel) */}
      <div className="bg-[#FAF7F3] p-2.5 rounded-xl border border-[#EBE6DE] mb-4 space-y-1.5 text-[9px]">
        {creator && (
          <div className="flex justify-between items-center font-bold text-slate-500">
            <span className="uppercase tracking-wider text-[8px] text-slate-400">Client:</span>
            <span className="text-slate-800">{creator.displayName}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-bold uppercase tracking-wider text-[8px] text-slate-400">Placed:</span>
          <span className="text-slate-600 font-medium">{format(job.createdAt, 'MMM d, H:mm')}</span>
        </div>
        {job.finishedAt && (
          <div className="flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider text-[8px] text-slate-400">Finished:</span>
            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded">{format(job.finishedAt, 'MMM d, H:mm')}</span>
          </div>
        )}
      </div>

      {/* Drive Deliverable Box */}
      {job.gdriveLink && (
        <div className="mb-4 bg-emerald-50/50 rounded-xl border border-emerald-100/70 p-2 hover:bg-emerald-50 transition-colors">
          <a 
            href={job.gdriveLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={e => e.stopPropagation()} 
            className="flex items-center justify-between gap-1 text-[10px] font-bold text-emerald-800"
          >
            <div className="flex items-center gap-1.5 truncate">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Download Output Files</span>
            </div>
            <span className="text-[8px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Deliverable</span>
          </a>
        </div>
      )}

      {/* INBOARD INTERACTIVE CHECKLISTS DRIVER - Real UX upgrade for production! */}
      {totalChecklists > 0 && (
        <div className="mb-4 border-t border-dashed border-[#EBE6DE] pt-3.5">
          <button
            onClick={(e) => { e.stopPropagation(); setIsChecklistExpanded(!isChecklistExpanded); }}
            className="flex items-center justify-between w-full text-slate-500 hover:text-slate-800 text-[10px] font-bold uppercase tracking-wider mb-2"
          >
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-[#C2593E]" />
              <span>Production Steps ({completedChecklists}/{totalChecklists})</span>
            </div>
            {isChecklistExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {isChecklistExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-1.5 max-h-48 overflow-y-auto pr-1"
            >
              {(job.checklists || []).map((item) => (
                <div 
                  key={item.id} 
                  onClick={(e) => handleChecklistToggle(e, item.id, item.isCompleted)}
                  className="flex items-center gap-2 group/chk py-1 px-1.5 rounded-lg hover:bg-[#FAF6F0] transition-colors cursor-pointer"
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all flex-shrink-0", 
                    item.isCompleted 
                      ? "bg-emerald-500 border-emerald-600 text-white shadow-sm" 
                      : "border-slate-300 bg-white group-hover/chk:border-[#C2593E]"
                  )}>
                    {item.isCompleted && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10.5px] font-medium leading-tight truncate select-none", 
                    item.isCompleted ? "line-through text-slate-400" : "text-slate-700 font-semibold"
                  )}>
                    {item.text}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Progress metrics and User info footer */}
      <div className="space-y-3.5 mt-auto">
        {(job.progress > 0 || totalChecklists > 0) && (
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-[#8C6A5C] font-extrabold uppercase tracking-wider">
              <span>Overall Stage</span>
              <span>{job.progress}% Complete</span>
            </div>
            <div className="w-full bg-[#EBE6DE] rounded-full h-1.5">
              <div 
                className={cn("h-1.5 rounded-full transition-all duration-300", job.progress === 100 ? "bg-emerald-500" : "bg-[#C2593E]")} 
                style={{ width: `${job.progress}%` }} 
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-[#FAF6F0]">
          <div className="flex items-center">
            {assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {assignees.slice(0, 3).map(a => (
                  <div 
                    key={a.uid} 
                    title={a.displayName} 
                    className="h-6 w-6 rounded-full bg-[#FAF6F0] text-[#C2593E] font-bold text-[9px] flex items-center justify-center border-2 border-white uppercase z-10 hover:z-20 shadow-sm"
                  >
                    {a.displayName?.[0] || 'U'}
                  </div>
                ))}
                {assignees.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 font-bold text-[9px] flex items-center justify-center border-2 border-white z-0 shadow-sm">
                    +{assignees.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span className="text-[9px] font-extrabold uppercase tracking-wide">Waiting assignment</span>
              </div>
            )}
          </div>

          <div className={cn("flex flex-col text-right", isDeadlineApproaching ? "text-[#C2593E] font-extrabold" : "text-slate-700")}>
            <span className="text-[8px] text-[#8C6A5C] font-extrabold uppercase tracking-wider mb-0.5">Deadline</span>
            <span className="text-[11px] font-extrabold">
              {job.deadline ? format(job.deadline, 'MMM d, yyyy') : (job.requestedDeadline ? `Req: ${format(job.requestedDeadline, 'MMM d')}` : 'None')}
            </span>
          </div>
        </div>

        {/* Quick status progress buttons */}
        {(isAssignee || isMasterAdmin || (isEditingAllowed && (job.status === 'completed' || job.status === 'posted'))) && (
          <div className="mt-3 pt-3 border-t border-[#FAF6F0] flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              {isAssignee && job.status === 'assigned' && (
                <button 
                  onClick={(e) => {
                    if (!job.deadline) {
                      e.stopPropagation();
                      alert("Please open the job card and set a deadline before starting progress.");
                      return;
                    }
                    handleStatusChange(e, 'in_progress');
                  }}
                  className={cn("w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer", job.deadline ? "bg-[#C2593E] hover:bg-[#A3432A] text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")}
                  title={!job.deadline ? "Deadline required to start" : ""}
                >
                  Start Progress <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {isAssignee && job.status === 'in_progress' && (
                <button 
                  onClick={(e) => handleStatusChange(e, 'completed')}
                  className={cn("w-full flex items-center justify-center gap-1.5 py-1.5 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer", job.gdriveLink ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-200 text-slate-400 cursor-not-allowed")}
                  title={!job.gdriveLink ? "Google Drive link required to finish this job" : ""}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Finish Job
                </button>
              )}
              {isAssignee && job.status === 'completed' && (
                <button 
                  onClick={(e) => handleStatusChange(e, 'in_progress')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  title="Move back to progress for revisions"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Needs Revision
                </button>
              )}
              {isEditingAllowed && job.status === 'completed' && (
                <button 
                  onClick={(e) => handleStatusChange(e, 'posted')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer"
                  title="Mark as Published and Posted"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Posted
                </button>
              )}
              {isEditingAllowed && job.status === 'posted' && (
                <button 
                  onClick={(e) => handleStatusChange(e, 'completed')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  title="Revert to Completed status"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Undo Posted
                </button>
              )}
            </div>
            {isMasterAdmin && (
              <div className="flex gap-1.5">
                 <button 
                   onClick={(e) => {
                     const statusOrder: Job['status'][] = ['open', 'assigned', 'in_progress', 'completed', 'posted'];
                     const currentIndex = statusOrder.indexOf(job.status);
                     if (currentIndex > 0) handleStatusChange(e, statusOrder[currentIndex - 1]);
                   }}
                   disabled={job.status === 'open'}
                   className="flex-1 py-1 text-[#8C6A5C] bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] text-[8px] font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                   title="Force backward"
                 >
                   &larr; Revert
                 </button>
                 <button 
                   onClick={(e) => {
                     const statusOrder: Job['status'][] = ['open', 'assigned', 'in_progress', 'completed', 'posted'];
                     const currentIndex = statusOrder.indexOf(job.status);
                     if (currentIndex < statusOrder.length - 1) handleStatusChange(e, statusOrder[currentIndex + 1]);
                   }}
                   disabled={job.status === 'posted'}
                   className="flex-1 py-1 text-[#8C6A5C] bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] text-[8px] font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                   title="Force forward"
                 >
                   Advance &rarr;
                 </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
