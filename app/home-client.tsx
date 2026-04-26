"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Kid = {
  id: number;
  name: string;
  emoji: string | null;
  created_at: string;
};

type Deal = {
  id: number;
  kid_id: number;
  title: string;
  kid_promises: string | null;
  parent_promises: string | null;
  follow_up_date: string | null;
  status: "open" | "fulfilled" | "broken";
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

type State = { kids: Kid[]; deals: Deal[] };

type Filter = "all" | "open" | "fulfilled" | "broken";

const EMOJI_CHOICES = ["", "👦", "👧", "🧒", "🦄", "🚀", "🐱", "🐶", "⭐", "🎮", "🎨", "⚽"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function formatRel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export default function HomeClient() {
  const [state, setState] = useState<State>({ kids: [], deals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeKidId, setActiveKidId] = useState<number | "all">("all");
  const [filter, setFilter] = useState<Filter>("open");

  const [showKidModal, setShowKidModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as State;
      setState(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleDeals = useMemo(() => {
    return state.deals.filter((d) => {
      if (activeKidId !== "all" && d.kid_id !== activeKidId) return false;
      if (filter === "all") return true;
      return d.status === filter;
    });
  }, [state.deals, activeKidId, filter]);

  const openCountByKid = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of state.deals) {
      if (d.status === "open") m.set(d.kid_id, (m.get(d.kid_id) ?? 0) + 1);
    }
    return m;
  }, [state.deals]);

  const totalOpen = state.deals.filter((d) => d.status === "open").length;
  const dueToday = state.deals.filter(
    (d) => d.status === "open" && d.follow_up_date && daysUntil(d.follow_up_date) === 0
  ).length;
  const overdue = state.deals.filter(
    (d) => d.status === "open" && d.follow_up_date && (daysUntil(d.follow_up_date) ?? 0) < 0
  ).length;

  const onAddKid = async (name: string, emoji: string) => {
    const res = await fetch("/api/kids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji: emoji || null }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to save kid");
    }
    await refresh();
  };

  const onDeleteKid = async (id: number) => {
    if (!confirm("Delete this kid and all their deals?")) return;
    await fetch(`/api/kids/${id}`, { method: "DELETE" });
    if (activeKidId === id) setActiveKidId("all");
    await refresh();
  };

  const onSaveDeal = async (deal: Partial<Deal> & { kid_id: number; title: string }) => {
    if (editingDeal) {
      const res = await fetch(`/api/deals/${editingDeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deal),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed");
      }
    } else {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deal),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed");
      }
    }
    await refresh();
  };

  const setStatus = async (id: number, status: Deal["status"]) => {
    setState((s) => ({
      ...s,
      deals: s.deals.map((d) =>
        d.id === id ? { ...d, status, resolved_at: status === "open" ? null : new Date().toISOString() } : d
      ),
    }));
    await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  };

  const onDeleteDeal = async (id: number) => {
    if (!confirm("Delete this deal?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    await refresh();
  };

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              <span className="text-violet-400">Kid</span> Negotiation Tracker
            </h1>
            <p className="text-xs text-white/50">Promises kept, deals tracked, follow-through wins.</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <section className="grid grid-cols-3 gap-2 mb-5">
          <Stat label="Open" value={totalOpen} accent="violet" />
          <Stat label="Due today" value={dueToday} accent={dueToday > 0 ? "amber" : "slate"} />
          <Stat label="Overdue" value={overdue} accent={overdue > 0 ? "red" : "slate"} />
        </section>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Kids</h2>
            <button
              onClick={() => setShowKidModal(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 transition"
            >
              + Add kid
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button
              onClick={() => setActiveKidId("all")}
              className={`shrink-0 px-3 py-2 rounded-xl border text-sm transition ${
                activeKidId === "all"
                  ? "bg-violet-500/20 border-violet-400/50 text-violet-100"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              All ({state.deals.length})
            </button>
            {state.kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setActiveKidId(k.id)}
                onDoubleClick={() => onDeleteKid(k.id)}
                className={`shrink-0 px-3 py-2 rounded-xl border text-sm transition flex items-center gap-2 ${
                  activeKidId === k.id
                    ? "bg-violet-500/20 border-violet-400/50 text-violet-100"
                    : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                }`}
                title="Double-tap to remove"
              >
                {k.emoji && <span>{k.emoji}</span>}
                <span>{k.name}</span>
                {(openCountByKid.get(k.id) ?? 0) > 0 && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-100">
                    {openCountByKid.get(k.id)}
                  </span>
                )}
              </button>
            ))}
            {state.kids.length === 0 && (
              <p className="text-sm text-white/40 italic py-2">Add a kid to get started.</p>
            )}
          </div>
        </section>

        <section className="mb-3">
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {(["open", "all", "fulfilled", "broken"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-sm py-2 rounded-lg transition capitalize ${
                  filter === f ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <SkeletonList />
          ) : visibleDeals.length === 0 ? (
            <EmptyState onAdd={() => setShowDealModal(true)} hasKids={state.kids.length > 0} />
          ) : (
            visibleDeals.map((d) => {
              const kid = state.kids.find((k) => k.id === d.kid_id);
              return (
                <DealCard
                  key={d.id}
                  deal={d}
                  kidName={kid ? `${kid.emoji ?? ""} ${kid.name}`.trim() : "?"}
                  onEdit={() => {
                    setEditingDeal(d);
                    setShowDealModal(true);
                  }}
                  onSetStatus={(s) => setStatus(d.id, s)}
                  onDelete={() => onDeleteDeal(d.id)}
                />
              );
            })
          )}
        </section>
      </main>

      <button
        onClick={() => {
          setEditingDeal(null);
          setShowDealModal(true);
        }}
        disabled={state.kids.length === 0}
        className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-violet-500 hover:bg-violet-400 active:bg-violet-600 disabled:bg-white/10 disabled:text-white/30 text-white text-3xl leading-none shadow-lg shadow-violet-500/30 disabled:shadow-none flex items-center justify-center transition"
        aria-label="Add deal"
      >
        +
      </button>

      {showKidModal && (
        <KidModal
          onClose={() => setShowKidModal(false)}
          onSave={async (n, e) => {
            await onAddKid(n, e);
            setShowKidModal(false);
          }}
        />
      )}

      {showDealModal && (
        <DealModal
          kids={state.kids}
          deal={editingDeal}
          defaultKidId={activeKidId === "all" ? state.kids[0]?.id : activeKidId}
          onClose={() => {
            setShowDealModal(false);
            setEditingDeal(null);
          }}
          onSave={async (d) => {
            await onSaveDeal(d);
            setShowDealModal(false);
            setEditingDeal(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "violet" | "amber" | "red" | "slate";
}) {
  const tone = {
    violet: "text-violet-300 border-violet-400/30 bg-violet-500/10",
    amber: "text-amber-200 border-amber-400/30 bg-amber-500/10",
    red: "text-red-200 border-red-400/30 bg-red-500/10",
    slate: "text-white/70 border-white/10 bg-white/5",
  }[accent];
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
          <div className="h-4 w-1/2 bg-white/10 rounded mb-2"></div>
          <div className="h-3 w-3/4 bg-white/10 rounded"></div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ onAdd, hasKids }: { onAdd: () => void; hasKids: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <div className="text-4xl mb-2">🤝</div>
      <h3 className="text-base font-medium mb-1">No deals yet</h3>
      <p className="text-sm text-white/50 mb-4">
        {hasKids ? "Tap + to log your first deal." : "Add a kid first, then log a deal."}
      </p>
      {hasKids && (
        <button
          onClick={onAdd}
          className="text-sm px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 transition"
        >
          New deal
        </button>
      )}
    </div>
  );
}

function DealCard({
  deal,
  kidName,
  onEdit,
  onSetStatus,
  onDelete,
}: {
  deal: Deal;
  kidName: string;
  onEdit: () => void;
  onSetStatus: (s: Deal["status"]) => void;
  onDelete: () => void;
}) {
  const days = daysUntil(deal.follow_up_date);
  const isOverdue = deal.status === "open" && days !== null && days < 0;
  const isDueToday = deal.status === "open" && days === 0;

  const badge =
    deal.status === "fulfilled"
      ? { text: "Fulfilled", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" }
      : deal.status === "broken"
      ? { text: "Broken", cls: "bg-red-500/20 text-red-200 border-red-400/30" }
      : isOverdue
      ? { text: "Overdue", cls: "bg-red-500/20 text-red-200 border-red-400/30" }
      : isDueToday
      ? { text: "Due today", cls: "bg-amber-500/20 text-amber-200 border-amber-400/30" }
      : { text: "Open", cls: "bg-violet-500/20 text-violet-200 border-violet-400/30" };

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-xs text-white/50 mb-1">{kidName}</div>
          <h3 className="font-medium text-base leading-snug break-words">{deal.title}</h3>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
      </div>

      {(deal.kid_promises || deal.parent_promises) && (
        <dl className="text-sm space-y-1.5 mb-3">
          {deal.kid_promises && (
            <div>
              <dt className="inline text-white/50 text-xs uppercase tracking-wider mr-1">Kid:</dt>
              <dd className="inline text-white/85">{deal.kid_promises}</dd>
            </div>
          )}
          {deal.parent_promises && (
            <div>
              <dt className="inline text-white/50 text-xs uppercase tracking-wider mr-1">Parent:</dt>
              <dd className="inline text-white/85">{deal.parent_promises}</dd>
            </div>
          )}
        </dl>
      )}

      {deal.notes && <p className="text-sm text-white/60 italic mb-3">{deal.notes}</p>}

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-white/50">
          {deal.follow_up_date && (
            <span className={isOverdue ? "text-red-300" : isDueToday ? "text-amber-300" : ""}>
              {formatRel(days)}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {deal.status === "open" ? (
            <>
              <button
                onClick={() => onSetStatus("fulfilled")}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 border border-emerald-400/30 transition"
              >
                Fulfilled
              </button>
              <button
                onClick={() => onSetStatus("broken")}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-200 hover:bg-red-500/25 border border-red-400/30 transition"
              >
                Broken
              </button>
            </>
          ) : (
            <button
              onClick={() => onSetStatus("open")}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 transition"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 transition"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1.5 rounded-lg text-white/40 hover:text-red-300 transition"
            aria-label="Delete"
          >
            ×
          </button>
        </div>
      </div>
    </article>
  );
}

function KidModal({ onClose, onSave }: { onClose: () => void; onSave: (n: string, e: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Modal onClose={onClose} title="Add a kid">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setErr(null);
          try {
            await onSave(name.trim(), emoji);
          } catch (er) {
            setErr(er instanceof Error ? er.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Alex"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition"
          />
        </Field>
        <Field label="Avatar">
          <div className="flex flex-wrap gap-2">
            {EMOJI_CHOICES.map((e, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-10 h-10 rounded-lg border text-lg transition ${
                  emoji === e ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {e || "—"}
              </button>
            ))}
          </div>
        </Field>
        {err && <p className="text-sm text-red-300">{err}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:bg-white/10 disabled:text-white/30 transition"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DealModal({
  kids,
  deal,
  defaultKidId,
  onClose,
  onSave,
}: {
  kids: Kid[];
  deal: Deal | null;
  defaultKidId: number | undefined;
  onClose: () => void;
  onSave: (d: Partial<Deal> & { kid_id: number; title: string }) => Promise<void>;
}) {
  const [kidId, setKidId] = useState<number>(deal?.kid_id ?? defaultKidId ?? kids[0]?.id ?? 0);
  const [title, setTitle] = useState(deal?.title ?? "");
  const [kidPromises, setKidPromises] = useState(deal?.kid_promises ?? "");
  const [parentPromises, setParentPromises] = useState(deal?.parent_promises ?? "");
  const [followUp, setFollowUp] = useState(deal?.follow_up_date ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!deal;

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit deal" : "New deal"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !kidId) return;
          setBusy(true);
          setErr(null);
          try {
            await onSave({
              kid_id: kidId,
              title: title.trim(),
              kid_promises: kidPromises.trim() || null,
              parent_promises: parentPromises.trim() || null,
              follow_up_date: followUp || null,
              notes: notes.trim() || null,
            });
          } catch (er) {
            setErr(er instanceof Error ? er.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-3.5"
      >
        <Field label="Kid">
          <select
            value={kidId}
            onChange={(e) => setKidId(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition"
          >
            {kids.map((k) => (
              <option key={k.id} value={k.id} className="bg-[#0a0a0f]">
                {k.emoji ? `${k.emoji} ` : ""}{k.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal title">
          <input
            autoFocus={!isEdit}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Tidy bedroom for screen time"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition"
          />
        </Field>
        <Field label="Kid promises to..." optional>
          <textarea
            value={kidPromises}
            onChange={(e) => setKidPromises(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Tidy bedroom by Saturday lunch"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition resize-none"
          />
        </Field>
        <Field label="Parent promises..." optional>
          <textarea
            value={parentPromises}
            onChange={(e) => setParentPromises(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="1 hour of screen time on tablet"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition resize-none"
          />
        </Field>
        <Field label="Follow up on" optional>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            min={isEdit ? undefined : todayISO()}
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition"
          />
        </Field>
        <Field label="Notes" optional>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            rows={2}
            placeholder="Anything else"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-400/60 focus:outline-none transition resize-none"
          />
        </Field>
        {err && <p className="text-sm text-red-300">{err}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim() || !kidId}
            className="flex-1 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:bg-white/10 disabled:text-white/30 transition"
          >
            {busy ? "Saving..." : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl bg-[#13131a] border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#13131a] border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <h2 className="font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-white/60 mb-1.5 inline-block">
        {label}
        {optional && <span className="text-white/30 normal-case ml-1.5 tracking-normal">optional</span>}
      </span>
      {children}
    </label>
  );
}
