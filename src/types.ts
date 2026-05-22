export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface Board {
  id?: string;
  name: string;
  createdAt: number;
  creatorId: string;
}

export interface Comment {
  id?: string;
  jobId: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface Job {
  id?: string;
  title: string;
  description: string;
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'posted';
  assigneeId?: string;
  assigneeIds?: string[]; // Multiple assignees
  assignerId?: string;
  createdAt: number;
  deadline?: number;
  gdriveLink?: string;
  progress: number;
  checklists?: ChecklistItem[];
  boardId?: string; // Target Job Board

  // New fields for Job Ordering
  creatorId?: string;
  jobType?: string;
  quantity?: number;
  brand?: string | string[];
  campaign?: string;
  requestedDeadline?: number;
  scriptLink?: string;

  // New fields for Workflow Timestamps
  assignedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  
  updatedAt?: number;
}
