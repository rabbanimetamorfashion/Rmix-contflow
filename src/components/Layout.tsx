import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBoards } from '../contexts/BoardContext';
import { LayoutDashboard, Briefcase, Users, LogOut, Bell, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationDropdown } from './NotificationDropdown';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

export function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [newDisplayName, setNewDisplayName] = React.useState(user?.displayName || '');

  const {
    boards,
    activeBoardId,
    setActiveBoardId,
    isAddBoardModalOpen,
    setIsAddBoardModalOpen,
    createBoard,
    deleteBoard
  } = useBoards();
  const [newBoardName, setNewBoardName] = React.useState('');

  React.useEffect(() => {
    setNewDisplayName(user?.displayName || '');
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDisplayName.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: newDisplayName });
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile");
    }
  };

  const handleAddBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    try {
      await createBoard(newBoardName.trim());
      setNewBoardName('');
      setIsAddBoardModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create board. Make sure you are master admin.");
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
    { name: 'Order Request', href: '/order', icon: ShoppingCart, current: location.pathname === '/order' },
    { name: 'Job Board', href: '/jobs', icon: Briefcase, current: location.pathname === '/jobs' },
    ...(user?.role === 'master_admin' ? [{ name: 'Role Management', href: '/roles', icon: Users, current: location.pathname === '/roles' }] : []),
  ];

  return (
    <div className="flex h-screen bg-[#FAF6F0] text-[#2C2621] font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 bg-white border-r border-[#EBE6DE] flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 md:px-6 border-b border-[#EBE6DE] justify-center md:justify-start bg-white/50">
          <div className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-[#C2593E] text-white font-extrabold shadow-sm transition-transform duration-200 hover:scale-105">C</div>
          <div className="hidden md:flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2593E] text-white font-extrabold text-sm shadow-sm">C</div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-[#C2593E] to-[#8C4A32] bg-clip-text text-transparent tracking-tight">ContentFlow</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-2 lg:px-4">
          {navigation.map((item) => {
            if (item.name === 'Job Board') {
              return (
                <div key={item.name} className="space-y-1">
                  {/* Job Board Main Link Container */}
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group",
                    item.current 
                      ? "bg-[#FAF6F0] text-[#C2593E] border-l-4 border-[#C2593E] pl-2 rounded-l-none" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}>
                    <Link
                      to={item.href}
                      className="flex items-center flex-1"
                    >
                      <item.icon className={cn("h-5 w-5 flex-shrink-0 md:mr-3", item.current ? "text-[#C2593E]" : "text-slate-400")} />
                      <span className="hidden md:inline">{item.name}</span>
                    </Link>

                    {/* Plus Icon on the right of the job board writing (Admins/Master admins only) */}
                    {user?.role === 'master_admin' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsAddBoardModalOpen(true);
                        }}
                        className="hidden md:flex p-1 hover:bg-[#C2593E]/10 rounded text-[#C2593E] transition cursor-pointer"
                        title="Create New Board"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Available Job Boards nested switcher underneath (shown when Job Board menu is active) */}
                  {item.current && (
                    <div className="hidden md:flex flex-col pl-7 pr-1 space-y-1 mt-1 border-l border-slate-200/60 ml-5.5">
                      {/* Main Board */}
                      <button
                        onClick={() => setActiveBoardId('main')}
                        className={cn(
                          "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer text-left",
                          activeBoardId === 'main'
                            ? "bg-[#C2593E]/10 text-[#C2593E]"
                            : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800"
                        )}
                      >
                        <span>🗂️ Main Board</span>
                      </button>

                      {/* Custom Boards list */}
                      {boards.map(b => (
                        <div
                          key={b.id}
                          className={cn(
                            "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-bold rounded-lg group/board-item transition-all",
                            activeBoardId === b.id
                              ? "bg-[#C2593E]/10 text-[#C2593E]"
                              : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800"
                          )}
                        >
                          <button
                            onClick={() => setActiveBoardId(b.id!)}
                            className="flex-1 text-left truncate cursor-pointer"
                            title={b.name}
                          >
                            📁 {b.name}
                          </button>

                          {/* Delete Icon on the right of the board name (Master admins only, if board is active or when hovered) */}
                          {user?.role === 'master_admin' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (b.id && window.confirm(`Are you sure you want to delete the job board "${b.name}"? All jobs on this board will be moved back to the Main Board.`)) {
                                  try {
                                    await deleteBoard(b.id, b.name);
                                  } catch (error) {
                                    console.error(error);
                                  }
                                }
                              }}
                              className="opacity-0 group-hover/board-item:opacity-100 hover:text-red-600 transition p-0.5 rounded cursor-pointer ml-1"
                              title={`Delete ${b.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center justify-center md:justify-start px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
                  item.current 
                    ? "bg-[#FAF6F0] text-[#C2593E] border-l-4 border-[#C2593E] pl-2 rounded-l-none" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0 md:mr-3", item.current ? "text-[#C2593E]" : "text-slate-400")} />
                <span className="hidden md:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 md:p-4 border-t border-[#EBE6DE]">
          <div className="flex items-center mb-4 justify-center md:justify-start">
            <div 
              className="h-10 w-10 rounded-full bg-amber-100 text-amber-800 border-2 border-white flex items-center justify-center font-bold uppercase overflow-hidden cursor-pointer shadow-sm hover:scale-105 transition-transform" 
              onClick={() => setIsEditingProfile(true)} 
              title="Edit Profile"
            >
               {user?.displayName?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="ml-3 hidden md:flex flex-1 min-w-0 flex-col cursor-pointer" onClick={() => setIsEditingProfile(true)} title="Edit Profile">
              <p className="text-sm font-bold text-slate-800 truncate hover:text-[#C2593E] transition-colors flex items-center gap-1">
                {user?.displayName}
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </p>
              <p className="text-[9px] text-[#8C6A5C] font-bold uppercase tracking-wider truncate">{user?.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center md:justify-start px-3 py-2.5 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors bg-white border border-[#EBE6DE] shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4 md:mr-3 text-slate-500" />
            <span className="hidden md:inline uppercase tracking-wider">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="h-16 bg-white border-b border-[#EBE6DE] flex md:hidden items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#C2593E] text-white font-extrabold text-sm">C</div>
            <span className="text-lg font-extrabold text-slate-800 tracking-tight">ContentFlow</span>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationDropdown />
            <button
              onClick={signOut}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 border border-[#EBE6DE]">
            <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Edit Profile</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-[#8C6A5C] uppercase tracking-wider mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={newDisplayName} 
                  onChange={e => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-[#C2593E] focus:border-[#C2593E] outline-none font-semibold text-slate-800 bg-[#FAF6F0]/40 focus:bg-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-[#EBE6DE] rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-[#C2593E] rounded-xl hover:bg-[#A6452C] shadow-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#EBE6DE] flex justify-around items-center h-16 z-40 px-2 pb-safe shadow-lg">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-[9px] font-bold uppercase tracking-widest",
              item.current ? "text-[#C2593E]" : "text-slate-400 hover:text-slate-800"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>

      {/* Create Board Modal */}
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
    </div>
  );
}
