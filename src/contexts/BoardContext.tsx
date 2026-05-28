import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Board, Job } from '../types';

interface BoardContextType {
  boards: Board[];
  activeBoardId: string;
  setActiveBoardId: (id: string) => void;
  currentBoardName: string;
  isAddBoardModalOpen: boolean;
  setIsAddBoardModalOpen: (open: boolean) => void;
  createBoard: (name: string) => Promise<string>;
  deleteBoard: (id: string, name: string) => Promise<void>;
  renameBoard: (id: string, newName: string) => Promise<void>;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>('main');
  const [isAddBoardModalOpen, setIsAddBoardModalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    // Keep a subscription for boards
    const qBoards = query(collection(db, 'boards'), orderBy('createdAt', 'asc'));
    const unsubBoards = onSnapshot(qBoards, (snapshot) => {
      setBoards(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Board)));
    });

    // Sub to jobs to handle board deletion migration
    const qJobs = query(collection(db, 'jobs'));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job)));
    });

    return () => {
      unsubBoards();
      unsubJobs();
    };
  }, []);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const currentBoardName = activeBoardId === 'main' ? 'Main Board' : (activeBoard?.name || 'Custom Board');

  const createBoard = async (name: string): Promise<string> => {
    if (!user || user.role !== 'master_admin') {
      throw new Error("Unauthorized");
    }
    const docRef = await addDoc(collection(db, 'boards'), {
      name: name.trim(),
      createdAt: Date.now(),
      creatorId: user.uid
    });
    setActiveBoardId(docRef.id);
    return docRef.id;
  };

  const deleteBoard = async (boardId: string, boardName: string) => {
    if (boardId === 'main') return;
    if (!user || user.role !== 'master_admin') {
      throw new Error("Unauthorized");
    }
    await deleteDoc(doc(db, 'boards', boardId));

    // Migrating jobs to 'main'
    const affectedJobs = jobs.filter(j => j.boardId === boardId);
    for (const job of affectedJobs) {
      if (job.id) {
        await updateDoc(doc(db, 'jobs', job.id), { boardId: 'main' });
      }
    }
    setActiveBoardId('main');
  };

  const renameBoard = async (boardId: string, newName: string) => {
    if (boardId === 'main') return;
    if (!user || user.role !== 'master_admin') {
      throw new Error("Unauthorized");
    }
    await updateDoc(doc(db, 'boards', boardId), {
      name: newName.trim()
    });
  };

  return (
    <BoardContext.Provider value={{
      boards,
      activeBoardId,
      setActiveBoardId,
      currentBoardName,
      isAddBoardModalOpen,
      setIsAddBoardModalOpen,
      createBoard,
      deleteBoard,
      renameBoard
    }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoards() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoards must be used within a BoardProvider');
  }
  return context;
}
