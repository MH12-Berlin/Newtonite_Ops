
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/authContext";
import { useNavigate } from "react-router-dom";


const statusStyles = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700",
  blocked: "bg-red-50 text-red-700",
  resolved: "bg-emerald-50 text-emerald-700",
};

const priorityStyles = {
  low: "text-slate-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

function formatLabel(value = "") {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) =>
    c.toUpperCase()
  );
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function MetricCard({ title, value, subtitle, icon: Icon, accent }) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className={`rounded-xl p-2 ${accent}`}>
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [recentItems, setRecentItems] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [summaryResult, workItemsResult] = await Promise.all([
          apiRequest("/dashboard/summary"),
          apiRequest("/work-items?page=1&limit=10"),
        ]);

        const rows =
          workItemsResult.workItems ??
          workItemsResult.items ??
          workItemsResult.data ??
          [];

        const priorityRank = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };

        const sortedRecentItems = (Array.isArray(rows) ? [...rows] : []).sort(
          (a, b) => {
            const priorityDifference =
              (priorityRank[String(a.priority || "medium").toLowerCase()] ?? 4) -
              (priorityRank[String(b.priority || "medium").toLowerCase()] ?? 4);

            if (priorityDifference !== 0) return priorityDifference;

            // Within the same priority, show the most recently updated first.
            return new Date(b.updatedAt || b.createdAt || 0) -
              new Date(a.updatedAt || a.createdAt || 0);
          }
        );

        if (active) {
          setData(summaryResult);
          setRecentItems(sortedRecentItems);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const summary = data?.summary;
  const items = recentItems;

  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {mobileMenu && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Activity size={23} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Newtonite Ops</h1>
            <p className="text-xs text-slate-500">Operations workspace</p>
          </div>
          <button
            className="ml-auto text-slate-500 lg:hidden"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>
          <nav className="space-y-1">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
              <LayoutDashboard size={18} />
              Dashboard
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500">
              <button
                onClick={() => navigate("/work-items")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                <ListTodo size={18} />
                Work items
              </button>
            </div>

            <button
              onClick={() => {
                navigate("/teams");
                setMobileMenu(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              <Users size={18} />
              Teams
            </button>

          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl p-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="text-slate-600 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm text-slate-500">Workspace / Overview</p>
              <h2 className="font-semibold">Dashboard</h2>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 sm:flex">
            <Search size={16} />
            <span>Operations overview</span>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                Your workspace at a glance
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Good to see you, {firstName}.
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Here’s what’s happening across your teams.
              </p>
            </div>

            <button
              onClick={() => navigate("/work-items")}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={18} />
              Create work item
            </button>
          </section>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Dashboard could not load</p>
                <p className="mt-1">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total work items"
              value={loading ? "—" : summary?.total ?? 0}
              subtitle="Across your teams"
              icon={ListTodo}
              accent="bg-slate-100 text-slate-700"
            />
            <MetricCard
              title="In progress"
              value={loading ? "—" : summary?.inProgress ?? 0}
              subtitle="Currently being worked on"
              icon={Clock3}
              accent="bg-blue-50 text-blue-700"
            />
            <MetricCard
              title="Blocked"
              value={loading ? "—" : summary?.blocked ?? 0}
              subtitle="May need attention"
              icon={AlertCircle}
              accent="bg-red-50 text-red-700"
            />
            <MetricCard
              title="Assigned to me"
              value={loading ? "—" : summary?.assignedToMe ?? 0}
              subtitle="Unresolved assignments"
              icon={CircleDot}
              accent="bg-violet-50 text-violet-700"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h3 className="font-semibold">Recent work items</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Recently updated across your teams
                  </p>
                </div>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  Latest 10
                </span>
              </div>

              {loading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-14 animate-pulse rounded-lg bg-slate-100"
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <ListTodo size={22} />
                  </div>
                  <h4 className="mt-4 font-semibold">Nothing here yet</h4>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                    Work items from your teams will appear here as they are
                    created and updated.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <div
                      key={item._id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.team?.name || "Team"} ·{" "}
                          {item.assignee?.name || "Unassigned"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[item.status] ||
                            "bg-slate-100 text-slate-700"
                            }`}
                        >
                          {formatLabel(item.status)}
                        </span>
                        <span
                          className={`text-xs font-semibold ${priorityStyles[item.priority] || "text-slate-500"
                            }`}
                        >
                          {formatLabel(item.priority)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(item.updatedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h3 className="font-semibold">Workload overview</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Current item status
                </p>

                {loading ? (
                  <div className="mt-6 h-32 animate-pulse rounded-xl bg-slate-100" />
                ) : (
                  <div className="mt-6 space-y-5">
                    {[
                      { label: "Open", value: summary?.open ?? 0, color: "bg-slate-400" },
                      { label: "In progress", value: summary?.inProgress ?? 0, color: "bg-blue-500" },
                      { label: "Blocked", value: summary?.blocked ?? 0, color: "bg-red-500" },
                      { label: "Resolved", value: summary?.resolved ?? 0, color: "bg-emerald-500" },
                    ].map((row) => {
                      const total = summary?.total || 0;
                      const percentage = total
                        ? Math.min(100, (row.value / total) * 100)
                        : 0;

                      return (
                        <div key={row.label}>
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-slate-600">{row.label}</span>
                            <span className="font-semibold">{row.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${row.color}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={19} />
                  <h3 className="font-semibold">Needs attention</h3>
                </div>
                <p className="mt-4 text-3xl font-bold text-red-800">
                  {loading ? "—" : summary?.critical ?? 0}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  Unresolved critical-priority items across your teams.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">Keep work moving</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Track blockers and resolve issues promptly.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <ArrowDownRight size={15} />
                  <span>Live data from your workspace</span>
                  <ArrowRight size={15} className="ml-auto" />
                </div>
              </div>
            </div>
          </section>

          <footer className="pb-2 text-center text-xs text-slate-400">
            Newtonite Ops · Operations workspace
          </footer>
        </div>
      </main>
    </div>
  );
}
