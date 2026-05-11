import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskCategory = 'bug' | 'feature' | 'refactor' | 'infra' | 'content' | 'research' | 'design' | 'ops';

export interface TaskComment {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  content: string;
  createdAt: Timestamp;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  assignedTo: string[];
  createdBy: string;
  dueDate?: Timestamp;
  filePath?: string;
  linkedPR?: string;
  tags: string[];
  comments: TaskComment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StaffMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
}

export function subscribeTasks(cb: (tasks: Task[]) => void) {
  return onSnapshot(
    query(collection(db, 'ops_tasks'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Task)
    )
  );
}

export function subscribeStaff(cb: (staff: StaffMember[]) => void) {
  return onSnapshot(collection(db, 'ops_staff'), snap =>
    cb(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as StaffMember))
  );
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) {
  const user = auth.currentUser;
  return addDoc(collection(db, 'ops_tasks'), {
    ...task,
    createdBy: user?.uid || 'system',
    comments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(id: string, updates: Partial<Task>) {
  await updateDoc(doc(db, 'ops_tasks', id), { ...updates, updatedAt: serverTimestamp() });
}

export async function addTaskComment(taskId: string, content: string) {
  const user = auth.currentUser;
  if (!user) return;
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    userId: user.uid,
    displayName: user.displayName || user.email || 'Staff',
    photoURL: user.photoURL || undefined,
    content,
    createdAt: Timestamp.now(),
  };
  await updateDoc(doc(db, 'ops_tasks', taskId), {
    comments: arrayUnion(comment),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, 'ops_tasks', id));
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo:        { label: 'To Do',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  in_progress: { label: 'In Progress', color: '#00f0ff', bg: 'rgba(0,240,255,0.1)'   },
  review:      { label: 'In Review',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  done:        { label: 'Done',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  blocked:     { label: 'Blocked',     color: '#ff0080', bg: 'rgba(255,0,128,0.1)'   },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ff0080' },
  high:     { label: 'High',     color: '#f97316' },
  medium:   { label: 'Medium',   color: '#f59e0b' },
  low:      { label: 'Low',      color: '#64748b' },
};

export const CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string }> = {
  bug:      { label: 'Bug',      color: '#ef4444' },
  feature:  { label: 'Feature',  color: '#00f0ff' },
  refactor: { label: 'Refactor', color: '#8b5cf6' },
  infra:    { label: 'Infra',    color: '#f59e0b' },
  content:  { label: 'Content',  color: '#22c55e' },
  research: { label: 'Research', color: '#ec4899' },
  design:   { label: 'Design',   color: '#f97316' },
  ops:      { label: 'Ops',      color: '#94a3b8' },
};
