interface StatusBadgeProps {
  status: "running" | "completed" | "failed";
}

const styles = {
  running: "bg-yellow-950 text-warning border-yellow-900",
  completed: "bg-green-950 text-success border-green-900",
  failed: "bg-red-950 text-error border-red-900",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${styles[status]}`}>
      {status}
    </span>
  );
}
