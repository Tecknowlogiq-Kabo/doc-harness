"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Settings" description="Configure your documentation pipeline" />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Model Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Default Model</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary">
                  <option>claude-sonnet-4-5</option>
                  <option>claude-opus-4-5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">API Key</label>
                <input
                  type="password"
                  defaultValue="••••••••••••••••"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">Set via ANTHROPIC_API_KEY environment variable</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Pipeline Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Output Directory</label>
                <input
                  type="text"
                  defaultValue="./docs"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Debate Rounds</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary">
                  <option>3 (default)</option>
                  <option>2</option>
                  <option>4</option>
                  <option>5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Score Threshold</label>
                <input
                  type="number"
                  defaultValue="0.7"
                  step="0.05"
                  min="0"
                  max="1"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              saved
                ? "bg-green-950 text-success border border-green-900"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {saved ? "✓ Saved" : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
