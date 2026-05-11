import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Activity, Cpu, HardDrive, MemoryStick, Users, CheckSquare, MessageSquare, Zap } from 'lucide-react';
import { subscribeTasks } from '../../services/taskService';
import { subscribeToPresence } from '../../services/chatService';
import type { Task } from '../../services/taskService';
import type { UserPresence } from '../../services/chatService';

interface ResourceUsage {
  cpu_percent: number; memory_used_mb: number; memory_total_mb: number;
  memory_percent: number; disk_used_gb: number; disk_total_gb: number;
  disk_percent: number; uptime_secs: number;
}

const TASK_COLORS = { todo: '#64748b', in_progress: '#00f0ff', review: '#f59e0b', done: '#22c55e', blocked: '#ff0080' };

export default function Dashboard() {
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [cpuHistory, setCpuHistory] = useState<{ t: string; cpu: number; mem: number }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await invoke<ResourceUsage>('get_resource_usage');
        setResources(r);
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setCpuHistory(h => [...h.slice(-29), { t, cpu: r.cpu_percent, mem: r.memory_percent }]);
      } catch {}
    }, 2000);
    const unsubTasks = subscribeTasks(setTasks);
    const unsubPresence = subscribeToPresence(setOnlineUsers);
    return () => { clearInterval(poll); unsubTasks(); unsubPresence(); };
  }, []);

  const taskByStatus = Object.entries(TASK_COLORS).map(([status, color]) => ({
    name: status.replace('_', ' '),
    value: tasks.filter(t => t.status === status).length,
    color,
  }));

  const taskByPriority = ['critical', 'high', 'medium', 'low'].map(p => ({
    name: p,
    count: tasks.filter(t => t.priority === p).length,
  }));

  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-white/40 text-xs">{label}</p>
        <p className="text-white font-bold text-lg leading-tight">{value}</p>
        {sub && <p className="text-white/30 text-xs">{sub}</p>}
      </div>
    </motion.div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Dashboard</h1>
        <span className="text-white/30 text-xs">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Cpu} label="CPU Usage" color="#00f0ff"
          value={resources ? `${resources.cpu_percent.toFixed(1)}%` : '—'} />
        <StatCard icon={MemoryStick} label="Memory" color="#8b5cf6"
          value={resources ? `${resources.memory_percent.toFixed(0)}%` : '—'}
          sub={resources ? `${resources.memory_used_mb.toLocaleString()} / ${resources.memory_total_mb.toLocaleString()} MB` : ''} />
        <StatCard icon={HardDrive} label="Disk" color="#f59e0b"
          value={resources ? `${resources.disk_percent.toFixed(0)}%` : '—'}
          sub={resources ? `${resources.disk_used_gb.toFixed(1)} / ${resources.disk_total_gb.toFixed(1)} GB` : ''} />
        <StatCard icon={Users} label="Online Now" color="#22c55e"
          value={onlineUsers.length}
          sub={onlineUsers.map(u => u.displayName.split(' ')[0]).join(', ') || 'No one online'} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={CheckSquare} label="Active Tasks"
          value={tasks.filter(t => t.status !== 'done').length} color="#ff0080"
          sub={`${tasks.filter(t => t.status === 'blocked').length} blocked`} />
        <StatCard icon={Zap} label="Done This Sprint"
          value={tasks.filter(t => t.status === 'done').length} color="#ccff00" />
        <StatCard icon={Activity} label="In Review"
          value={tasks.filter(t => t.status === 'review').length} color="#f97316" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* CPU / Memory history */}
        <div className="glass rounded-xl p-4">
          <p className="text-white/50 text-xs font-semibold mb-3 uppercase tracking-wider">System Resources (live)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cpuHistory}>
              <defs>
                <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="cpu" stroke="#00f0ff" fill="url(#cpu)" name="CPU %" dot={false} strokeWidth={1.5} />
              <Area type="monotone" dataKey="mem" stroke="#8b5cf6" fill="url(#mem)" name="Mem %" dot={false} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Task breakdown */}
        <div className="glass rounded-xl p-4">
          <p className="text-white/50 text-xs font-semibold mb-3 uppercase tracking-wider">Task Status</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={taskByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {taskByStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 text-xs">
              {taskByStatus.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-white/50 capitalize">{s.name}</span>
                  <span className="text-white font-bold ml-auto pl-4">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Priority bar chart */}
      <div className="glass rounded-xl p-4">
        <p className="text-white/50 text-xs font-semibold mb-3 uppercase tracking-wider">Tasks by Priority</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={taskByPriority} layout="vertical">
            <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickLine={false} width={55} />
            <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="count" fill="#00f0ff" radius={[0, 4, 4, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
