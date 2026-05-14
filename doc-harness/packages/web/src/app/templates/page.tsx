"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  docTypes: string[];
}

const defaultTemplates: Template[] = [
  {
    id: "1",
    name: "SaaS Product Spec",
    description: "PRD + ADR + Implementation Plan for a SaaS product",
    prompt: "Build a SaaS product for [describe problem]. Include user authentication, subscription billing, and a REST API.",
    docTypes: ["prd", "adr", "plan"],
  },
  {
    id: "2",
    name: "API Documentation",
    description: "Full API spec with architecture decisions",
    prompt: "Document a REST API for [service name]. Include endpoints, authentication, error handling, and rate limiting.",
    docTypes: ["srs", "adr", "spec"],
  },
  {
    id: "3",
    name: "Mobile App",
    description: "PRD + user requirements + implementation plan for mobile",
    prompt: "Build a mobile app for [describe purpose]. Target iOS and Android. Include offline support and push notifications.",
    docTypes: ["prd", "urd", "plan"],
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("doc-harness-templates");
    setTemplates(saved ? JSON.parse(saved) : defaultTemplates);
  }, []);

  const saveTemplates = (updated: Template[]) => {
    setTemplates(updated);
    localStorage.setItem("doc-harness-templates", JSON.stringify(updated));
  };

  const addTemplate = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const t: Template = {
      id: Date.now().toString(),
      name: newName,
      description: newDesc,
      prompt: newPrompt,
      docTypes: [],
    };
    saveTemplates([...templates, t]);
    setNewName(""); setNewDesc(""); setNewPrompt("");
    setShowForm(false);
  };

  const deleteTemplate = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
  };

  const useTemplate = (t: Template) => {
    localStorage.setItem("doc-harness-active-prompt", t.prompt);
    router.push("/generate");
  };

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable prompt templates for common documentation patterns"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            {showForm ? "Cancel" : "+ New Template"}
          </button>
        }
      />

      <div className="p-6">
        {showForm && (
          <div className="mb-6 p-4 bg-surface border border-border rounded-lg space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short description"
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Prompt template..."
              rows={4}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary resize-y"
            />
            <button
              onClick={addTemplate}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Save Template
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="p-4 bg-surface border border-border rounded-lg hover:border-primary/30 transition-colors">
              <h3 className="font-semibold mb-1">{t.name}</h3>
              <p className="text-xs text-text-muted mb-3">{t.description}</p>
              <p className="text-xs text-text-muted mb-4 line-clamp-3">{t.prompt}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => useTemplate(t)}
                  className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-hover transition-colors"
                >
                  Use
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="px-3 py-1.5 border border-border text-text-muted rounded text-xs hover:border-error hover:text-error transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center text-text-muted py-12">No templates yet. Create your first one above.</div>
        )}
      </div>
    </div>
  );
}
