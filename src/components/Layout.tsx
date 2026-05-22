import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Briefcase, Users, LogOut, Bell, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationDropdown } from './NotificationDropdown';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [newDisplayName, setNewDisplayName] = React.useState(user?.displayName || '');

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
          {navigation.map((item) => (
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
          ))}
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
        {/* Mobile Header & Desktop Topbar */}
        <header className="h-16 bg-white border-b border-[#EBE6DE] flex items-center justify-between px-4 sm:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#C2593E] text-white font-extrabold text-sm">C</div>
            <span className="text-lg font-extrabold text-slate-800 tracking-tight">ContentFlow</span>
          </div>
          <div className="hidden md:flex flex-1"></div>
          <div className="flex items-center space-x-3">
            <NotificationDropdown />
            <button
              onClick={signOut}
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-xl"
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
    </div>
  );
}
