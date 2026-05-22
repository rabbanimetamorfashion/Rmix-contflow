import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDocs, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { Job, Board } from '../types';
import { JobCard } from '../components/JobCard';
import { JobModal } from '../components/JobModal';
import { Plus, Trash2, Search } from 'lucide-react';
import { BRANDS } from '../constants';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export function JobBoard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | undefined>(undefined);
  
  const [selectedBrand, setSelectedBrand] = useState<string>('All Brands');
  const [showMyJobs, setShowMyJobs] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [timeframe, setTimeframe] = useState<'all' | 'this_month' | 'last_month' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'requestedDeadline' | 'productionDeadline' | 'jobType' | 'alpha'>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Custom Boards State
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>('main');
  const [isAddBoardModalOpen, setIsAddBoardModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  useEffect(() => {
    // Listen to jobs
    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));
    });

    // Listen to users (to resolve assignee displays & assign)
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    });

    // Listen to custom boards
    const qBoards = query(collection(db, 'boards'), orderBy('createdAt', 'asc'));
    const unsubBoards = onSnapshot(qBoards, (snapshot) => {
      setBoards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board)));
    });

    return () => {
      unsubJobs();
      unsubUsers();
      unsubBoards();
    };
  }, []);

  // Handle URL query for auto-opening jobs
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId && jobs.length > 0) {
      const jobToOpen = jobs.find(j => j.id === jobId);
      if (jobToOpen && !isModalOpen) {
        setSelectedJob(jobToOpen);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, jobs, isModalOpen]);

  // Approaching deadline check & notify
  useEffect(() => {
    if (!user || user.role !== 'production') return;

    const myJobs = jobs.filter(j => (j.assigneeId === user.uid || j.assigneeIds?.includes(user.uid)) && j.status !== 'completed' && j.deadline);
    
    myJobs.forEach(job => {
      if (job.deadline && (job.deadline - Date.now()) < 172800000 && job.id) {
        const notifId = `deadline_${job.id}_${user.uid}`;
        setDoc(doc(db, 'notifications', notifId), {
          userId: user.uid,
          message: `Deadline approaching for job: ${job.title}`,
          read: false,
          createdAt: Date.now(),
          type: 'deadline_approaching'
        }, { merge: true }).catch(console.error);
      }
    });
  }, [jobs, user]);

  const handleOpenModal = (job?: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedJob(undefined);
    if (searchParams.has('jobId')) {
      searchParams.delete('jobId');
      setSearchParams(searchParams);
    }
  };

  const handleWipeAll = async () => {
    if (!user || user.role !== 'master_admin') return;
    const word = prompt("Type 'WIPE' to delete all jobs in the database permanently. This cannot be undone.");
    if (word === 'WIPE') {
       try {
         const allDocs = await getDocs(collection(db, 'jobs'));
         for (const d of allDocs.docs) {
            await deleteDoc(doc(db, 'jobs', d.id));
         }
         alert("All jobs deleted successfully.");
       } catch (err) {
         console.error("Wipe failed", err);
         alert("Failed to wipe jobs.");
       }
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (boardId === 'main') return;
    if (!window.confirm(`Are you sure you want to delete the job board "${boardName}"? All jobs on this board will be moved back to the Main Board.`)) return;
    try {
      await deleteDoc(doc(db, 'boards', boardId));
      
      const affectedJobs = jobs.filter(j => j.boardId === boardId);
      for (const job of affectedJobs) {
        if (job.id) {
          await updateDoc(doc(db, 'jobs', job.id), { boardId: 'main' });
        }
      }
      
      setActiveBoardId('main');
      alert(`Board "${boardName}" has been successfully deleted.`);
    } catch (err) {
      console.error("Failed to delete board:", err);
      alert("Failed to delete board. Check permissions.");
    }
  };

  const handleAddBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'master_admin') return;
    if (!newBoardName.trim()) {
      alert("Please enter a board name.");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'boards'), {
        name: newBoardName.trim(),
        createdAt: Date.now(),
        creatorId: user.uid
      });
      setIsAddBoardModalOpen(false);
      setNewBoardName('');
      setActiveBoardId(docRef.id);
    } catch (err) {
      console.error("Failed to create board:", err);
      alert("Failed to create board. Check permissions.");
    }
  };

  const productionUsers = users.filter(u => u.role === 'production');
  const allowedToCreate = user?.role === 'admin' || user?.role === 'master_admin';

  // Decorate productionUsers with active workload count
  const productionUsersWithWorkload = productionUsers.map(u => {
    const activeJobsCount = jobs.filter(j => 
      (j.status === 'assigned' || j.status === 'in_progress') && 
      (j.assigneeId === u.uid || j.assigneeIds?.includes(u.uid))
    ).length;
    return { ...u, activeJobsCount };
  });

  let filteredByDate = [...jobs];
  const now = new Date();
  
  if (timeframe === 'this_month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    filteredByDate = filteredByDate.filter(j => isWithinInterval(j.createdAt, { start, end }));
  } else if (timeframe === 'last_month') {
    const start = startOfMonth(subMonths(now, 1));
    const end = endOfMonth(subMonths(now, 1));
    filteredByDate = filteredByDate.filter(j => isWithinInterval(j.createdAt, { start, end }));
  } else if (timeframe === 'custom' && customStart && customEnd) {
    const start = startOfDay(new Date(customStart));
    const end = endOfDay(new Date(customEnd));
    filteredByDate = filteredByDate.filter(j => isWithinInterval(j.createdAt, { start, end }));
  }

  let boardJobs = filteredByDate.filter(j => {
    if (activeBoardId === 'main') {
      return !j.boardId || j.boardId === 'main';
    }
    return j.boardId === activeBoardId;
  });
  if (selectedBrand !== 'All Brands') {
    boardJobs = boardJobs.filter(j => Array.isArray(j.brand) ? j.brand.includes(selectedBrand) : j.brand === selectedBrand);
  }

  if (showMyJobs && user) {
    boardJobs = boardJobs.filter(j => j.assigneeId === user.uid || j.assigneeIds?.includes(user.uid));
  } else if (selectedAssignee !== 'all') {
    boardJobs = boardJobs.filter(j => j.assigneeId === selectedAssignee || j.assigneeIds?.includes(selectedAssignee));
  }

  if (showMyOrders && user) {
    boardJobs = boardJobs.filter(j => j.creatorId === user.uid);
  }

  // Filter by search query (title, description, or associated brand)
  if (searchQuery.trim()) {
    const queryLower = searchQuery.toLowerCase().trim();
    boardJobs = boardJobs.filter(j => {
      const titleMatch = (j.title || '').toLowerCase().includes(queryLower);
      const descMatch = (j.description || '').toLowerCase().includes(queryLower);
      
      let brandMatch = false;
      if (Array.isArray(j.brand)) {
        brandMatch = j.brand.some(b => (b || '').toLowerCase().includes(queryLower));
      } else if (j.brand) {
        brandMatch = j.brand.toLowerCase().includes(queryLower);
      }
      
      return titleMatch || descMatch || brandMatch;
    });
  }

  let sortedJobs = [...boardJobs];
  
  sortedJobs.sort((a, b) => {
    let result = 0;
    if (sortBy === 'newest') {
      result = b.createdAt - a.createdAt; // Default desc: newest first
    } else if (sortBy === 'requestedDeadline') {
      const aVal = a.requestedDeadline || Number.MAX_SAFE_INTEGER;
      const bVal = b.requestedDeadline || Number.MAX_SAFE_INTEGER;
      if (aVal !== bVal) {
        result = aVal - bVal;
      } else {
        const aType = a.jobType || '';
        const bType = b.jobType || '';
        if (aType !== bType) result = aType.localeCompare(bType);
        else result = (a.title || '').localeCompare(b.title || '');
      }
    } else if (sortBy === 'productionDeadline') {
      const aVal = a.deadline || Number.MAX_SAFE_INTEGER;
      const bVal = b.deadline || Number.MAX_SAFE_INTEGER;
      if (aVal !== bVal) {
        result = aVal - bVal;
      } else {
        const aType = a.jobType || '';
        const bType = b.jobType || '';
        if (aType !== bType) result = aType.localeCompare(bType);
        else result = (a.title || '').localeCompare(b.title || '');
      }
    } else if (sortBy === 'jobType') {
      const aType = a.jobType || '';
      const bType = b.jobType || '';
      if (aType !== bType) result = aType.localeCompare(bType);
      else result = (a.title || '').localeCompare(b.title || '');
    } else if (sortBy === 'alpha') {
      result = (a.title || '').localeCompare(b.title || '');
    }
    
    return sortOrder === 'asc' ? result : -result;
  });

  const todoJobs = sortedJobs.filter(j => j.status === 'open' || j.status === 'assigned');
  const progressJobs = sortedJobs.filter(j => j.status === 'in_progress');
  const finishedJobs = sortedJobs.filter(j => j.status === 'completed');
  const postedJobs = sortedJobs.filter(j => j.status === 'posted');

  return (
    <div className="max-w-full mx-auto flex flex-col h-full space-y-6 text-slate-800">
      
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Board</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track production workflows by brand.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 w-full xl:w-auto">
          <div className="flex-1 sm:flex-none w-full sm:w-64">
            <div className="relative">
              <span className="absolute -top-2 left-2 bg-[#F8FAFC] px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 z-10">Search Jobs</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, description, brand..."
                className="w-full border-slate-300 rounded-md text-sm pl-8 pr-8 h-10 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-800"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none z-10"
                >
                  <span className="text-sm font-bold leading-none">&times;</span>
                </button>
              )}
            </div>
          </div>

          {user?.role === 'production' && (
            <label className="flex items-center space-x-2 text-sm font-bold text-slate-600 cursor-pointer p-2 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 h-10">
              <input 
                type="checkbox" 
                checked={showMyJobs} 
                onChange={(e) => setShowMyJobs(e.target.checked)} 
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" 
              />
              <span>My Tasks</span>
            </label>
          )}

          {(user?.role === 'admin' || user?.role === 'master_admin') && (
            <div className="relative flex-1 sm:flex-none">
              <span className="absolute -top-2 left-2 bg-[#F8FAFC] px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Crew Member</span>
              <select 
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full sm:w-48 border-slate-300 rounded-md text-sm pl-3 pr-8 h-10 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-800"
              >
                <option value="all">All Crew</option>
                {users.filter(u => u.role === 'production').map(u => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:flex-none">
            <span className="absolute -top-2 left-2 bg-[#F8FAFC] px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Timeframe</span>
            <select 
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="w-full sm:w-40 border-slate-300 rounded-md text-sm pl-3 pr-8 h-10 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-800"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {timeframe === 'custom' && (
            <div className="flex gap-2 w-full sm:w-auto h-10">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full sm:w-auto border-slate-300 rounded-md text-xs px-2 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full sm:w-auto border-slate-300 rounded-md text-xs px-2 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          )}

          <div className="relative flex-1 sm:flex-none">
            <span className="absolute -top-2 left-2 bg-[#F8FAFC] px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Board Brand</span>
            <select 
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full sm:w-48 border-slate-300 rounded-md text-sm pl-3 pr-8 h-10 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-800"
            >
              <option value="All Brands">All Brands</option>
              {BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 sm:flex-none flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <span className="absolute -top-2 left-2 bg-[#F8FAFC] px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Sort By</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full border-slate-300 rounded-md text-sm pl-3 pr-8 h-10 border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-800"
              >
                <option value="newest">Created Date</option>
                <option value="requestedDeadline">Req Deadline</option>
                <option value="productionDeadline">Prod Deadline</option>
                <option value="jobType">Job Type</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>
            
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="h-10 px-3 border border-slate-300 rounded-md shadow-sm bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1"
            >
              {sortOrder === 'asc' ? 'Asc \u2191' : 'Desc \u2193'}
            </button>
          </div>

          {user && (
            <label className="flex items-center space-x-2 text-sm font-bold text-slate-600 cursor-pointer p-2 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 h-10 select-none">
              <input 
                type="checkbox" 
                checked={showMyOrders} 
                onChange={(e) => setShowMyOrders(e.target.checked)} 
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" 
              />
              <span>My Orders</span>
            </label>
          )}
          
          {user?.role === 'master_admin' && (
            <button
              onClick={handleWipeAll}
              className="px-3 py-2.5 rounded-md text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition flex items-center w-full sm:w-auto justify-center border border-red-200"
              title="Reset Board (DANGER)"
            >
              <Trash2 className="w-4 h-4 sm:mr-0 lg:mr-1.5" />
              <span className="inline lg:hidden xl:inline ml-1.5 sm:ml-0 lg:ml-1.5">Reset Board</span>
            </button>
          )}

          {allowedToCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-indigo-700 transition flex items-center shadow-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Job
            </button>
          )}
        </div>
      </div>

      {/* Board Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveBoardId('main')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide ${
            activeBoardId === 'main'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Main Board
        </button>
        {boards.map(b => (
          <div key={b.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveBoardId(b.id!)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide ${
                activeBoardId === b.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {b.name}
            </button>
            {user?.role === 'master_admin' && activeBoardId === b.id && (
              <button
                onClick={() => handleDeleteBoard(b.id!, b.name)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg hover:text-red-700 transition"
                title="Delete this board"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {user?.role === 'master_admin' && (
          <button
            onClick={() => setIsAddBoardModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1 uppercase tracking-wide"
          >
            <Plus className="w-3.5 h-3.5" /> Add Board
          </button>
        )}
      </div>

      {isAddBoardModalOpen && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-w-md w-full p-6 text-slate-800"
          >
            <h3 className="text-lg font-bold mb-1">Create Job Board</h3>
            <p className="text-slate-500 text-xs mb-4">Enter a name for the new job board. Only master admins can perform this action.</p>
            <form onSubmit={handleAddBoardSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Board Name</label>
                <input
                  type="text"
                  required
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  placeholder="ex: Video Production, Social Media Ads"
                  className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-800"
                  maxLength={100}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddBoardModalOpen(false); setNewBoardName(''); }}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition animate-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition shadow-sm animate-none"
                >
                  Create Board
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto min-h-[500px] pb-4">
        <div className="flex flex-col lg:flex-row gap-6 h-full items-start w-full min-w-full lg:min-w-[900px]">
          
          {/* Column: To Do */}
          <div className="w-full lg:w-1/4 bg-slate-100 rounded-xl p-4 flex flex-col border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-slate-700 uppercase tracking-wide">To Do</h2>
              <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{todoJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[70vh] lg:max-h-full pb-2">
              {todoJobs.map(job => (
                <JobCard key={job.id} job={job} onClick={handleOpenModal} users={users} />
              ))}
              {todoJobs.length === 0 && (
                <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-xs font-bold">No Open Tasks</div>
              )}
            </div>
          </div>

          {/* Column: On Progress */}
          <div className="w-full lg:w-1/4 bg-indigo-50/50 rounded-xl p-4 flex flex-col border border-indigo-100/50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-indigo-800 uppercase tracking-wide flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
                On Progress
              </h2>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{progressJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[70vh] lg:max-h-full pb-2">
              {progressJobs.map(job => (
                <JobCard key={job.id} job={job} onClick={handleOpenModal} users={users} />
              ))}
              {progressJobs.length === 0 && (
                <div className="border border-dashed border-indigo-200 rounded-lg p-6 text-center text-indigo-400/70 text-xs font-bold">Clear</div>
              )}
            </div>
          </div>

          {/* Column: Finish */}
          <div className="w-full lg:w-1/4 bg-emerald-50/50 rounded-xl p-4 flex flex-col border border-emerald-100/50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-emerald-800 uppercase tracking-wide flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                Finish
              </h2>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{finishedJobs.length + postedJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[70vh] lg:max-h-full pb-2">
              {finishedJobs.map(job => (
                <JobCard key={job.id} job={job} onClick={handleOpenModal} users={users} />
              ))}
              {finishedJobs.length === 0 && (
                <div className="border border-dashed border-emerald-200 rounded-lg p-6 text-center text-emerald-400/70 text-xs font-bold">Clear</div>
              )}
            </div>
          </div>

          {/* Column: Posted */}
          <div className="w-full lg:w-1/4 bg-violet-50/50 rounded-xl p-4 flex flex-col border border-violet-100/50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-violet-800 uppercase tracking-wide flex items-center">
                <span className="w-2 h-2 rounded-full bg-violet-500 mr-2"></span>
                Posted
              </h2>
              <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{postedJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[70vh] lg:max-h-full pb-2">
              {postedJobs.map(job => (
                <JobCard key={job.id} job={job} onClick={handleOpenModal} users={users} />
              ))}
              {postedJobs.length === 0 && (
                <div className="border border-dashed border-violet-200 rounded-lg p-6 text-center text-violet-400/70 text-xs font-bold">Clear</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {isModalOpen && (
        <JobModal 
          job={selectedJob} 
          onClose={handleCloseModal} 
          productionUsers={productionUsersWithWorkload as AppUser[]}
          currentUser={user}
          allUsers={users}
          defaultBoardId={activeBoardId}
        />
      )}
    </div>
  );
}
