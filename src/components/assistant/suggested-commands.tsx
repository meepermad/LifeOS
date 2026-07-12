const SUGGESTED_COMMANDS = [
  "What do I have today?",
  "Show my workload this week",
  "Find 90 minutes before Thursday",
  "Plan today",
  "help",
];

type SuggestedCommandsProps = {
  onSelect: (command: string) => void;
  disabled?: boolean;
};

export function SuggestedCommands({
  onSelect,
  disabled,
}: SuggestedCommandsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTED_COMMANDS.map((command) => (
        <button
          key={command}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(command)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {command}
        </button>
      ))}
    </div>
  );
}
