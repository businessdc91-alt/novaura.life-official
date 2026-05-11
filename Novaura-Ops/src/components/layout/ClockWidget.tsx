import { useEffect, useState } from 'react';
import { Timer, LogOut as ClockOut, LogIn as ClockIn } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { clockIn, clockOut, subscribeMyClockStatus, fmtMinutes } from '../../services/timeService';

export default function ClockWidget() {
  const [isClocked, setIsClocked] = useState(false);
  const [sessionStart, setSessionStart] = useState<Timestamp | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeMyClockStatus((clocked, start) => {
      setIsClocked(clocked);
      setSessionStart(start);
    });
    return unsub;
  }, []);

  // Live elapsed timer
  useEffect(() => {
    if (!isClocked || !sessionStart) { setElapsed(0); return; }
    const update = () => {
      setElapsed(Math.floor((Date.now() - sessionStart.toMillis()) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isClocked, sessionStart]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isClocked) await clockOut();
      else await clockIn(false);
    } finally {
      setLoading(false);
    }
  };

  const fmtElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {isClocked && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <Timer className="w-3 h-3 text-green-400" />
          <span className="text-green-400 text-xs font-mono tabular-nums">{fmtElapsed(elapsed)}</span>
        </div>
      )}

      <button
        onClick={handleToggle}
        disabled={loading}
        title={isClocked ? 'Clock out' : 'Clock in'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
          isClocked
            ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
            : 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
        }`}
      >
        {isClocked
          ? <><ClockOut className="w-3.5 h-3.5" /> Clock Out</>
          : <><ClockIn className="w-3.5 h-3.5" /> Clock In</>
        }
      </button>
    </div>
  );
}
