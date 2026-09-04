'use client';

import React from 'react';
import { Zap, ArrowRightLeft, HelpCircle } from 'lucide-react';

/**
 * Shows which model actually answered a routed AI call
 * (app/services/model_router.py: Featherless primary -> GPT fallback).
 *
 * Backend contract (see FixResponse / codexReview / dashboard aiFixEngine):
 *   provider === "featherless"        -> Featherless answered. Primary badge.
 *   provider is any other string      -> Featherless was disabled/unreachable
 *                                         for this call; a fallback provider
 *                                         (e.g. "openai") answered instead.
 *                                         Shown as a distinct "Fallback" badge
 *                                         with the actual GPT model name.
 *   provider is null/undefined        -> older record with no attribution
 *                                         captured, or model info unknown.
 *                                         Shown as a neutral "model unknown"
 *                                         badge rather than guessing.
 *
 * Never infer Featherless from the model string alone — always trust the
 * `provider` field the router actually recorded.
 */

export type ModelAttribution = {
  provider?: string | null;
  model?: string | null;
};

interface ModelBadgeProps extends ModelAttribution {
  /** Optional label prefix, e.g. "Fix" or "Codex" — kept short. */
  task?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export default function ModelBadge({ provider, model, task, size = 'sm', className = '' }: ModelBadgeProps) {
  const isFeatherless = provider === 'featherless';
  const isFallback = Boolean(provider) && !isFeatherless;
  const isUnknown = !provider;

  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'xs' ? 10 : 12;

  if (isUnknown) {
    return (
      <span
        className={`pl-badge pl-badge-neutral ${textSize} ${className}`}
        title="No model-attribution data recorded for this call"
      >
        <HelpCircle size={iconSize} />
        {task ? `${task} · ` : ''}{model || 'Model unknown'}
      </span>
    );
  }

  if (isFeatherless) {
    return (
      <span
        className={`pl-badge ${textSize} ${className}`}
        style={{
          background: 'var(--primary-soft)',
          borderColor: 'var(--border-active)',
          color: 'var(--primary)',
        }}
        title="Answered by Featherless (primary provider)"
      >
        <Zap size={iconSize} />
        {task ? `${task} · ` : ''}Featherless{model ? ` — ${model}` : ''}
      </span>
    );
  }

  // Fallback: Featherless was disabled or failed for this call — the
  // caller-supplied fallback provider (OpenAI/Azure) answered instead.
  return (
    <span
      className={`pl-badge pl-badge-high ${textSize} ${className}`}
      title="Featherless did not answer this call — a fallback provider was used"
    >
      <ArrowRightLeft size={iconSize} />
      {task ? `${task} · ` : ''}Fallback{model ? ` — ${model}` : ''}
    </span>
  );
}
