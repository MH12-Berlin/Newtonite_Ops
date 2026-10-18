
import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    LoaderCircle,
    Plus,
    Search,
    X,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../services/api";


const initialForm = {
    title: "",
    description: "",
    team: "",
    assignee: "",
    priority: "medium",
    dueDate: "",
};

const inputStyle =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const statusStyle = {
    open: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    blocked: "bg-red-50 text-red-700",
    resolved: "bg-emerald-50 text-emerald-700",
};

function label(value = "") {
    return value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function WorkItems() {
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [teams, setTeams] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [priority, setPriority] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [form, setForm] = useState(initialForm);
    const [duplicate, setDuplicate] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const loadItems = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "10",
            });

            if (search.trim()) params.set("search", search.trim());
            if (status) params.set("status", status);
            if (priority) params.set("priority", priority);

            const result = await apiRequest(`/work-items?${params}`);

            // Supports common response shapes; adjust to your controller if needed.
            const rows = result.workItems ?? result.items ?? result.data ?? [];
            // Sort the currently fetched page by earliest due date, then priority.
            const priorityRank = {
                critical: 4,
                high: 3,
                medium: 2,
                low: 1,
            };

            const sortedRows = Array.isArray(rows) ? [...rows].sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

                if (dateA !== dateB) return dateA - dateB;

                return (priorityRank[String(b.priority).toLowerCase()] ?? 0) -
                    (priorityRank[String(a.priority).toLowerCase()] ?? 0);
            }) : [];

            setItems(sortedRows);

            const pagination = result.pagination ?? {};
            const count = pagination.total ?? result.total ?? rows.length;
            const pages =
                pagination.totalPages ??
                pagination.pages ??
                result.totalPages ??
                Math.max(1, Math.ceil(count / 10));

            setTotal(count);
            setTotalPages(Math.max(1, pages));
        } catch (err) {
            setError(err.message || "Could not load work items.");
        } finally {
            setLoading(false);
        }
    }, [page, search, status, priority]);

    useEffect(() => {
        let cancelled = false;

        async function loadTeamMembers() {
            if (!form.team) {
                setTeamMembers([]);
                return;
            }

            try {
                const result = await apiRequest(
                    `/teams/${form.team}/members`
                );

                if (!cancelled) {
                    setTeamMembers(result.data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setTeamMembers([]);
                    setFormError(error.message || "Could not load team members.");
                }
            }
        }

        loadTeamMembers();

        return () => {
            cancelled = true;
        };
    }, [form.team]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    useEffect(() => {
        apiRequest("/teams")
            .then(result => setTeams(result.teams ?? result.data ?? []))
            .catch(err => setFormError(err.message || "Could not load teams."));
    }, []);


    async function createItem(event, confirmDuplicate = false) {
        event.preventDefault();
        setSaving(true);
        setFormError("");

        try {
            const result = await apiRequest("/work-items", {
                method: "POST",
                body: JSON.stringify({
                    title: form.title.trim(),
                    description: form.description.trim(),
                    team: form.team,
                    assignee: form.assignee || null,
                    priority: form.priority,
                    dueDate: form.dueDate,
                    confirmDuplicate,
                }),
            });

            if (result.duplicateFound) {
                setDuplicate(result.duplicate);
                return;
            }

            setDuplicate(null);
            setForm(initialForm);
            setShowForm(false);
            setPage(1);
            await loadItems();
        } catch (err) {
            setFormError(err.message || "Could not create work item.");
        } finally {
            setSaving(false);
        }
    }


    function changeFilter(setter, value) {
        setter(value);
        setPage(1);
    }

    return (
        <div className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
            <div className="mx-auto max-w-7xl">
                <button
                    onClick={() => navigate("/")}
                    className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
                >
                    <ArrowLeft size={17} /> Back to dashboard
                </button>

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Work items</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Search, prioritize, and manage your team's work.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setFormError("");
                            setShowForm(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                        <Plus size={18} /> New work item
                    </button>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            value={search}
                            onChange={e => changeFilter(setSearch, e.target.value)}
                            placeholder="Search work items..."
                            className={`${inputStyle} pl-10`}
                        />
                    </div>

                    <select
                        value={status}
                        onChange={e => changeFilter(setStatus, e.target.value)}
                        className={inputStyle}
                    >
                        <option value="">All statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="resolved">Resolved</option>
                    </select>

                    <select
                        value={priority}
                        onChange={e => changeFilter(setPriority, e.target.value)}
                        className={inputStyle}
                    >
                        <option value="">All priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>

                {error && (
                    <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button onClick={loadItems} className="ml-auto font-semibold underline">
                            Retry
                        </button>
                    </div>
                )}

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <h2 className="font-semibold">All work items</h2>
                        <span className="text-xs text-slate-500">
                            {loading ? "Loading..." : `${total} items`}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 p-14 text-sm text-slate-500">
                            <LoaderCircle size={19} className="animate-spin" />
                            Loading work items...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-14 text-center">
                            <p className="font-semibold">No work items found</p>
                            <p className="mt-2 text-sm text-slate-500">
                                Try different filters or create a new item.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {items.map(item => (
                                <Link
                                    key={item._id}
                                    to={`/work-items/${item._id}`}
                                    className="group flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:flex-row sm:items-center sm:justify-between"
                                    aria-label={`View work item: ${item.title}`}
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 transition-colors group-hover:text-emerald-700 group-hover:underline">
                                            {item.title}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                            {item.description || "No description provided."}
                                        </p>
                                        <p className="mt-2 text-xs text-slate-400">
                                            {item.team?.name || "Team"} ·{" "}
                                            {item.assignee?.name || "Unassigned"}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[item.status] || "bg-slate-100 text-slate-700"}`}>
                                            {label(item.status)}
                                        </span>
                                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                            {label(item.priority)}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {!loading && total > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                            <p className="text-sm text-slate-500">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                                    aria-label="Next page"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
                        <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">Create work item</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Add a task to one of your teams.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                    aria-label="Close form"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={createItem} className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">
                                        Title
                                    </label>
                                    <input
                                        required
                                        maxLength={150}
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        className={inputStyle}
                                        placeholder="e.g. Investigate production issue"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">
                                        Description
                                    </label>
                                    <textarea
                                        rows={4}
                                        maxLength={5000}
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        className={inputStyle}
                                        placeholder="Add context and expected outcome..."
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">
                                        Team
                                    </label>
                                    <select
                                        required
                                        value={form.team}
                                        onChange={e => setForm({ ...form, team: e.target.value })}
                                        className={inputStyle}
                                    >
                                        <option value="">Select a team</option>
                                        {teams.map(team => (
                                            <option key={team._id} value={team._id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    {teams.length === 0 && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            No teams available. Check your team membership.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">
                                        Assignee
                                    </label>

                                    <select
                                        value={form.assignee || ""}
                                        onChange={(e) =>
                                            setForm({ ...form, assignee: e.target.value })
                                        }
                                        className={inputStyle}
                                        disabled={!form.team}
                                    >
                                        <option value="">Unassigned</option>

                                        {teamMembers.map((member) => (
                                            <option key={member._id} value={member._id}>
                                                {member.name} ({member.email})
                                            </option>
                                        ))}
                                    </select>

                                    {form.team && teamMembers.length === 0 && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            No team members found.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium">
                                        Priority
                                    </label>
                                    <select
                                        value={form.priority}
                                        onChange={e => setForm({ ...form, priority: e.target.value })}
                                        className={inputStyle}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>


                                <div>
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                                            Due Date 
                                        </span>

                                        <input
                                            type="date"
                                            value={form.dueDate}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    dueDate: event.target.value,
                                                }))
                                            }
                                            min={new Date().toLocaleDateString("en-CA")}
                                            required
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                        />
                                    </label>
                                </div>



                                {formError && (
                                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                                        {formError}
                                    </p>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={saving || teams.length === 0}
                                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                    >
                                        {saving ? "Creating..." : "Create item"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {duplicate && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
                        <div
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="duplicate-title"
                            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                <AlertCircle size={24} />
                            </div>

                            <h3 id="duplicate-title" className="text-xl font-bold">
                                Possible duplicate work item
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                An item with the same title, description, team, assignee and priority
                                already exists. Do you want to create another one?
                            </p>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="font-semibold">{duplicate.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {duplicate.status === "being created"
                                        ? "An identical work item is currently being submitted. Review before proceeding."
                                        : "An item with the same details already exists. Do you want to create another one?"}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Priority: {label(duplicate.priority)}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Assignee: {duplicate.assignee}
                                </p>
                            </div>

                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setDuplicate(null)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                                >
                                    Discard
                                </button>

                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => createItem(
                                        { preventDefault() { } },
                                        true
                                    )}
                                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {saving ? "Creating..." : "Create anyway"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
