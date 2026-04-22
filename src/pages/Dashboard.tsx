import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Job } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

import { BRANDS } from '../constants';
import { cn } from '../lib/utils';

interface JobSummary {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  completed: number;
  overallProgress: number;
  approachingDeadline: number;
}

const StatCard = ({ title, value, textColor = "text-slate-900", subtitle }: { title: string, value: string | number, textColor?: string, subtitle?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-5 rounded-xl shadow-sm border border-slate-200"
  >
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <div className="flex items-end gap-2">
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-500 font-medium pb-1">{subtitle}</p>}
    </div>
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
    
    // Also fetch users so we can display proper names instead of UID
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
      filtered = filtered.filter(j => j.brand === selectedBrand);
    }

    return filtered;
  }, [allJobs, timeframe, customStart, customEnd, user, selectedBrand]);

  const summary = useMemo(() => {
    const total = filteredJobs.length;
    const open = filteredJobs.filter(j => j.status === 'open').length;
    const assigned = filteredJobs.filter(j => j.status === 'assigned').length;
    const inProgress = filteredJobs.filter(j => j.status === 'in_progress').length;
    const completed = filteredJobs.filter(j => j.status === 'completed').length;
    
    // Total checks or progress across all
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

  const pieData = [
    { name: 'To Do', value: summary.open, color: '#f8fafc' }, // but pie colors needs to be distinct
    { name: 'Open', value: summary.open, color: '#fbbf24' },
    { name: 'Assigned', value: summary.assigned, color: '#a78bfa' },
    { name: 'In Progress', value: summary.inProgress, color: '#6366f1' },
    { name: 'Completed', value: summary.completed, color: '#34d399' }
  ].filter(d => d.value > 0);

  // Group by Brand
  const brandDataObj = filteredJobs.reduce((acc, job) => {
    const b = job.brand || 'Unbranded';
    acc[b] = (acc[b] || 0) + 1;
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

  return (
    <div className="max-w-6xl mx-auto flex flex-col space-y-6 text-slate-800 font-sans pb-10">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Overview Dashboard</h1>
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-indigo-700 border border-indigo-100">
            {user?.role.replace('_', ' ')}
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <select 
            value={selectedBrand} 
            onChange={e => setSelectedBrand(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-600 w-full sm:w-auto"
          >
            <option value="All Brands">All Brands</option>
            {BRANDS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          
          <select 
            value={timeframe} 
            onChange={e => setTimeframe(e.target.value as any)}
            className="text-sm px-3 py-2 border border-slate-200 rounded bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-600 w-full sm:w-auto"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm px-3 py-2 border border-slate-200 rounded bg-white font-medium" />
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-sm px-3 py-2 border border-slate-200 rounded bg-white font-medium" />
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={summary.total} subtitle="requests" />
        <StatCard title="Overall Progress" value={`${summary.overallProgress}%`} textColor="text-indigo-600" subtitle="avg. completion" />
        <StatCard title="Nearing Deadline" value={summary.approachingDeadline} textColor="text-amber-600" subtitle="within 48h" />
        <StatCard title="Jobs Finished" value={summary.completed} textColor="text-emerald-600" subtitle="delivered" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progress Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 col-span-1 flex flex-col">
          <h2 className="font-bold text-sm tracking-wide text-slate-800 uppercase mb-6 flex items-center">
            <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span> 
            Status Distribution
          </h2>
          <div className="flex-1 flex justify-center items-center min-h-[250px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', bottom: 0 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 font-bold">No Data Available</p>
            )}
          </div>
        </div>

        {/* Workload by Brand or Job Type Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 col-span-1 lg:col-span-2 flex flex-col">
          <h2 className="font-bold text-sm tracking-wide text-slate-800 uppercase mb-6 flex items-center">
            <span className={cn("w-2 h-2 rounded-full mr-2", selectedBrand === 'All Brands' ? "bg-amber-500" : "bg-emerald-500")}></span> 
            {selectedBrand === 'All Brands' ? 'Workload By Brand' : `Job Types for ${selectedBrand}`}
          </h2>
          <div className="flex-1 min-h-[250px] w-full">
            {(selectedBrand === 'All Brands' ? brandData : jobTypeData).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedBrand === 'All Brands' ? brandData : jobTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="Total" fill={selectedBrand === 'All Brands' ? "#6366f1" : "#10b981"} radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-400 font-bold">No Data Available</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {user?.role !== 'production' && (
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-bold text-sm tracking-wide text-slate-800 uppercase mb-4 flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> 
          Production Team Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                <th className="pb-3 pr-4">Team Member</th>
                <th className="pb-3 px-4">Active Workload</th>
                <th className="pb-3 px-4">Finished (Period)</th>
                <th className="pb-3 pl-4 text-right">Completion Rate (Period)</th>
              </tr>
            </thead>
            <tbody>
              {/* Note: This is an aggregation of the filteredJobs for active/completed */}
              {Array.from(new Set(allJobs.flatMap(j => j.assigneeIds || [j.assigneeId]).filter(Boolean))).map(uid => {
                const assignedFiltered = filteredJobs.filter(j => j.assigneeId === uid || j.assigneeIds?.includes(uid));
                const completedCount = assignedFiltered.filter(j => j.status === 'completed').length;
                const totalAssignedInPeriod = assignedFiltered.length;
                const completionRate = totalAssignedInPeriod > 0 ? Math.round((completedCount / totalAssignedInPeriod) * 100) : 0;
                
                // Active workload is ALWAYS based on 'allJobs' regardless of timeframe, because it's their CURRENT load
                const activeCount = allJobs.filter(j => (j.status === 'assigned' || j.status === 'in_progress') && (j.assigneeId === uid || j.assigneeIds?.includes(uid))).length;

                if (totalAssignedInPeriod === 0 && activeCount === 0) return null;

                const memberData = users.find(u => u.uid === uid);
                const displayName = memberData?.displayName || `Account ID: ...${String(uid).slice(-6)}`;

                return (
                  <tr key={uid} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-bold text-xs text-slate-700">{displayName}</td>
                    <td className="py-3 px-4">
                      <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", activeCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
                        {activeCount} active jobs
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-600">{completedCount} completed</td>
                    <td className="py-3 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${completionRate}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-700">{completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {allJobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs font-bold text-slate-400">No team data for this period.</td>
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
