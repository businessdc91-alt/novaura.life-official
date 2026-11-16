import React from 'react';

export function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-void-light border border-white/5 rounded-xl p-6">
      <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="font-heading text-3xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

export function RoleCard({ 
  icon: Icon, 
  title, 
  description, 
  color, 
  bgColor,
  count 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  color: string; 
  bgColor: string;
  count: number;
}) {
  return (
    <div className="bg-void border border-white/10 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="font-medium text-text-primary">{title}</p>
      <p className="text-text-muted text-sm">{description}</p>
      <p className={`font-heading text-2xl font-bold ${color} mt-2`}>{count}</p>
    </div>
  );
}
