import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { AppUser, UserRole } from '../contexts/AuthContext';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export function RoleManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);

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
        <p className="text-slate-500 text-sm mt-1">Assign system privileges to registered users.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
              <th scope="col" className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Role</th>
              <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assign Role</th>
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
                    className="mt-1 block pl-3 pr-10 py-2 text-xs font-medium border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white border"
                  >
                    <option value="client">Client</option>
                    <option value="production">Production</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
