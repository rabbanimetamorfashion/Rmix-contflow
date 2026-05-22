import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Job } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { BRANDS } from '../constants';
import { cn } from '../lib/utils';
import { Layers, CheckCircle2, Link as LinkIcon, Clock, ChevronRight, Activity, ArrowUpRight, HelpCircle, UserCheck } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  textColor?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

const StatCard = ({ title, value, textColor = "text-[#221B18]", subtitle, icon }: StatCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
    className="bg-white p-5 rounded-2xl shadow-[0_2px_4px_rgba(34,27,24,0.02),0_4px_12px_rgba(34,27,24,0.02)] border border-[#EBE6DE] hover:border-[#C2593E]/20 hover:shadow-md transition-all flex justify-between items-start"
  >
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-extrabold ${textColor} tracking-tight`}>{value}</p>
        {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase pb-1">{subtitle}</p>}
      </div>
    </div>
    {icon && <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#C2593E]">{icon}</div>}
  </motion.div>
);

export function Dashboard() {
  const { user } = useAuth();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  
  const [timeframe, setTimeframe] = useState<'all' | 'this_month' | 'last_month' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All Brands');

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      setAllJobs(jobs);
    });
    
    // Fetch users to display proper names
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    });

    return () => {
      unsub();
      unsubUsers();
    };
  }, []);

  const filteredJobs = useMemo(() => {
    let filtered = allJobs;
    const now = new Date();

    if (timeframe === 'this_month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = allJobs.filter(j => isWithinInterval(j.createdAt, { start, end }));
    } else if (timeframe === 'last_month') {
      const lastMonth = subMonths(now, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      filtered = allJobs.filter(j => isWithinInterval(j.createdAt, { start, end }));
    } else if (timeframe === 'custom' && customStart && customEnd) {
      const start = startOfDay(new Date(customStart));
      const end = endOfDay(new Date(customEnd));
      filtered = allJobs.filter(j => isWithinInterval(j.createdAt, { start, end }));
    }

    if (selectedBrand !== 'All Brands') {
      filtered = filtered.filter(j => Array.isArray(j.brand) ? j.brand.includes(selectedBrand) : j.brand === selectedBrand);
    }

    return filtered;
  }, [allJobs, timeframe, customStart, customEnd, selectedBrand]);

  const summary = useMemo(() => {
    const total = filteredJobs.length;
    const open = filteredJobs.filter(j => j.status === 'open').length;
    const assigned = filteredJobs.filter(j => j.status === 'assigned').length;
    const inProgress = filteredJobs.filter(j => j.status === 'in_progress').length;
    const completed = filteredJobs.filter(j => j.status === 'completed' || j.status === 'posted').length;
    
    const totalProgress = filteredJobs.reduce((acc, j) => {
      if (j.checklists && j.checklists.length > 0) {
        const checkDone = j.checklists.filter(c => c.isCompleted).length;
        return acc + Math.round((checkDone / j.checklists.length) * 100);
      }
      return acc + (j.progress || 0);
    }, 0);
    
    const overallProgress = total > 0 ? Math.round(totalProgress / total) : 0;
    const approachingDeadline = filteredJobs.filter(j => j.deadline && j.status !== 'completed' && (j.deadline - Date.now()) < 172800000).length;

    return { total, open, assigned, inProgress, completed, overallProgress, approachingDeadline };
  }, [filteredJobs]);

  // Client specific active orders - to trace progress easily!
  const clientActiveOrders = useMemo(() => {
    if (!user) return [];
    // Show active user tasks or general active queries
    return allJobs.filter(j => j.creatorId === user.uid && j.status !== 'posted');
  }, [allJobs, user]);

  // Warm, organic aesthetic colors for the Recharts distribution
  const pieData = [
    { name: 'To Do', value: summary.open, color: '#F3EFEA' }, 
    { name: 'Open', value: summary.open, color: '#EDC553' }, // honey gold
    { name: 'Assigned', value: summary.assigned, color: '#D99863' }, // copper/bronze
    { name: 'In Progress', value: summary.inProgress, color: '#C2593E' }, // warm rust
    { name: 'Delivered', value: summary.completed, color: '#4B8B67' } // forest green
  ].filter(d => d.value > 0);

  // Group by Brand
  const brandDataObj = filteredJobs.reduce((acc, job) => {
    if (Array.isArray(job.brand)) {
      if (job.brand.length === 0) {
        acc['Unbranded'] = (acc['Unbranded'] || 0) + 1;
      } else {
        job.brand.forEach(b => {
          acc[b] = (acc[b] || 0) + 1;
        });
      }
    } else {
      const b = job.brand || 'Unbranded';
      acc[b] = (acc[b] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const brandData = Object.entries(brandDataObj).map(([name, Total]) => ({ name, Total: Number(Total) })).sort((a,b) => b.Total - a.Total);

  // Group by Job Type
  const jobTypeDataObj = filteredJobs.reduce((acc, job) => {
    if (!job.jobType) return acc;
    const label = job.jobType.replace('_', ' ');
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const jobTypeData = Object.entries(jobTypeDataObj)
    .map(([name, Total]) => ({ name: String(name).charAt(0).toUpperCase() + String(name).slice(1), Total: Number(Total) }))
    .sort((a,b) => b.Total - a.Total);

  // Identify status step index for Client pipeline stepper
  const getStatusStepIndex = (status: Job['status']) => {
    const steps: Job['status'][] = ['open', 'assigned', 'in_progress', 'completed', 'posted'];
    return steps.indexOf(status);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col space-y-7 text-[#221B18] font-sans pb-12 antialiased">
      
      {/* Warm Welcoming Header Row */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] bg-[#C2593E]/10 px-3 py-1 rounded-full font-bold tracking-widest uppercase text-[#C2593E] border border-[#C2593E]/20 mb-2.5 inline-block">
            {user?.role.replace('_', ' ')} Studio Hub
          </span>
          <h1 className="text-2xl font-black tracking-tight text-[#221B18]">
            Good Day, {user?.displayName || 'Creative Partner'}!
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-semibold">Welcome to ContentFlow • Collaborative Workspace</p>
        </div>
        
        {/* Sorting options & Brand filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <select 
            value={selectedBrand} 
            onChange={e => setSelectedBrand(e.target.value)}
            className="text-xs px-3.5 h-10 border border-[#EBE6DE] rounded-xl bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-600 w-full sm:w-auto cursor-pointer"
          >
            <option value="All Brands">All Brands</option>
            {BRANDS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          
          <select 
            value={timeframe} 
            onChange={e => setTimeframe(e.target.value as any)}
            className="text-xs px-3.5 h-10 border border-[#EBE6DE] rounded-xl bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-600 w-full sm:w-auto cursor-pointer"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2.5">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium" />
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium" />
            </div>
          )}
        </div>
      </header>

      {/* Warm sticky instructions notes */}
      <div className="bg-[#FAF6F0] rounded-2xl border border-[#EBE6DE] p-5 shadow-inner">
        <div className="flex gap-3">
          <HelpCircle className="w-5 h-5 text-[#C2593E] flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-[#221B18] tracking-tight">Need to request another project or watch progress?</p>
            <p className="text-slate-500 font-semibold leading-relaxed">
              Use the <span className="text-[#C2593E] font-extrabold">Order Request</span> page to submit new graphic or video requirements. The production team will assign an editor immediately, and you can watch progress real-time on your dashboard pipeline below!
            </p>
          </div>
        </div>
      </div>

      {/* CLIENT SPECIFIC WORKFLOW TRACKER PIPELINE (Absolute game changer for client transparency!) */}
      {clientActiveOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EBE6DE] p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center border-b border-[#FAF6F0] pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#221B18]">
                Your Live Order Delivery Journeys ({clientActiveOrders.length})
              </h2>
            </div>
            <span className="text-[9px] uppercase font-extrabold tracking-widest text-[#C2593E] bg-[#C2593E]/5 px-2.5 py-1 rounded-lg border border-[#C2593E]/10">
              Live Tracker
            </span>
          </div>

          <div className="space-y-6">
            {clientActiveOrders.map(job => {
              const currentStepIdx = getStatusStepIndex(job.status);
              const totalItems = job.checklists?.length || 0;
              const finishedItems = job.checklists?.filter(c => c.isCompleted).length || 0;
              
              return (
                <div key={job.id} className="p-4 rounded-xl border border-dashed border-[#EBE6DE] hover:border-[#C2593E]/40 hover:bg-[#FAF6F0]/20 transition-all space-y-4">
                  {/* Job meta row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#221B18]">{job.title}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        Brand: {Array.isArray(job.brand) ? job.brand.join(', ') : job.brand} • Type: {String(job.jobType).replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {totalItems > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-semibold block">Production Tasks Completed</span>
                          <span className="text-xs font-extrabold text-[#C2593E]">{finishedItems}/{totalItems} ({job.progress}%)</span>
                        </div>
                      )}

                      {/* Drive Deliverable Link */}
                      {job.gdriveLink && (
                        <a 
                          href={job.gdriveLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-transform hover:scale-103 cursor-pointer"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>Delivered Drive Output</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Stepper Timeline */}
                  <div className="grid grid-cols-5 gap-1.5 md:gap-4 pt-2">
                    {[
                      { l: '1. Submitted', key: 'open' },
                      { l: '2. Assigned', key: 'assigned' },
                      { l: '3. Producing', key: 'in_progress' },
                      { l: '4. Delivered', key: 'completed' },
                      { l: '5. Published', key: 'posted' }
                    ].map((step, idx) => {
                      const isActive = idx === currentStepIdx;
                      const isDone = idx < currentStepIdx;
                      
                      return (
                        <div key={step.key} className="flex flex-col space-y-2">
                          <div className={cn(
                            "h-2.5 rounded-full transition-all shadow-inner",
                            isActive ? "bg-[#C2593E]" : isDone ? "bg-emerald-500" : "bg-slate-100"
                          )} />
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-[8px] md:text-[10px] font-bold truncate tracking-tight transition-colors",
                              isActive ? "text-[#C2593E] font-black" : isDone ? "text-emerald-700" : "text-slate-400"
                            )}>
                              {step.l}
                            </span>
                            {isActive && (
                              <span className="text-[7.5px] uppercase font-extrabold tracking-widest text-[#C2593E] animate-pulse">
                                CURRENT STEP
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terracotta-tinted modern Stat Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Volume" value={summary.total} subtitle="Active Requests" icon={<Layers className="w-5 h-5" />} />
        <StatCard title="Delivery Progress" value={`${summary.overallProgress}%`} textColor="text-[#C2593E]" subtitle="Completed Steps" icon={<Activity className="w-5 h-5" />} />
        <StatCard title="Nearing Target" value={summary.approachingDeadline} textColor="text-amber-600" subtitle="Due soon" icon={<Clock className="w-5 h-5" />} />
        <StatCard title="Jobs Delivered" value={summary.completed} textColor="text-emerald-700" subtitle="In Review/Done" icon={<CheckCircle2 className="w-5 h-5" />} />
      </div>

      {/* Interactive visual metrics grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Distribution Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#EBE6DE] p-5 col-span-1 flex flex-col">
          <h2 className="font-extrabold text-xs tracking-wider text-[#221B18] uppercase mb-6 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C2593E]" /> 
            Workflow Allocation
          </h2>
          <div className="flex-1 flex justify-center items-center min-h-[250px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="40%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EBE6DE', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontFamily: 'Plus Jakarta Sans', fontSize: '11px' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', bottom: 0 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 font-bold">No Data in Period</p>
            )}
          </div>
        </div>

        {/* Brand workload or job type load metrics */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#EBE6DE] p-5 col-span-1 lg:col-span-2 flex flex-col">
          <h2 className="font-extrabold text-xs tracking-wider text-[#221B18] uppercase mb-6 flex items-center">
            <span className={cn("w-2.5 h-2.5 rounded-full mr-2", selectedBrand === 'All Brands' ? "bg-amber-500" : "bg-emerald-500")}></span> 
            {selectedBrand === 'All Brands' ? 'Workload Volume By Brand' : `${selectedBrand} Job types`}
          </h2>
          <div className="flex-1 min-h-[250px] w-full">
            {(selectedBrand === 'All Brands' ? brandData : jobTypeData).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedBrand === 'All Brands' ? brandData : jobTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#8C6A5C' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#8C6A5C' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: '#FAF6F0' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EBE6DE', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontFamily: 'Plus Jakarta Sans', fontSize: '11px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#221B18', marginBottom: '4px' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="Total" fill={selectedBrand === 'All Brands' ? "#C2593E" : "#4B8B67"} radius={[6, 6, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs text-slate-400 font-bold">No active chart records</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* PRODUCTION TEAM WORKLOAD LOGS (For admins and master admins to monitor crew loads) */}
      {user?.role !== 'production' && (
      <div className="bg-white rounded-2xl shadow-sm border border-[#EBE6DE] p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-[#FAF6F0] pb-3.5">
          <UserCheck className="w-5 h-5 text-[#C2593E]" />
          <h2 className="font-extrabold text-xs tracking-wider text-[#221B18] uppercase">
            Team Load & Performance Ledger
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#FAF6F0] uppercase text-[9px] font-bold text-slate-400 tracking-wider">
                <th className="pb-3 pr-4">Team Member</th>
                <th className="pb-3 px-4">Active Allocation load</th>
                <th className="pb-3 px-4">Completed Deliverables</th>
                <th className="pb-3 pl-4 text-right">Fulfillment Rate</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(allJobs.flatMap(j => j.assigneeIds || [j.assigneeId]).filter(Boolean))).map(uid => {
                const assignedFiltered = filteredJobs.filter(j => j.assigneeId === uid || j.assigneeIds?.includes(uid));
                const completedCount = assignedFiltered.filter(j => j.status === 'completed' || j.status === 'posted').length;
                const totalAssignedInPeriod = assignedFiltered.length;
                const completionRate = totalAssignedInPeriod > 0 ? Math.round((completedCount / totalAssignedInPeriod) * 100) : 0;
                
                const activeCount = allJobs.filter(j => (j.status === 'assigned' || j.status === 'in_progress') && (j.assigneeId === uid || j.assigneeIds?.includes(uid))).length;

                if (totalAssignedInPeriod === 0 && activeCount === 0) return null;

                const memberData = users.find(u => u.uid === uid);
                const displayName = memberData?.displayName || `Account ID: ...${String(uid).slice(-6)}`;

                return (
                  <tr key={uid} className="border-b border-[#FAF6F0] last:border-0 hover:bg-[#FAF6F0]/50 transition-colors">
                    <td className="py-3.5 pr-4 font-bold text-xs text-slate-800">{displayName}</td>
                    <td className="py-3.5 px-4">
                      <span className={cn("px-3 py-1 rounded-full text-[9px] font-bold", activeCount > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>
                        {activeCount} active tasks
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-slate-600">{completedCount} tasks</td>
                    <td className="py-3.5 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                          <div className="bg-[#C2593E] h-1.5 rounded-full" style={{ width: `${completionRate}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-800">{completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {allJobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs font-bold text-slate-400">No current allocation performance records this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
