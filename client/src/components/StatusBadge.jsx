const severityStyles = {
  Critical: 'bg-[#f7e5de] text-[#a8432e] border-[#efcdbf]',
  High: 'bg-[#faeadb] text-[#b86018] border-[#f0d2b2]',
  Moderate: 'bg-[#f7efd8] text-[#8f6f13] border-[#ecdfae]',
  Low: 'bg-[#e3edee] text-[#2c6a77] border-[#c6dcdd]',
};

const statusStyles = {
  Submitted: 'bg-[#e7ece6] text-[#4c5a4c] border-[#cfd8cc]',
  Pending: 'bg-[#f1eee4] text-[#6f6a55] border-[#e0dac4]',
  'Under Review': 'bg-[#f7efd8] text-[#8f6f13] border-[#ecdfae]',
  'In Review': 'bg-[#f7efd8] text-[#8f6f13] border-[#ecdfae]',
  Verified: 'bg-[#e3eee2] text-[#3e6a3c] border-[#c5dcc3]',
  Resolved: 'bg-[#e2efe4] text-[#3c7049] border-[#c2dcc8]',
  Rejected: 'bg-[#f7e5de] text-[#a8432e] border-[#efcdbf]',
};

const dots = {
  Critical: 'bg-status-critical',
  High: 'bg-status-high',
  Moderate: 'bg-status-moderate',
  Low: 'bg-status-low',
  Submitted: 'bg-[#8aa08a]',
  Pending: 'bg-[#9b957f]',
  'Under Review': 'bg-status-moderate',
  'In Review': 'bg-status-moderate',
  Verified: 'bg-status-resolved',
  Resolved: 'bg-status-resolved',
  Rejected: 'bg-status-critical',
};

export default function StatusBadge({ status, type = 'status', dot = true, pulse = false, className = '' }) {
  const map = type === 'severity' ? severityStyles : statusStyles;
  const style = map[status] || 'bg-[#f0f0eb] text-[#63665f] border-[#ddddd4]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${style} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || 'bg-[#9aa493]'} ${pulse ? 'animate-pulse-soft' : ''}`} />
      )}
      {status}
    </span>
  );
}
