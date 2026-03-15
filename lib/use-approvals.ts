"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApprovalRecord, ApprovalStatus } from "@/lib/approval-engine";

type ListResponse = {
  ok: boolean;
  pending_count?: number;
  approvals?: ApprovalRecord[];
};

type DetailResponse = {
  ok: boolean;
  approval?: ApprovalRecord;
};

export function useApprovals(filter?: ApprovalStatus, pollIntervalMs = 5000): {
  approvals: ApprovalRecord[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
} {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (!filter) {
      return "/api/approvals";
    }
    return `/api/approvals?status=${filter}`;
  }, [filter]);

  useEffect(() => {
    let cancelled = false;

    const fetchApprovals = async () => {
      try {
        const response = await fetch(endpoint);
        const data = (await response.json()) as ListResponse;
        if (!response.ok || !data.ok) {
          throw new Error("Failed to load approvals");
        }
        if (!cancelled) {
          setApprovals(data.approvals ?? []);
          setPendingCount(data.pending_count ?? 0);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load approvals";
          setError(message);
          setApprovals([]);
          setPendingCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchApprovals();
    const timer = window.setInterval(() => {
      void fetchApprovals();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [endpoint, pollIntervalMs]);

  return { approvals, pendingCount, isLoading, error };
}

export function useApproval(id: string, pollIntervalMs = 5000): {
  approval: ApprovalRecord | null;
  isLoading: boolean;
  error: string | null;
} {
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setApproval(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchApproval = async () => {
      try {
        const response = await fetch(`/api/approvals/${encodeURIComponent(id)}`);
        const data = (await response.json()) as DetailResponse;
        if (!response.ok || !data.ok) {
          throw new Error("Failed to load approval");
        }
        if (!cancelled) {
          setApproval(data.approval ?? null);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load approval";
          setError(message);
          setApproval(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchApproval();
    const timer = window.setInterval(() => {
      void fetchApproval();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, pollIntervalMs]);

  return { approval, isLoading, error };
}
