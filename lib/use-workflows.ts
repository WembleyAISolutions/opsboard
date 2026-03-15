"use client";

import { useEffect, useState } from "react";
import type { Workflow } from "@/lib/workflow-engine";

type WorkflowsResponse = {
  ok: boolean;
  workflows?: Workflow[];
};

type WorkflowResponse = {
  ok: boolean;
  workflow?: Workflow;
  error?: string;
};

export function useWorkflows(pollIntervalMs = 5000): {
  workflows: Workflow[];
  isLoading: boolean;
  error: string | null;
} {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchWorkflows = async () => {
      try {
        const response = await fetch("/api/workflows");
        const data = (await response.json()) as WorkflowsResponse;
        if (!response.ok || !data.ok) {
          throw new Error("Failed to load workflows");
        }
        if (!cancelled) {
          setWorkflows(data.workflows ?? []);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load workflows";
          setError(message);
          setWorkflows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchWorkflows();
    const timer = window.setInterval(() => {
      void fetchWorkflows();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return { workflows, isLoading, error };
}

export function useWorkflow(id: string, pollIntervalMs = 5000): {
  workflow: Workflow | null;
  isLoading: boolean;
  error: string | null;
} {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setWorkflow(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`);
        const data = (await response.json()) as WorkflowResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Failed to load workflow");
        }
        if (!cancelled) {
          setWorkflow(data.workflow ?? null);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load workflow";
          setError(message);
          setWorkflow(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchWorkflow();
    const timer = window.setInterval(() => {
      void fetchWorkflow();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, pollIntervalMs]);

  return { workflow, isLoading, error };
}
