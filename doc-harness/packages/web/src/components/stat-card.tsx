interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon?: string;
}

export function StatCard({ label, value, trend, icon }: StatCardProps) {
  return (
    <div className="p-4 bg-surface border border-border rounded-lg hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      {trend && <span className="text-xs text-text-muted">{trend}</span>}
    </div>
  );
}
