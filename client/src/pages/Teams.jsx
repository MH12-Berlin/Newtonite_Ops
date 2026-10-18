
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Plus,
  UserPlus,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/authContext";

export default function Teams() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [members, setMembers] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [teamName, setTeamName] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);

  const selected = teams.find(
    (team) => team._id === selectedTeam
  );

  const membership = user?.memberships?.find(
  (item) =>
    String(item.team?._id || item.team) === selectedTeam
);

const isAdmin = membership?.role === "admin";

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest("/teams");
      const list = result.data || [];

      setTeams(list);
      setSelectedTeam((current) =>
        list.some((team) => team._id === current)
          ? current
          : list[0]?._id || ""
      );
    } catch (err) {
      setError(err.message || "Could not load teams.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!selectedTeam) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);
    setError("");

    try {
      const result = await apiRequest(
        `/teams/${selectedTeam}/members`
      );
      setMembers(result.data || []);
    } catch (err) {
      setMembers([]);
      setError(err.message || "Could not load team members.");
    } finally {
      setMembersLoading(false);
    }
  }, [selectedTeam]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!selectedTeam || !isAdmin) {
      setEligibleUsers([]);
      setSelectedUser("");
      return;
    }

    let active = true;

    async function loadEligibleUsers() {
      setEligibleLoading(true);

      try {
        const result = await apiRequest(
          `/teams/${selectedTeam}/eligible-members`
        );

        if (active) {
          setEligibleUsers(result.data || []);
          setSelectedUser("");
        }
      } catch (err) {
        if (active) {
          setEligibleUsers([]);
          setError(
            err.message || "Could not load registered users."
          );
        }
      } finally {
        if (active) setEligibleLoading(false);
      }
    }

    loadEligibleUsers();

    return () => {
      active = false;
    };
  }, [selectedTeam, isAdmin]);

  async function handleCreateTeam(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const result = await apiRequest("/teams", {
        method: "POST",
        body: JSON.stringify({ name: teamName.trim() }),
      });

      const createdTeam = result.data;

      setTeamName("");
      setMessage("Team created successfully.");

      await loadTeams();
      setSelectedTeam(createdTeam._id);
    } catch (err) {
      setError(err.message || "Could not create team.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();

    const person = eligibleUsers.find(
      (item) => item._id === selectedUser
    );

    if (!person) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      await apiRequest(`/teams/${selectedTeam}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: person.email,
          role,
        }),
      });

      setMessage(`${person.name} added to the team.`);
      setSelectedUser("");
      setRole("member");

      await loadMembers();

      const result = await apiRequest(
        `/teams/${selectedTeam}/eligible-members`
      );
      setEligibleUsers(result.data || []);
    } catch (err) {
      setError(err.message || "Could not add team member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <button
              onClick={() => navigate("/")}
              className="mb-4 flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-700"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </button>

            <p className="text-sm font-medium text-emerald-700">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Teams
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage your teams and their members.
            </p>
          </div>

          <button
            onClick={loadTeams}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {message && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Users size={22} />
              </div>
              <div>
                <h2 className="font-semibold">Your teams</h2>
                <p className="text-sm text-slate-500">
                  {teams.length}{" "}
                  {teams.length === 1 ? "team" : "teams"}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 text-sm text-slate-500">
                Loading teams...
              </p>
            ) : teams.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">
                You don't belong to any teams yet.
              </p>
            ) : (
              <div className="mt-5 space-y-2">
                {teams.map((team) => (
                  <button
                    key={team._id}
                    onClick={() => {
                      setSelectedTeam(team._id);
                      setMessage("");
                      setError("");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedTeam === team._id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-medium">{team.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {team._id}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-6 lg:col-span-2">
            {isAdmin && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="font-semibold">Create a team</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create a workspace for a group of people.
                </p>

                <form
                  onSubmit={handleCreateTeam}
                  className="mt-4 flex flex-col gap-3 sm:flex-row"
                >
                  <input
                    value={teamName}
                    onChange={(event) =>
                      setTeamName(event.target.value)
                    }
                    maxLength={100}
                    required
                    placeholder="Enter team name"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <button
                    type="submit"
                    disabled={saving || !teamName.trim()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Plus size={17} />
                    Create team
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-500">
                  You will be an admin of the new team.
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div>
                <h2 className="font-semibold">Team members</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected
                    ? `Members of ${selected.name}`
                    : "Select a team to view its members."}
                </p>
              </div>

              {selected && isAdmin && (
                <form
                  onSubmit={handleAddMember}
                  className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]"
                >
                  <select
                    required
                    value={selectedUser}
                    onChange={(event) =>
                      setSelectedUser(event.target.value)
                    }
                    disabled={
                      eligibleLoading || eligibleUsers.length === 0
                    }
                    className="min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50"
                  >
                    <option value="">
                      {eligibleLoading
                        ? "Loading users..."
                        : eligibleUsers.length === 0
                          ? "No eligible users"
                          : "Select a team member"}
                    </option>

                    {eligibleUsers.map((person) => (
                      <option key={person._id} value={person._id}>
                        {person.name} — {person.email}
                      </option>
                    ))}
                  </select>

                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                  </select>

                  <button
                    type="submit"
                    disabled={saving || !selectedUser}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                    Add member
                  </button>
                </form>
              )}

              {!selected ? (
                <p className="mt-6 text-sm text-slate-500">
                  Select a team to see its members.
                </p>
              ) : membersLoading ? (
                <p className="mt-6 text-sm text-slate-500">
                  Loading members...
                </p>
              ) : members.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  No members found.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-slate-100">
                  {members.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                        {(member.name || member.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {member.email}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">
                        {member.role || "member"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
