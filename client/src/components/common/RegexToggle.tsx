interface RegexToggleProps {
  enabled: boolean;
  onToggle: () => void;
  invalid?: boolean;
}

export default function RegexToggle({ enabled, onToggle, invalid }: RegexToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? 'Disable regex' : 'Enable regex'}
      className={`px-2 py-1 text-xs font-mono font-bold rounded-md border transition-colors select-none ${
        enabled
          ? invalid
            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-400 dark:border-red-600'
            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-600'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      .*
    </button>
  );
}
