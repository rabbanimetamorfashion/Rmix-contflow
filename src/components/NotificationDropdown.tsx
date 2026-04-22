import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: number;
  type: string;
  jobId?: string;
}

export function NotificationDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // According to rule, we can read where userId == request.auth.uid
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
    });

    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string, read: boolean) => {
    if (read) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const navigate = useNavigate();

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id, n.read);
    setIsOpen(false);
    if (n.jobId) {
      navigate(`/jobs?jobId=${n.jobId}`);
    } else {
      // Default to jobs board
      navigate(`/jobs`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus:outline-none"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 focus:outline-none z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="text-sm font-bold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{unreadCount} New</span>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-sm text-center text-slate-500">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-4 py-3 border-b border-slate-50 flex items-start space-x-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-indigo-50/30' : ''}`}
                  >
                    {!n.read && <div className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-slate-800 ${!n.read ? 'font-medium' : 'font-normal'}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
