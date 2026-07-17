'use client';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function FollowUpSuggestions({ suggestions, onSelect }: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
        >
          <span>{suggestion}</span>
        </button>
      ))}
    </div>
  );
}
