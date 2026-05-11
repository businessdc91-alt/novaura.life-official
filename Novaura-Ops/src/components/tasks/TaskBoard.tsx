import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, MessageSquare, Clock, Search, Send, Trash2,
  FileCode, Filter, Calendar,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import {
  subscribeTasks, createTask, updateTask, deleteTask, addTaskComment, subscribeStaff,
  type Task, type TaskStatus, type TaskPriority, type TaskCategory, type StaffMember,
  STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_CONFIG,
} from '../../services/taskService';
import { useAppStore } from '../../stores/appStore';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];

// ── Small reusable pieces ────────────────────────────────────────────

function StaffAvatar({ member, size = 'sm' }: { member: StaffMember; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs'
    ? 'w-5 h-5 text-[9px]'
    : 'w-7 h-7 text-[11px]';
  return (
    <div
      title={member.displayName}
      className={`${cls} rounded-full bg-void-lighter border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-white/60`}
    >
      {member.photoURL
        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
        : (member.displayName || member.email).charAt(0).toUpperCase()
      }
    </div>
  );
}

function DueDateBadge({ ts }: { ts: any }) {
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const overdue = isPast(date) && date.setHours(23, 59, 59) < Date.now();
  const soon = !overdue && isWithinInterval(new Date(), { start: new Date(), end: addDays(date, 2) });
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
      overdue ? 'bg-red-500/15 text-red-400' : soon ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-white/40'
    }`}>
      <Clock className="w-2.5 h-2.5" />
      {format(date, 'MMM d')}
    </span>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────

function CreateModal({ staff, currentUid, onClose }: {
  staff: StaffMember[];
  currentUid?: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('feature');
  const [dueDate, setDueDate] = useState('');
  const [filePath, setFilePath] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>(currentUid ? [currentUid] : []);
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(p => [...p, t]);
    setTagInput('');
  };

  const toggleAssignee = (uid: string) =>
    setAssignees(p => p.includes(uid) ? p.filter(u => u !== uid) : [...p, uid]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: desc,
        status: 'todo',
        priority,
        category,
        assignedTo: assignees,
        tags,
        filePath: filePath || undefined,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-void border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <Plus className="w-4 h-4 text-neon-cyan" />
          <h2 className="text-white font-bold">New Task</h2>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          <input
            autoFocus
            className="w-full bg-void-lighter border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-neon-cyan/40 selectable"
            placeholder="Task title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <textarea
            className="w-full bg-void-lighter border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-neon-cyan/40 selectable resize-none"
            rows={3}
            placeholder="Description..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-white/30 text-xs mb-1.5">Priority</p>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-white/30 text-xs mb-1.5">Category</p>
              <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)}
                className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-white/30 text-xs mb-1.5">Due Date</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-neon-cyan/40" />
          </div>

          <div>
            <p className="text-white/30 text-xs mb-2">Assign To</p>
            <div className="flex flex-wrap gap-2 p-3 bg-void-lighter border border-white/10 rounded-xl min-h-[44px]">
              {staff.map(s => (
                <button key={s.uid} onClick={() => toggleAssignee(s.uid)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                    assignees.includes(s.uid)
                      ? 'bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan'
                      : 'bg-white/5 border border-white/10 text-white/50 hover:border-white/20'
                  }`}>
                  <StaffAvatar member={s} size="xs" />
                  {s.displayName.split(' ')[0]}
                </button>
              ))}
              {staff.length === 0 && <p className="text-white/20 text-xs italic">No staff loaded</p>}
            </div>
          </div>

          <div>
            <p className="text-white/30 text-xs mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs">
                  {t}
                  <button onClick={() => setTags(p => p.filter(x => x !== t))} className="text-white/30 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-neon-cyan/40 selectable"
                placeholder="Add tag... (Enter)"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
              <button onClick={addTag} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white text-xs transition-colors">Add</button>
            </div>
          </div>

          <div>
            <p className="text-white/30 text-xs mb-1.5">Linked File (optional)</p>
            <input
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-neon-cyan/40 selectable font-mono"
              placeholder="src/components/..."
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-white/5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-white/40 hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={saving || !title.trim()}
            className="px-6 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-xl text-sm font-semibold hover:bg-neon-cyan/20 transition-all disabled:opacity-40">
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────

function DetailPanel({ task, staff, onClose }: {
  task: Task;
  staff: StaffMember[];
  onClose: () => void;
}) {
  const { openFile } = useAppStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [descVal, setDescVal] = useState(task.description);
  const [tagInput, setTagInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitleVal(task.title); setDescVal(task.description); }, [task.id]);
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [task.comments?.length]);

  const save = (updates: Partial<Task>) => updateTask(task.id, updates);

  const saveTitle = () => {
    if (titleVal.trim() && titleVal !== task.title) save({ title: titleVal.trim() });
    setEditingTitle(false);
  };
  const saveDesc = () => {
    if (descVal !== task.description) save({ description: descVal });
    setEditingDesc(false);
  };

  const toggleAssignee = (uid: string) => {
    const next = task.assignedTo?.includes(uid)
      ? task.assignedTo.filter(u => u !== uid)
      : [...(task.assignedTo || []), uid];
    save({ assignedTo: next });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !task.tags?.includes(t)) save({ tags: [...(task.tags || []), t] });
    setTagInput('');
  };

  const sendComment = async () => {
    if (!commentInput.trim()) return;
    setSendingComment(true);
    try { await addTaskComment(task.id, commentInput.trim()); setCommentInput(''); }
    finally { setSendingComment(false); }
  };

  return (
    <motion.aside
      initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="w-96 flex-shrink-0 bg-void-light border-l border-white/5 flex flex-col overflow-hidden h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
        <span className="text-white/25 text-xs font-mono">#{task.id.slice(-6).toUpperCase()}</span>
        <span className="ml-auto px-2 py-0.5 rounded-md text-xs font-semibold"
          style={{ background: PRIORITY_CONFIG[task.priority].color + '20', color: PRIORITY_CONFIG[task.priority].color }}>
          {PRIORITY_CONFIG[task.priority].label}
        </span>
        <button onClick={() => deleteTask(task.id).then(onClose)} className="text-white/20 hover:text-red-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Title */}
        {editingTitle
          ? <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()}
              className="w-full bg-void-lighter border border-neon-cyan/40 rounded-xl px-3 py-2 text-white font-bold text-base outline-none selectable" />
          : <h2 onClick={() => setEditingTitle(true)}
              className="text-white font-bold text-base cursor-text hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
              {task.title}
            </h2>
        }

        {/* Status buttons */}
        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map(s => (
            <button key={s} onClick={() => save({ status: s })}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={task.status === s
                ? { background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, boxShadow: `0 0 0 1px ${STATUS_CONFIG[s].color}40` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }
              }>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Description */}
        <div>
          <p className="text-white/30 text-xs mb-1.5">Description</p>
          {editingDesc
            ? <textarea autoFocus value={descVal} onChange={e => setDescVal(e.target.value)}
                onBlur={saveDesc} rows={4}
                className="w-full bg-void-lighter border border-neon-cyan/40 rounded-xl px-3 py-2 text-white text-sm outline-none selectable resize-none" />
            : <p onClick={() => setEditingDesc(true)}
                className={`text-sm cursor-text hover:bg-white/5 rounded-xl px-3 py-2 -mx-3 transition-colors leading-relaxed ${task.description ? 'text-white/70' : 'text-white/20 italic'}`}>
                {task.description || 'Click to add a description...'}
              </p>
          }
        </div>

        {/* Priority + Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/30 text-xs mb-1.5">Priority</p>
            <select value={task.priority} onChange={e => save({ priority: e.target.value as TaskPriority })}
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-white/30 text-xs mb-1.5">Category</p>
            <select value={task.category} onChange={e => save({ category: e.target.value as TaskCategory })}
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none">
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="text-white/30 text-xs mb-1.5">Due Date</p>
          <input type="date" style={{ colorScheme: 'dark' }}
            value={task.dueDate ? format((task.dueDate as any).toDate?.() ?? new Date(task.dueDate as any), 'yyyy-MM-dd') : ''}
            onChange={e => save({ dueDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) as any : undefined })}
            className="w-full bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-neon-cyan/40" />
        </div>

        {/* Assignees */}
        <div>
          <p className="text-white/30 text-xs mb-2">Assigned To</p>
          <div className="flex flex-wrap gap-2">
            {staff.map(s => (
              <button key={s.uid} onClick={() => toggleAssignee(s.uid)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                  task.assignedTo?.includes(s.uid)
                    ? 'bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan'
                    : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/20'
                }`}>
                <StaffAvatar member={s} size="xs" />
                {s.displayName.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-white/30 text-xs mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(task.tags || []).map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs">
                {t}
                <button onClick={() => save({ tags: task.tags.filter(x => x !== t) })} className="text-white/30 hover:text-red-400">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-void-lighter border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-neon-cyan/40 selectable"
              placeholder="Add tag... (Enter)"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
            />
            <button onClick={addTag} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white text-xs transition-colors">+</button>
          </div>
        </div>

        {/* Linked file */}
        {task.filePath && (
          <button onClick={() => openFile(`z:/Novaura platform/NovAura-WebOS/platform/${task.filePath}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-void-lighter border border-white/10 text-neon-cyan/70 text-xs hover:border-neon-cyan/30 transition-all w-full text-left">
            <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-mono truncate">{task.filePath}</span>
          </button>
        )}

        {/* Comments */}
        <div>
          <p className="text-white/30 text-xs mb-2">Comments ({task.comments?.length || 0})</p>
          <div className="space-y-2 max-h-52 overflow-y-auto mb-3">
            {(task.comments || []).map(c => (
              <div key={c.id} className="glass rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/60 text-xs font-semibold">{c.displayName}</span>
                  <span className="text-white/20 text-[10px] ml-auto">
                    {c.createdAt?.toDate ? format(c.createdAt.toDate(), 'MMM d, h:mm a') : ''}
                  </span>
                </div>
                <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {(!task.comments?.length) && (
              <p className="text-white/20 text-xs text-center py-6">No comments yet</p>
            )}
            <div ref={commentsEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-neon-cyan/40 selectable"
              placeholder="Add a comment... (Enter)"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
            />
            <button onClick={sendComment} disabled={sendingComment || !commentInput.trim()}
              className="px-3 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-xl hover:bg-neon-cyan/20 transition-all disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

// ── Main Board ───────────────────────────────────────────────────────

export default function TaskBoard() {
  const { user } = useAppStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => {
    const u1 = subscribeTasks(setTasks);
    const u2 = subscribeStaff(setStaff);
    return () => { u1(); u2(); };
  }, []);

  // Keep detail panel in sync with live task updates
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
      else setSelectedTask(null);
    }
  }, [tasks]);

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAssignee && !t.assignedTo?.includes(filterAssignee)) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const columnTasks = (status: TaskStatus) => filtered.filter(t => t.status === status);
  const staffMap = Object.fromEntries(staff.map(s => [s.uid, s]));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-black text-white">Task Board</h1>

        <div className="flex items-center gap-2 ml-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 bg-void-lighter border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-0 max-w-xs">
            <Search className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <input
              className="bg-transparent text-white text-sm outline-none flex-1 min-w-0 selectable"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')} className="text-white/30 hover:text-white flex-shrink-0"><X className="w-3 h-3" /></button>}
          </div>

          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className="bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
            <option value="">All assignees</option>
            {staff.map(s => <option key={s.uid} value={s.uid}>{s.displayName.split(' ')[0]}</option>)}
          </select>

          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-semibold hover:bg-neon-cyan/20 transition-all flex-shrink-0">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Board + detail panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full flex gap-3 p-4 min-w-max">
            {COLUMNS.map(status => {
              const cfg = STATUS_CONFIG[status];
              const col = columnTasks(status);
              return (
                <div key={status} className="w-72 flex flex-col gap-2 h-full">
                  <div className="flex items-center gap-2 px-1 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">{cfg.label}</span>
                    <span className="ml-auto text-white/30 text-xs font-bold">{col.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    <AnimatePresence>
                      {col.map(task => {
                        const assignedMembers = (task.assignedTo || []).map(uid => staffMap[uid]).filter(Boolean);
                        const isSelected = selectedTask?.id === task.id;
                        return (
                          <motion.div
                            key={task.id} layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={() => setSelectedTask(isSelected ? null : task)}
                            className={`glass rounded-xl p-3 border transition-all cursor-pointer group ${
                              isSelected
                                ? 'border-neon-cyan/30 shadow-[0_0_16px_rgba(0,240,255,0.08)]'
                                : 'border-white/5 hover:border-white/10'
                            }`}
                            style={{ borderLeftColor: PRIORITY_CONFIG[task.priority].color, borderLeftWidth: 2 }}
                          >
                            <p className="text-white text-sm font-medium leading-snug mb-2">{task.title}</p>

                            {task.description && (
                              <p className="text-white/40 text-xs mb-2 line-clamp-2 leading-relaxed">{task.description}</p>
                            )}

                            {/* Tags */}
                            {task.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {task.tags.slice(0, 3).map(t => (
                                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40">{t}</span>
                                ))}
                                {task.tags.length > 3 && <span className="text-[10px] text-white/25">+{task.tags.length - 3}</span>}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                                style={{ background: CATEGORY_CONFIG[task.category]?.color + '20', color: CATEGORY_CONFIG[task.category]?.color }}>
                                {task.category}
                              </span>

                              {task.dueDate && <DueDateBadge ts={task.dueDate} />}

                              {task.comments?.length > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-white/30 ml-0.5">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  {task.comments.length}
                                </span>
                              )}

                              {assignedMembers.length > 0 && (
                                <div className="flex -space-x-1.5 ml-auto">
                                  {assignedMembers.slice(0, 3).map(m => <StaffAvatar key={m.uid} member={m} size="xs" />)}
                                  {assignedMembers.length > 3 && (
                                    <span className="w-5 h-5 rounded-full bg-void-lighter border border-white/10 flex items-center justify-center text-[9px] text-white/40 font-bold">
                                      +{assignedMembers.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedTask && (
            <DetailPanel
              task={selectedTask}
              staff={staff}
              onClose={() => setSelectedTask(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <CreateModal
            staff={staff}
            currentUid={user?.uid}
            onClose={() => setCreating(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
