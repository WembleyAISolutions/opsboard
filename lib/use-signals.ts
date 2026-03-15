"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalSignalAction, SignalItem } from "@/types/signal";

type SummaryResponse = {
  today: {
    approvals_waiting: number;
    signals_needing_review: number;
    inbox_items: number;
  };
  this_week: {
    in_progress: number;
    waiting_approval: number;
    completed: number;
  };
  source_breakdown: Record<string, number>;
  counts_by_module: Record<string, number>;
};

type RefetchListener = () => void;
const refetchListeners = new Set<RefetchListener>();

function subscribe(listener: RefetchListener): () => void {
  refetchListeners.add(listener);
  return () => {
    refetchListeners.delete(listener);
  };
}

function broadcastRefetch(): void {
  refetchListeners.forEach((listener) => listener());
}

export function useSignals(module?: "inbox" | "signal" | "approvals" | "voice") {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (!module) {
      return "/api/signals/list";
    }
    return `/api/signals/list?module=${module}`;
  }, [module]);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Signals fetch failed (${response.status})`);
      }
      const data = (await response.json()) as { ok: boolean; signals: SignalItem[] };
      if (!data.ok) {
        throw new Error("Signals response not ok");
      }
      setSignals(data.signals);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Signals fetch failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setLoading(true);
    void refetch();

    const timer = window.setInterval(() => {
      void refetch();
    }, 5000);
    const unsubscribe = subscribe(() => {
      void refetch();
    });

    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [refetch]);

  return { signals, loading, error, refetch };
}

export function useSummary() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch("/api/signals/summary", { method: "GET" });
      if (!response.ok) {
        throw new Error(`Summary fetch failed (${response.status})`);
      }
      const data = (await response.json()) as { ok: boolean } & SummaryResponse;
      if (!data.ok) {
        throw new Error("Summary response not ok");
      }
      setSummary(data);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Summary fetch failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refetch();

    const timer = window.setInterval(() => {
      void refetch();
    }, 3000);
    const unsubscribe = subscribe(() => {
      void refetch();
    });

    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [refetch]);

  return { summary, loading, error, refetch };
}

export function useSignalAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(async (signal_id: string, action: LocalSignalAction) => {
    setLoading(true);
    try {
      const response = await fetch("/api/signals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal_id, action })
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? `Action failed (${response.status})`);
      }

      setError(null);
      broadcastRefetch();
      return true;
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Action request failed";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { performAction, loading, error };
}
