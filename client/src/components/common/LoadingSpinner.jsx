export default function LoadingSpinner({ label = 'Loading…', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span>{label}</span>
    </span>
  );
}
