"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { globalSearchAction } from "@/lib/actions/search";
import {
  categoryLabel,
  matchLocalCommands,
  type SearchResult,
  type SearchResultCategory,
} from "@/lib/search/types";
import { inputClassName } from "@/components/forms/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: "modal" | "sheet";
};

function groupResults(results: SearchResult[]) {
  const groups = new Map<SearchResultCategory, SearchResult[]>();
  for (const result of results) {
    const list = groups.get(result.category) ?? [];
    list.push(result);
    groups.set(result.category, list);
  }
  return groups;
}

export function CommandPalette({ open, onClose, variant = "modal" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(() => matchLocalCommands(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(matchLocalCommands(""));
    setActiveIndex(0);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const requestId = ++abortRef.current;
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const response = await globalSearchAction(query);
        if (requestId !== abortRef.current) return;
        if (!response.success) {
          setError(response.error);
          return;
        }
        setError(null);
        setResults(response.results);
        setActiveIndex(0);
      });
    }, 200);

    return () => window.clearTimeout(handle);
  }, [query, open]);

  const flatResults = results;
  const grouped = useMemo(() => groupResults(flatResults), [flatResults]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(result.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          flatResults.length === 0 ? 0 : (index + 1) % flatResults.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          flatResults.length === 0
            ? 0
            : (index - 1 + flatResults.length) % flatResults.length,
        );
        return;
      }
      if (event.key === "Enter") {
        const selected = flatResults[activeIndex];
        if (selected) {
          event.preventDefault();
          selectResult(selected);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, onClose, selectResult]);

  if (!open) return null;

  const shellClass =
    variant === "sheet"
      ? "fixed inset-0 z-[80] flex flex-col bg-background"
      : "fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh]";

  const panelClass =
    variant === "sheet"
      ? "flex h-full flex-col"
      : "w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-xl";

  let runningIndex = -1;

  return (
    <div className={shellClass} role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className={`relative ${panelClass}`}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or jump to…"
            className={`${inputClassName} border-0 bg-transparent`}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            {variant === "sheet" ? "Cancel" : "Esc"}
          </button>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(60vh,28rem)] overflow-y-auto p-2"
        >
          {isPending ? (
            <p className="px-3 py-2 text-sm text-muted" role="status">
              Searching…
            </p>
          ) : null}
          {error ? (
            <p className="px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {!isPending && flatResults.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No search results.
            </p>
          ) : null}
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} className="mb-3">
              <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                {categoryLabel(category)}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const active = index === activeIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`flex w-full flex-col rounded-lg px-3 py-3 text-left transition-colors ${
                          active
                            ? "bg-accent/15 text-foreground"
                            : "text-foreground hover:bg-surface-elevated"
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectResult(item)}
                      >
                        <span className="text-sm font-medium">{item.title}</span>
                        {item.subtitle ? (
                          <span className="text-xs text-muted">{item.subtitle}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
