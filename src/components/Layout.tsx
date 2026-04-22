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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 md:px-6 border-b border-slate-200 justify-center md:justify-start">
          <div className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">C</div>
          <span className="hidden md:block text-xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">ContentFlow</span>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-2 lg:px-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-center md:justify-start px-2 md:px-3 py-2 text-sm font-medium rounded-md transition-colors",
                item.current ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              <item.icon className={cn("h-6 w-6 md:h-5 md:w-5 flex-shrink-0 md:mr-3", item.current ? "text-indigo-600" : "text-slate-400")} />
              <span className="hidden md:inline">{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 md:p-4 border-t border-slate-200">
          <div className="flex items-center mb-4 justify-center md:justify-start">
            <div className="h-8 w-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-700 font-bold uppercase overflow-hidden cursor-pointer" onClick={() => setIsEditingProfile(true)} title="Edit Profile">
               {user?.displayName?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="ml-3 hidden md:flex flex-1 min-w-0 flex-col cursor-pointer" onClick={() => setIsEditingProfile(true)} title="Edit Profile">
              <p className="text-sm font-medium text-slate-800 truncate hover:text-indigo-600 transition-colors flex items-center gap-1">
                {user?.displayName}
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{user?.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center md:justify-start px-2 md:px-3 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-50 transition-colors bg-white border border-slate-200"
          >
            <LogOut className="h-5 w-5 md:mr-3 text-slate-500" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        {/* Mobile Header & Desktop Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white font-bold text-sm">C</div>
            <span className="text-lg font-bold text-slate-800">ContentFlow</span>
          </div>
          <div className="hidden md:flex flex-1"></div>
          <div className="flex items-center space-x-3">
            <div className="relative hidden md:flex items-center bg-white px-3 py-1.5 border border-slate-200 rounded-md shadow-sm w-64 mr-2">
              <svg className="h-4 w-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" placeholder="Search..." className="text-sm outline-none w-full bg-transparent"/>
            </div>
            <NotificationDropdown />
            <button
              onClick={signOut}
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Profile</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={newDisplayName} 
                  onChange={e => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-40 px-2 pb-safe">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-[10px] font-bold uppercase tracking-wide",
              item.current ? "text-indigo-600" : "text-slate-400 hover:text-slate-800"
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
