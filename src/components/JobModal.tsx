import React, { useState, useEffect } from 'react';
import { Job, ChecklistItem, Comment } from '../types';
import { AppUser } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, addDoc, collection, query, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { X, Link as LinkIcon, Calendar, MessageSquare, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

export function JobModal({ job, onClose, productionUsers, currentUser, allUsers = [] }: { job?: Job; onClose: () => void; productionUsers: AppUser[]; currentUser: AppUser | null; allUsers?: AppUser[] }) {
  const isNew = !job;
  const isEditingAllowed = currentUser?.role === 'admin' || currentUser?.role === 'master_admin';
  const isMasterAdmin = currentUser?.role === 'master_admin';
  const isAssignee = currentUser?.uid && (job?.assigneeId === currentUser.uid || job?.assigneeIds?.includes(currentUser.uid));
  
  const [title, setTitle] = useState(job?.title || '');
  const [description, setDescription] = useState(job?.description || '');
  
  // Maintain backward compatibility with assigneeId while pushing to assigneeIds
  const [assigneeIds, setAssigneeIds] = useState<string[]>(job?.assigneeIds || (job?.assigneeId ? [job?.assigneeId] : []));
  
  const [status, setStatus] = useState<Job['status']>(job?.status || 'open');
  const [gdriveLink, setGdriveLink] = useState(job?.gdriveLink || '');
  
  const hasExistingDeadline = !!job?.deadline;
  const [deadline, setDeadline] = useState(job?.deadline ? format(job.deadline, 'yyyy-MM-dd') : '');

  const [checklists, setChecklists] = useState<ChecklistItem[]>(job?.checklists || []);
  const [newChecklistText, setNewChecklistText] = useState('');

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const [saving, setSaving] = useState(false);

  // Load comments
  useEffect(() => {
    if (isNew || !job?.id) return;
    const q = query(collection(db, 'jobs', job.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    });
    return () => unsub();
  }, [job?.id, isNew]);

  useEffect(() => {
    if (job?.id) {
      localStorage.setItem(`job_viewed_${job.id}`, Date.now().toString());
    }
  }, [job, comments]); // Re-run when it opens, and when comments change over the socket

  const toggleAssignee = (uid: string) => {
    setAssigneeIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return;
    setChecklists([...checklists, { id: Date.now().toString(), text: newChecklistText.trim(), isCompleted: false }]);
    setNewChecklistText('');
  };

  const toggleChecklist = (id: string) => {
    setChecklists(checklists.map(c => c.id === id ? { ...c, isCompleted: !c.isCompleted } : c));
  };

  const removeChecklist = (id: string) => {
    setChecklists(checklists.filter(c => c.id !== id));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || isNew) return;
    const text = newComment.trim();
    setNewComment('');
    
    try {
      await addDoc(collection(db, 'jobs', job.id!, 'comments'), {
        jobId: job.id,
        userId: currentUser.uid,
        text,
        createdAt: Date.now()
      });

      await updateDoc(doc(db, 'jobs', job.id!), { updatedAt: Date.now() });

      // Notify others
      const usersToNotify = new Set<string>();
      if (job?.creatorId && job.creatorId !== currentUser.uid) {
        usersToNotify.add(job.creatorId);
      }
      job?.assigneeIds?.forEach(id => {
        if (id !== currentUser.uid) usersToNotify.add(id);
      });
      if (job?.assigneeId && job.assigneeId !== currentUser.uid) {
        usersToNotify.add(job.assigneeId);
      }

      usersToNotify.forEach(id => {
        addDoc(collection(db, 'notifications'), {
          userId: id,
          message: `New comment on "${job?.title}": ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
          read: false,
          createdAt: Date.now(),
          type: 'new_comment',
          jobId: job?.id
        });
      });
    } catch (err) {
      console.error(err);
      alert('Failed to add comment');
    }
  };

  const calculateProgress = () => {
    if (checklists.length === 0) return job?.progress || 0;
    const completed = checklists.filter(c => c.isCompleted).length;
    return Math.round((completed / checklists.length) * 100);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (status === 'completed' && (!gdriveLink || !gdriveLink.trim())) {
       alert("Please provide a Google Drive Output Link before marking the job as completed.");
       return;
    }
    
    setSaving(true);

    try {
      const progress = calculateProgress();
      
      if (isNew) {
        if (!isEditingAllowed) throw new Error("Unauthorized to create");
        const newJob: Job = {
          title,
          description,
          status: 'open',
          progress: 0,
          createdAt: Date.now(),
        };
        const docRef = await addDoc(collection(db, 'jobs'), newJob);
        
        if (assigneeIds.length > 0) {
           await updateDoc(docRef, { assigneeIds, assignerId: currentUser.uid, status: 'assigned', assignedAt: Date.now() });
           assigneeIds.forEach(id => {
             addDoc(collection(db, 'notifications'), {
               userId: id, message: `You have been assigned a new job: ${title}`, read: false, createdAt: Date.now(), type: 'assignment'
             });
           });
        }
      } else {
        const docRef = doc(db, 'jobs', job.id!);
        const currentAssigneeIds = job.assigneeIds || (job.assigneeId ? [job.assigneeId] : []);
        
        if (isEditingAllowed) {
          const updates: Partial<Job> = { title, description };
          
          const isAssigneesChanged = JSON.stringify(assigneeIds.sort()) !== JSON.stringify(currentAssigneeIds.sort());
          if (isAssigneesChanged) {
            updates.assigneeIds = assigneeIds;
            updates.assignerId = currentUser.uid;
            
            // Only update timestamp and status if we are moving from open to assigned
            if (job.status === 'open' && assigneeIds.length > 0) {
              updates.status = 'assigned';
              updates.assignedAt = Date.now();
            } else if (assigneeIds.length === 0 && job.status === 'assigned') {
              updates.status = 'open';
              updates.assignedAt = null as any; // clear it conceptually
            }

            const newlyAssigned = assigneeIds.filter(id => !currentAssigneeIds.includes(id));
            newlyAssigned.forEach(id => {
              addDoc(collection(db, 'notifications'), {
                userId: id, message: `You have been assigned a job: ${title}`, read: false, createdAt: Date.now(), type: 'assignment'
              });
            });
          }
          if (isAssignee || isEditingAllowed) {
             updates.status = updates.status || status;
             updates.progress = progress;
             updates.gdriveLink = gdriveLink;
             updates.checklists = checklists;
             if (!hasExistingDeadline && deadline) updates.deadline = new Date(deadline).getTime();
          }
          updates.updatedAt = Date.now();
          await updateDoc(docRef, updates);
        } else if (isAssignee) {
          const updates: Partial<Job> = { status, progress, gdriveLink, checklists, updatedAt: Date.now() };
          if (!hasExistingDeadline && deadline) updates.deadline = new Date(deadline).getTime();
          await updateDoc(docRef, updates);
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save. Check permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!job?.id || !isMasterAdmin || !window.confirm("Are you sure you want to delete this job order? This action is irreversible.")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'jobs', job.id));
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to delete job order.');
    } finally {
      setSaving(false);
    }
  };

  const creator = allUsers.find(u => u.uid === job?.creatorId);

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm sm:p-0 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-w-4xl w-full flex flex-col md:flex-row h-[90vh] md:h-[80vh]"
      >
        {/* Left Side: Job Details & Form */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div>
              <h3 className="text-sm font-bold text-slate-800">{isNew ? 'Create Job Order' : 'Job Details'}</h3>
              {!isNew && creator && <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Ordered by: <span className="text-indigo-600">{creator.displayName}</span></p>}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors md:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="jobForm" onSubmit={handleSave} className="p-5 flex-1 space-y-6">
            {!isNew && job?.createdAt && (
              <div className="bg-slate-50 p-3 rounded flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200">
                <div><span className="text-slate-400">Created:</span> <span className="text-slate-700">{format(job.createdAt, 'MMM d, HH:mm')}</span></div>
                {job.assignedAt && <div><span className="text-slate-400">Assigned:</span> <span className="text-indigo-600">{format(job.assignedAt, 'MMM d, HH:mm')}</span></div>}
                {job.startedAt && <div><span className="text-slate-400">Started:</span> <span className="text-indigo-600">{format(job.startedAt, 'MMM d, HH:mm')}</span></div>}
                {job.finishedAt && <div><span className="text-slate-400">Finished:</span> <span className="text-emerald-600">{format(job.finishedAt, 'MMM d, HH:mm')}</span></div>}
              </div>
            )}
            
            {!isNew && job?.jobType && (
              <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Job Type</p><p className="font-bold text-slate-800 capitalize">{job.jobType.replace('_', ' ')}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quantity</p><p className="font-bold text-slate-800">{job.quantity}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Brand</p><p className="font-bold text-slate-800">{job.brand}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Campaign</p><p className="font-bold text-slate-800">{job.campaign}</p></div>
                {job.requestedDeadline && (
                  <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Client Requested Deadline</p><p className="font-bold text-amber-600">{format(job.requestedDeadline, 'MMM d, yyyy')}</p></div>
                )}
                {job.scriptLink && (
                  <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Docs / Script Link</p><a href={job.scriptLink} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline line-clamp-1">{job.scriptLink}</a></div>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Title</label>
                <input type="text" required disabled={!isNew && !isEditingAllowed} className="w-full text-sm px-3 py-2 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Description</label>
                <textarea required disabled={!isNew && !isEditingAllowed} rows={3} className="w-full text-sm px-3 py-2 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description"/>
              </div>

              {isEditingAllowed && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Assigned Team Members</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 p-3 rounded max-h-32 overflow-y-auto bg-slate-50">
                    {productionUsers.map(u => {
                      const count = (u as any).activeJobsCount || 0;
                      return (
                      <label key={u.uid} className="flex items-center justify-between text-sm cursor-pointer p-1.5 hover:bg-slate-100 rounded">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" checked={assigneeIds.includes(u.uid)} onChange={() => toggleAssignee(u.uid)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                          <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[8px] flex items-center justify-center uppercase">{u.displayName?.[0] || 'U'}</div>
                          <span className="font-bold text-slate-700 truncate">{u.displayName}</span>
                        </div>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", count > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600")}>
                          {count} active
                        </span>
                      </label>
                    )})}
                  </div>
                </div>
              )}
              {!isEditingAllowed && !isNew && assigneeIds.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Team</label>
                  <div className="flex flex-wrap gap-2">
                    {assigneeIds.map(id => {
                      const u = productionUsers.find(p => p.uid === id);
                      return u ? (
                        <div key={id} className="flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 shadow-sm">
                          <div className="h-4 w-4 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold text-[8px] uppercase">{u.displayName?.[0] || 'U'}</div>
                          <span className="text-xs font-bold text-indigo-900">{u.displayName}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Production Tools: Progress & Delivery */}
            {!isNew && (isAssignee || job.progress > 0 || job.gdriveLink || checklists.length > 0) && (
              <div className="border-t border-slate-100 pt-5 space-y-5">
                <h4 className="text-sm font-bold text-slate-800">Progress & Delivery</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Status</label>
                    <select disabled={!isAssignee && !isEditingAllowed} value={status} onChange={e => setStatus(e.target.value as Job['status'])} className="w-full text-sm px-3 py-2 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100">
                      <option value="open">Open</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      {isEditingAllowed && <option value="posted">Posted</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Deadline</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2h-4 w-4 text-slate-400 h-full" />
                      <input type="date" required min={job?.requestedDeadline ? format(job.requestedDeadline, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} disabled={!isAssignee || hasExistingDeadline} value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm disabled:bg-slate-100 text-sm"/>
                    </div>
                    {isAssignee && !hasExistingDeadline && <p className="text-[10px] text-amber-600 mt-1 font-bold">LOCKED ONCE SET</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex justify-between">
                    <span>Task Checklist (Auto Calculus)</span>
                    <span className="text-indigo-600">{calculateProgress()}%</span>
                  </label>
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-2">
                    {checklists.map(c => (
                      <div key={c.id} className="flex items-start gap-2 group p-1.5 hover:bg-slate-50 rounded">
                        <button type="button" disabled={!isAssignee} onClick={() => toggleChecklist(c.id)} className="mt-0.5 text-slate-400 disabled:opacity-50 hover:text-indigo-600">
                          {c.isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4" />}
                        </button>
                        <span className={cn("text-xs flex-1", c.isCompleted ? "line-through text-slate-400" : "text-slate-700 font-medium")}>{c.text}</span>
                        {isAssignee && (
                          <button type="button" onClick={() => removeChecklist(c.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {checklists.length === 0 && <p className="text-xs text-slate-400 italic">No tasks added yet.</p>}
                  </div>
                  
                  {isAssignee && (
                    <div className="flex gap-2">
                      <input type="text" value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddChecklist())} placeholder="Add a specific task/quantity..." className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <button type="button" onClick={handleAddChecklist} className="bg-indigo-50 text-indigo-600 border border-indigo-200 p-1.5 rounded hover:bg-indigo-100 transition"><Plus className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex justify-between items-center">
                    <span>Google Drive Output</span>
                    {gdriveLink && (
                      <a href={gdriveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 normal-case tracking-normal">
                         <LinkIcon className="w-3 h-3" /> Open
                      </a>
                    )}
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-0 h-full w-4 text-slate-400" />
                    <input type="url" disabled={!isAssignee} value={gdriveLink} onChange={e => setGdriveLink(e.target.value)} placeholder="Paste Link..." className="w-full pl-9 pr-3 py-2 text-xs rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"/>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Footer Save Area */}
          <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end gap-2 shrink-0">
            {isMasterAdmin && !isNew && (
              <button onClick={handleDelete} type="button" disabled={saving} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition mr-auto">Delete Job</button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition">Close</button>
            {(isNew ? isEditingAllowed : (isEditingAllowed || isAssignee)) && (
              <button form="jobForm" type="submit" disabled={saving} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center">
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Comments (Only show on existing jobs) */}
        {!isNew && (
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col bg-slate-50">
            <div className="px-4 py-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-slate-500" /> Discussion</h3>
              <button onClick={onClose} className="hidden md:block text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map(c => {
                const u = allUsers.find(p => p.uid === c.userId) || { displayName: 'Unknown User' };
                const isMe = currentUser?.uid === c.userId;
                return (
                  <div key={c.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "items-start")}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 mx-1">{u.displayName}</span>
                    <div className={cn("px-3 py-2 rounded-xl text-xs shadow-sm", isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none")}>
                      {c.text}
                    </div>
                    <span className="text-[8px] text-slate-400 mt-1 mx-1 font-medium">{format(c.createdAt, 'MMM d, HH:mm')}</span>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-xs text-center text-slate-400 italic py-10">No comments yet. Start the discussion!</p>}
            </div>

            <form onSubmit={handleAddComment} className="p-3 border-t border-slate-200 bg-white shrink-0 flex gap-2">
              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Type a message..." className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-full bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button type="submit" disabled={!newComment.trim()} className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"><Plus className="w-4 h-4" /></button>
            </form>
          </div>
        )}
        
      </motion.div>
    </div>
  );
}
