import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth, AppUser, UserRole } from '../contexts/AuthContext';
import { Shield, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';

export function RoleManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    });
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (e) {
      console.error(e);
      alert('Failed to update role. Make sure you have Master Admin privileges.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to delete user. Make sure you have Master Admin privileges.');
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'master_admin': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'admin': return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      default: return <Shield className="w-4 h-4 text-gray-400" />;
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Role Management</h1>
        <p className="text-slate-500 text-sm mt-1">Assign system privileges or manage user registry.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
              <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Role</th>
              <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assign Role</th>
              <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.map((u) => (
              <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold uppercase overflow-hidden border-2 border-white shadow-sm flex items-center">
                      <span className="mx-auto">{u.displayName?.[0] || u.email?.[0]}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-bold text-slate-800">{u.displayName}</div>
                      <div className="text-sm text-slate-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(u.role)}
                    <span className="text-xs font-bold text-slate-700 capitalize">{u.role.replace('_', ' ')}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                    disabled={u.email === 'rabbani.metamorfashion@gmail.com'}
                    className="mt-1 block ml-auto pl-3 pr-10 py-2 text-xs font-medium border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white border"
                  >
                    <option value="client">Client</option>
                    <option value="production">Production</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {u.email === 'rabbani.metamorfashion@gmail.com' || u.uid === currentUser?.uid ? (
                    <span className="text-xs text-slate-400 italic font-normal">Protected</span>
                  ) : confirmDeleteId === u.uid ? (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleDeleteUser(u.uid)}
                        className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded shadow-sm transition-colors"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(u.uid)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded transition-colors inline-flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
