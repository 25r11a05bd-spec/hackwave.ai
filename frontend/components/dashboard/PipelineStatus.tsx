'use client';

import React, { useState } from 'react';
import {
  ScanSearch,
  GitBranch,
  Database,
  ListOrdered,
  Cpu,
  ShieldCheck,
  BadgeCheck,
  Gauge,
  GitPullRequest,
  Check,
  Loader2,
  Clock,
  XCircle,
  Radio,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import ModelBadge from '@/components/ui/ModelBadge';

// ─────────────────────────────────────────────────────────────────────────
// The 9 macro-stages of PatchLine's autonomous remediation loop (see
// theme.md "AI Analysis Pipeline" + patchline master doc §2/§38 state
// machine). This is deliberately the REAL pipeline, not the old fake
// "sandbox verification" progress bar — no sandbox stage exists in
// PatchLine's architecture, and this component never invents a status
// for a step it has no live telemetry for.
// ─────────────────────────────────────────────────────────────────────────

export type StepStatus = 'completed' | 'running' | 'waiting' | 'failed';

export interface PipelineStepTelemetry {
  id: string;
  status: StepStatus;
  /** Populated only for AI-routed steps (model_router.py: analysis/fix/verify). */
  model?: string | null;
  provider?: string | null;
  /** How many findings are currently sitting at this stage, across all repos. */
  count?: number;
}

interface StageDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  engine: string;
  /** Which routed AI task (model_router.py) powers this stage, if any. */
  modelTask?: 'analysis' | 'fix' | 'verify';
}

const STAGES: StageDef[] = [
  { id: 'scan', label: 'Deterministic Scan', shortLabel: 'Scan', icon: ScanSearch, engine: 'Semgrep + Tree-sitter + ESLint' },
  { id: 'root_cause', label: 'Root-Cause Analysis', shortLabel: 'Root Cause', icon: Cpu, engine: 'GPT-4.1-mini reasoning', modelTask: 'analysis' },
  { id: 'rag_retrieval', label: 'RAG Fix Retrieval', shortLabel: 'RAG', icon: Database, engine: 'ChromaDB vector memory' },
  { id: 'rank_top3', label: 'Rank Top 3 & Select', shortLabel: 'Rank', icon: ListOrdered, engine: 'Risk-aware scoring engine' },
  { id: 'fix_generation', label: 'Fix Generation', shortLabel: 'Fix Gen', icon: GitBranch, engine: 'GPT-5.2 patch synthesis', modelTask: 'fix' },
  { id: 'deterministic_rescan', label: 'Deterministic Rescan', shortLabel: 'Rescan', icon: ShieldCheck, engine: 'Same scanner, re-run' },
  { id: 'codex_review', label: 'Codex Independent Review', shortLabel: 'Codex', icon: BadgeCheck, engine: 'GPT-5.3 Codex verification', modelTask: 'verify' },
  { id: 'risk_recalc', label: 'Risk Recalculation', shortLabel: 'Risk', icon: Gauge, engine: 'Deterministic Risk Engine' },
  { id: 'pr_created', label: 'GitHub Pull Request', shortLabel: 'PR', icon: GitPullRequest, engine: 'GitHub REST API' },
];

const STATUS_META: Record<StepStatus, { label: string; dot: string }> = {
  completed: { label: 'Completed', dot: 'bg-accent-emerald' },
  running: { label: 'Running', dot: 'bg-accent-cyan' },
  waiting: { label: 'Waiting', dot: 'bg-text-muted' },
  failed: { label: 'Failed — excluded, next candidate queued', dot: 'bg-accent-rose' },
};

interface PipelineStatusProps {
  /** Live per-stage telemetry from Elastic (main-service aggregates
   *  scan_history + fixes into this shape). Absent/empty means no live
   *  telemetry is wired up yet — the stage track still renders so the
   *  pipeline itself is documented, it just shows every stage idle
   *  rather than fabricating progress. */
  steps?: PipelineStepTelemetry[];
  isElasticActive?: boolean;
}

export default function PipelineStatus({ steps, isElasticActive }: PipelineStatusProps) {
  const telemetryById = new Map((steps || []).map((s) => [s.id, s]));
  const hasLiveData = telemetryById.size > 0;

  const [selectedId, setSelectedId] = useState<string>(STAGES[0].id);
  const selected = STAGES.find((s) => s.id === selectedId) || STAGES[0];
  const selectedTelemetry = telemetryById.get(selected.id);

  const completedCount = STAGES.filter((s) => telemetryById.get(s.id)?.status === 'completed').length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
              Remediation Pipeline
            </h2>
            {isElasticActive && hasLiveData ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border-active)' }}>
                <Radio size={9} /> LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-text-muted">
                No live telemetry yet
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted-2)' }}>
            9-stage detect → reason → fix → verify → ship loop, across all connected repos
          </p>
        </div>
        {hasLiveData && (
          <div className="text-right shrink-0">
            <div className="text-[11px] font-mono text-text-muted uppercase">Stages Cleared</div>
            <div className="font-display text-lg font-bold text-accent-cyan tabular-nums">
              {completedCount} / {STAGES.length}
            </div>
          </div>
        )}
      </div>

      {/* Stage track */}
      <div className="relative mb-5">
        <div className="hidden lg:block absolute top-5 left-5 right-5 h-0.5 bg-border-default -z-0" />
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 relative z-10">
          {STAGES.map((stage) => {
            const telemetry = telemetryById.get(stage.id);
            const status = telemetry?.status;
            const isSelected = stage.id === selectedId;
            const Icon = stage.icon;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedId(stage.id)}
                className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'border-accent-cyan bg-accent-cyan-soft/20'
                    : 'border-border-default bg-bg-subtle/40 hover:border-border-hover'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
                    status === 'completed'
                      ? 'bg-accent-emerald text-white'
                      : status === 'running'
                        ? 'bg-accent-cyan text-white'
                        : status === 'failed'
                          ? 'bg-accent-rose text-white'
                          : 'bg-bg-subtle border border-border-default text-text-muted'
                  }`}
                >
                  {status === 'completed' ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : status === 'running' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : status === 'failed' ? (
                    <XCircle size={14} />
                  ) : (
                    <Icon size={14} />
                  )}
                </div>
                <span className="font-display text-[10px] font-semibold text-text-primary leading-tight truncate w-full">
                  {stage.shortLabel}
                </span>
                {telemetry?.count != null && telemetry.count > 0 && (
                  <span className="text-[9px] font-mono text-text-muted mt-0.5">{telemetry.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected stage detail */}
      <div className="rounded-xl border border-border-default bg-bg-subtle/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <selected.icon size={14} className="text-accent-cyan" />
            <span className="font-display text-xs font-semibold text-text-primary">{selected.label}</span>
            <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-bg-card border border-border-default">
              {selected.engine}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {selectedTelemetry?.status && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-secondary">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[selectedTelemetry.status].dot} ${selectedTelemetry.status === 'running' ? 'pulse-dot' : ''}`} />
                {STATUS_META[selectedTelemetry.status].label}
              </span>
            )}
            {selected.modelTask && selectedTelemetry?.model && (
              <ModelBadge
                model={selectedTelemetry.model}
                provider={selectedTelemetry.provider}
                task={selected.modelTask === 'analysis' ? 'GPT-4.1-mini' : selected.modelTask === 'fix' ? 'GPT-5.2' : 'Codex'}
                size="xs"
              />
            )}
          </div>
        </div>

        {!selectedTelemetry && (
          <p className="text-[11px] text-text-muted mt-2 flex items-center gap-1.5">
            <Clock size={11} />
            Waiting on live Elastic telemetry for this stage — run a scan to populate it.
          </p>
        )}
      </div>
    </Card>
  );
}
