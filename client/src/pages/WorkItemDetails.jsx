import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../services/api";

function formatValue(value, field = "") {
    if (value === null || value === undefined || value === "") {
        return field === "assignee" ? "Unassigned" : "—";
    }

    if (typeof value === "object") {
        return value.name || value.title || "—";
    }

    if (field === "status" || field === "priority") {
        return String(value)
            .replaceAll("_", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    return String(value);
}

function getActivityMessage(activity) {
    switch (activity.action) {
        case "created":
            return "created this work item";
        case "status_changed":
            return "changed the status";
        case "priority_changed":
            return "changed the priority";
        case "assigned":
            return "changed the assignee";
        case "commented":
            return "added a comment";
        case "updated":
            return "updated this work item";
        default:
            return "performed an action";
    }
}

function getChangeEntries(activity) {
    return Object.entries(activity.changes || {}).filter(
        ([key]) => !["_id", "__v", "commentId"].includes(key)
    );
}

function formatFieldName(key) {
    return key
        .replace(/([A-Z])/g, " $1")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function GreenSpinner({ small = false }) {
    return (
        <span
            aria-label="Loading"
            role="status"
            className={`inline-block animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600 ${small ? "h-4 w-4" : "h-6 w-6"}`}
        />
    );
}

export default function WorkItemDetails() {
    const { id } = useParams();
    const [item, setItem] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusSaving, setStatusSaving] = useState(false);
    const [statusError, setStatusError] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [commentText, setCommentText] = useState("");
    const [commentSaving, setCommentSaving] = useState(false);
    const [commentError, setCommentError] = useState("");

    const loadDetails = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [itemResult, activityResult] = await Promise.all([
                apiRequest(`/work-items/${id}`),
                apiRequest(`/work-items/${id}/activity?page=1&limit=20`),
            ]);
            setItem(itemResult.data ?? itemResult.workItem ?? null);
            const activityRows = activityResult.data ?? activityResult.activities ?? [];
            setActivities(Array.isArray(activityRows) ? activityRows : []);
        } catch (err) {
            setError(err.message || "Could not load work item details.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadDetails();
    }, [loadDetails]);

    async function handleStatusChange(event) {
        const status = event.target.value;
        if (!item || statusSaving || status === item.status) return;

        setStatusSaving(true);
        setStatusError("");
        setStatusMessage("");

        try {
            const result = await apiRequest(`/work-items/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status, version: item.version }),
            });

            if (result.data) setItem(result.data);
            setStatusMessage("Status updated successfully.");
            await loadDetails();
        } catch (err) {
            setStatusError(
                err.status === 409
                    ? "The work item changed elsewhere or this status transition is not allowed. Refreshing the latest data."
                    : err.message || "Could not update status."
            );
            await loadDetails();
        } finally {
            setStatusSaving(false);
        }
    }

    async function handleAddComment(event) {
        event.preventDefault();
        const text = commentText.trim();
        if (!text || commentSaving) return;

        setCommentSaving(true);
        setCommentError("");

        try {
            await apiRequest(`/work-items/${id}/comments`, {
                method: "POST",
                body: JSON.stringify({ text }),
            });
            setCommentText("");
            await loadDetails();
        } catch (err) {
            setCommentError(err.message || "Could not add comment.");
        } finally {
            setCommentSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="flex min-h-64 items-center justify-center p-8">
                <GreenSpinner />
            </main>
        );
    }

    if (error) {
        return (
            <main className="p-8">
                <Link
                    to="/work-items"
                    className="mb-6 inline-flex items-center gap-3 text-sm text-slate-500 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Work Items</span>
                </Link>
                <p role="alert" className="mt-4 text-red-600">{error}</p>
            </main>
        );
    }

    if (!item) return <main className="p-8">Work item not found.</main>;

    const teamName = typeof item.team === "object" ? item.team?.name : "Unknown team";
    const assigneeName = typeof item.assignee === "object"
        ? item.assignee?.name || "Unassigned"
        : item.assignee || "Unassigned";
    const creatorName = typeof item.createdBy === "object"
        ? item.createdBy?.name || "Unknown"
        : "Unknown";
    const formatDate = (date) => date ? new Date(date).toLocaleString() : "—";

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="mx-auto max-w-5xl">
                <Link
                    to="/work-items"
                    className="mb-6 inline-flex items-center gap-3 text-sm text-slate-500 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Work Items</span>
                </Link>

                <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm text-slate-500">Work Item Details</p>
                            <h1 className="mt-1 text-2xl font-bold text-slate-900">{item.title}</h1>
                        </div>

                        <label className="min-w-36 space-y-1">
                            <span className="block text-xs font-medium text-slate-500">Status</span>
                            <select
                                value={item.status}
                                onChange={handleStatusChange}
                                disabled={statusSaving || item.status === "resolved"}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                            >
                                <option value="open">Open</option>
                                <option value="in_progress">In progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </label>
                    </div>

                    <p className="mt-5 whitespace-pre-wrap text-slate-700">
                        {item.description || "No description provided."}
                    </p>

                    <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                        <Detail label="Team" value={teamName} />
                        <Detail label="Assignee" value={assigneeName} />
                        <Detail label="Created by" value={creatorName} />
                        <Detail label="Priority" value={formatValue(item.priority, "priority")} />
                        <Detail label="Due Date" value={formatDate(item.dueDate)} />
                        <Detail label="Last updated" value={formatDate(item.updatedAt)} />
                    </div>

                    {(statusSaving || statusError || statusMessage) && (
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            {statusSaving && <GreenSpinner small />}
                            {statusSaving && <span className="text-slate-500">Saving status...</span>}
                            {statusError && <span role="alert" className="text-red-600">{statusError}</span>}
                            {!statusSaving && statusMessage && !statusError && (
                                <span role="status" className="text-emerald-700">{statusMessage}</span>
                            )}
                        </div>
                    )}
                </section>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Comments</h2>
                    <p className="mt-1 text-sm text-slate-500">Discuss this work item with your team.</p>

                    <form onSubmit={handleAddComment} className="mt-5 space-y-3">
                        <textarea
                            value={commentText}
                            onChange={(event) => setCommentText(event.target.value)}
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="Write a comment..."
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />

                        {commentError && <p role="alert" className="text-sm text-red-600">{commentError}</p>}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={commentSaving || !commentText.trim()}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {commentSaving && <GreenSpinner small />}
                                {commentSaving ? "Adding comment..." : "Add comment"}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Activity History</h2>
                    <p className="mt-1 text-sm text-slate-500">A record of actions performed on this work item.</p>

                    {activities.length === 0 ? (
                        <p className="mt-5 text-sm text-slate-500">No activity recorded yet.</p>
                    ) : (
                        <ol className="mt-6 space-y-4 ">
                            {activities.map((activity) => (
                                <li key={activity._id} className="border-l-2 border-slate-200 pb-3 pl-4">
                                    <p className="font-medium text-slate-800">
                                        {activity.actor?.name || "Unknown user"}{" "}
                                        <span className="font-normal text-slate-600">{getActivityMessage(activity)}</span>
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">{formatDate(activity.createdAt)}</p>

                                    {getChangeEntries(activity).length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {getChangeEntries(activity).map(([key, value]) => (
                                                <div key={key} className="text-sm">
                                                    {key === "commentText" ? (
                                                        <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{value}</p>
                                                    ) : (
                                                        <>
                                                            <p className="text-xs font-medium text-slate-500">{formatFieldName(key)}</p>
                                                            {value && typeof value === "object" && ("from" in value || "to" in value) ? (
                                                                <p className="mt-1 text-slate-700">
                                                                    {formatValue(value.from, key)}{" → "}{formatValue(value.to, key)}
                                                                </p>
                                                            ) : value && typeof value === "object" && ("oldValue" in value || "newValue" in value) ? (
                                                                <p className="mt-1 text-slate-700">
                                                                    {formatValue(value.oldValue, key)}{" → "}{formatValue(value.newValue, key)}
                                                                </p>
                                                            ) : (
                                                                <p className="mt-1 break-words text-slate-700">{formatValue(value, key)}</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>
        </main>
    );
}

function Detail({ label, value }) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-slate-800">{value || "—"}</p>
        </div>
    );
}
