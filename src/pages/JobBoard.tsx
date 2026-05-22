import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDocs, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { Job, Board } from '../types';
import { JobCard } from '../components/JobCard';
import { JobModal } from '../components/JobModal';
import { Plus, Trash2, Search, Briefcase, Filter, Calendar, Users as UsersIcon, LayoutGrid, CheckSquare } from 'lucide-react';
import { BRANDS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../lib/utils';

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
    <div className="max-w-full mx-auto flex flex-col h-full space-y-6 text-[#221B18] antialiased">
      
      {/* Header & Sticky Board Instructions (Warm Trello sticky index card) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white/70 p-5 rounded-2xl border border-[#EBE6DE] shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#221B18] flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-[#C2593E]" />
            Warm Workboard
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Production Kanban • Click checklists directly on the cards to mark off tasks in real-time.
          </p>
        </div>

        {/* Informative sticky style badge */}
        <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-2 px-3 text-[10px] font-bold text-amber-900 leading-normal max-w-sm">
          💡 <span className="uppercase text-[9px] tracking-wide text-amber-800">Production Secret:</span> Expand the <b>Production Steps</b> drawer on any card to resolve checklist steps without opening modal popups!
        </div>
      </div>

      {/* Filter and Board brand control panel */}
      <div className="bg-white rounded-2xl border border-[#EBE6DE] p-5 shadow-sm space-y-4">
        {/* Controls Grid */}
        <div className="flex flex-wrap items-center gap-3.5">
          {/* 1. Search Box (Exactly one, old one removed as requested) */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description or brand..."
              className="w-full border border-slate-200 rounded-xl text-xs pl-9 pr-8 h-10 outline-none focus:border-[#C2593E] focus:ring-1 focus:ring-[#C2593E] bg-[#FAF6F0]/40 font-semibold text-slate-800"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center text-slate-400"
              >
                &times;
              </button>
            )}
          </div>

          {/* 2. Brand Selector */}
          <div className="relative">
            <select 
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border border-slate-200 rounded-xl text-xs pl-3.5 pr-8 h-10 outline-none focus:border-[#C2593E] bg-[#FAF6F0]/20 font-bold text-slate-700 cursor-pointer min-w-[130px]"
            >
              <option value="All Brands">All Brands</option>
              {BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 3. Crew Member filter (Admins/Master admins only) */}
          {(user?.role === 'admin' || user?.role === 'master_admin') && (
            <div className="relative">
              <select 
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="border border-slate-200 rounded-xl text-xs pl-3.5 pr-8 h-10 outline-none focus:border-[#C2593E] bg-[#FAF6F0]/20 font-bold text-slate-700 cursor-pointer min-w-[140px]"
              >
                <option value="all">Everyone's Tasks</option>
                {users.filter(u => u.role === 'production').map(u => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Timeframe Selector */}
          <div className="relative">
            <select 
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="border border-slate-200 rounded-xl text-xs pl-3.5 pr-8 h-10 outline-none focus:border-[#C2593E] bg-[#FAF6F0]/20 font-bold text-slate-700 cursor-pointer min-w-[120px]"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {timeframe === 'custom' && (
            <div className="flex gap-1.5 h-10 items-center">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-slate-200 rounded-xl text-xs px-2 h-10 bg-[#FAF6F0]/30 font-semibold text-slate-700" />
              <span className="text-slate-400 font-bold text-xs">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-slate-200 rounded-xl text-xs px-2 h-10 bg-[#FAF6F0]/30 font-semibold text-slate-700" />
            </div>
          )}

          {/* 5. Production Personal Toggles */}
          {user?.role === 'production' && (
            <button 
              onClick={() => setShowMyJobs(prev => !prev)}
              className={cn(
                "h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer",
                showMyJobs 
                  ? "bg-[#C2593E] text-white border-[#C2593E] shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Assigned To Me: {showMyJobs ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {user && (
            <button 
              onClick={() => setShowMyOrders(prev => !prev)}
              className={cn(
                "h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer",
                showMyOrders 
                  ? "bg-[#C2593E] text-white border-[#C2593E] shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <span>My Orders: {showMyOrders ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* 6. Sort By Selection & Sort Order */}
          <div className="flex items-center gap-1">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-slate-200 rounded-xl text-xs pl-3.5 pr-8 h-10 outline-none focus:border-[#C2593E] bg-[#FAF6F0]/20 font-bold text-slate-700 cursor-pointer min-w-[120px]"
            >
              <option value="newest">Sort: Newest</option>
              <option value="requestedDeadline">Sort: Requested Deadline</option>
              <option value="productionDeadline">Sort: Prod Deadline</option>
              <option value="jobType">Sort: Job Type</option>
              <option value="alpha">Sort: A-Z Title</option>
            </select>
            
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="h-10 px-3 border border-slate-200 rounded-xl shadow-sm bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Empty Space pushers for right-alignment */}
          <div className="flex-1"></div>

          {/* 7. Action Button Panel (Wipe / Create Job Order buttons strictly aligned to the right of sort controls!) */}
          <div className="flex items-center gap-2">
            {user?.role === 'master_admin' && (
              <button
                onClick={handleWipeAll}
                className="h-10 px-3.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition flex items-center gap-1 cursor-pointer"
                title="Wipe Board Database"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wipe Database</span>
              </button>
            )}

            {allowedToCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="bg-[#C2593E] hover:bg-[#A3432A] text-white px-5.5 h-10 rounded-xl text-xs font-extrabold uppercase tracking-widest transition flex items-center gap-2 shadow-sm cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>New Job Request</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Board Brand Tab Separators (Trello nested filing look and feel) */}
      <div className="flex flex-wrap items-center gap-2 bg-[#FAF6F0] p-1.5 rounded-2xl border border-[#EBE6DE]">
        <button
          onClick={() => setActiveBoardId('main')}
          className={cn(
            "px-5 py-2.5 text-xs font-extrabold rounded-xl transition-all uppercase tracking-wider cursor-pointer",
            activeBoardId === 'main'
              ? 'bg-[#C2593E] text-white shadow-sm scale-102'
              : 'bg-white/80 border border-[#EBE6DE] text-slate-600 hover:bg-white hover:text-slate-900 shadow-xs'
          )}
        >
          🗂️ Main Board
        </button>
        {boards.map(b => (
          <div key={b.id} className="flex items-center gap-1 bg-white/40 p-1 rounded-xl border border-[#EBE6DE]/60">
            <button
              onClick={() => setActiveBoardId(b.id!)}
              className={cn(
                "px-4 py-2 text-xs font-extrabold rounded-xl transition-all uppercase tracking-wider cursor-pointer",
                activeBoardId === b.id
                  ? 'bg-[#C2593E] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-950'
              )}
            >
              📁 {b.name}
            </button>
            {user?.role === 'master_admin' && activeBoardId === b.id && (
              <button
                onClick={() => handleDeleteBoard(b.id!, b.name)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg hover:text-red-700 transition cursor-pointer"
                title="Delete this board permanent"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        
        {user?.role === 'master_admin' && (
          <button
            onClick={() => setIsAddBoardModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-dashed border-[#C2593E]/40 text-[#C2593E] hover:border-[#C2593E] hover:bg-[#C2593E]/5 transition-all flex items-center gap-1.5 uppercase tracking-wide cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Board
          </button>
        )}
      </div>

      {isAddBoardModalOpen && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-[#EBE6DE] overflow-hidden max-w-sm w-full p-6 text-[#221B18]"
          >
            <h3 className="text-lg font-black mb-1.5 tracking-tight">Create Job Board</h3>
            <p className="text-slate-500 text-xs mb-5">Enter a name for the new category board. Only master admins can create new boards.</p>
            <form onSubmit={handleAddBoardSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Board Category Name</label>
                <input
                  type="text"
                  required
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  placeholder="ex: Video Production, Social Ads, Main Store"
                  className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-800"
                  maxLength={100}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsAddBoardModalOpen(false); setNewBoardName(''); }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-[#EBE6DE] rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-black text-white bg-[#C2593E] rounded-xl hover:bg-[#A3432A] transition shadow-sm cursor-pointer"
                >
                  Create Board
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Kanban Board Grid */}
      <div className="flex-1 overflow-x-auto min-h-[580px] pb-6">
        <div className="flex flex-col lg:flex-row gap-5 h-full items-start w-full min-w-full lg:min-w-[1000px]">
          
          {/* Column 1: TO DO (Open requirements list) */}
          <div className="w-full lg:w-1/4 bg-[#EDE9E3]/75 rounded-2xl p-4.5 flex flex-col border border-[#DCD5CB] min-w-[250px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                <h2 className="font-extrabold text-[#221B18] text-xs uppercase tracking-wider">To Do</h2>
              </div>
              <span className="bg-white text-slate-600 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border border-[#EBE6DE]">{todoJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[75vh] lg:max-h-full pb-2">
              <AnimatePresence>
                {todoJobs.map(job => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={job.id}
                  >
                    <JobCard job={job} onClick={handleOpenModal} users={users} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {todoJobs.length === 0 && (
                <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 text-xs font-semibold bg-white/40">
                  Inbox Clear
                </div>
              )}
            </div>
          </div>

          {/* Column 2: ON PROGRESS (In production lane) */}
          <div className="w-full lg:w-1/4 bg-[#EFE9DE]/80 rounded-2xl p-4.5 flex flex-col border border-[#DECAB3] min-w-[250px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C2593E] shadow-sm animate-pulse" />
                <h2 className="font-extrabold text-[#221B18] text-xs uppercase tracking-wider">On Progress</h2>
              </div>
              <span className="bg-white text-[#C2593E] text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border border-[#DECAB3]">{progressJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[75vh] lg:max-h-full pb-2">
              <AnimatePresence>
                {progressJobs.map(job => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={job.id}
                  >
                    <JobCard job={job} onClick={handleOpenModal} users={users} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {progressJobs.length === 0 && (
                <div className="border border-dashed border-[#DECAB3]/80 rounded-xl p-8 text-center text-[#8C6A5C]/40 text-xs font-semibold bg-white/20">
                  No Active Production Work
                </div>
              )}
            </div>
          </div>

          {/* Column 3: FINISHED (Files uploaded, waiting review) */}
          <div className="w-full lg:w-1/4 bg-[#E3EFE3]/80 rounded-2xl p-4.5 flex flex-col border border-[#C9DEC9] min-w-[250px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                <h2 className="font-extrabold text-[#221B18] text-xs uppercase tracking-wider">Finish</h2>
              </div>
              <span className="bg-white text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border border-[#C9DEC9]">{finishedJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[75vh] lg:max-h-full pb-2">
              <AnimatePresence>
                {finishedJobs.map(job => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={job.id}
                  >
                    <JobCard job={job} onClick={handleOpenModal} users={users} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {finishedJobs.length === 0 && (
                <div className="border border-dashed border-[#C9DEC9]/80 rounded-xl p-8 text-center text-emerald-800/40 text-xs font-semibold bg-white/25">
                  Inbox Clear
                </div>
              )}
            </div>
          </div>

          {/* Column 4: POSTED (Final outcome delivered) */}
          <div className="w-full lg:w-1/4 bg-[#ECE3EF]/80 rounded-2xl p-4.5 flex flex-col border border-[#D9CBE2] min-w-[250px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-sm" />
                <h2 className="font-extrabold text-[#221B18] text-xs uppercase tracking-wider">Posted</h2>
              </div>
              <span className="bg-white text-violet-800 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border border-[#D9CBE2]">{postedJobs.length}</span>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[75vh] lg:max-h-full pb-2">
              <AnimatePresence>
                {postedJobs.map(job => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={job.id}
                  >
                    <JobCard job={job} onClick={handleOpenModal} users={users} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {postedJobs.length === 0 && (
                <div className="border border-dashed border-[#D9CBE2]/80 rounded-xl p-8 text-center text-violet-800/40 text-xs font-semibold bg-white/20">
                  No Delivered Content
                </div>
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
