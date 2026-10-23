import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ROVER_URL } from "@/lib/rover";
import { Button } from "@/components/ui/button";
import {
  Bot,
  ExternalLink,
  CalendarCheck,
  ClipboardEdit,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Pencil,
  Save,
  X,
  ShieldCheck,
  ShieldAlert,
  CircleHelp,
} from "lucide-react";
import { toast } from "sonner";

type PPEStatus = "present" | "missing" | "uncertain" | string | null;
type AttendanceFilter = "all" | "inside" | "exited";
type PPEKey = "helmet" | "safety_vest" | "gloves" | "safety_boots" | "safety_goggles";
type PPEValue = "present" | "missing" | "uncertain";

type WorkerInfo = {
  id: string;
  employee_id: string;
  name: string;
  helmet: PPEStatus;
  safety_vest: PPEStatus;
  gloves: PPEStatus;
  safety_boots: PPEStatus;
  safety_goggles: PPEStatus;
};

type AttendanceRow = {
  id: string;
  worker_id: string;
  entry_time: string;
  exit_time: string | null;
  employee_id: string;
  name: string;
  helmet: PPEStatus;
  safety_vest: PPEStatus;
  gloves: PPEStatus;
  safety_boots: PPEStatus;
  safety_goggles: PPEStatus;
};

const PPE_ITEMS: { key: PPEKey; label: string }[] = [
  { key: "helmet", label: "Helmet" },
  { key: "safety_vest", label: "Safety Vest" },
  { key: "gloves", label: "Gloves" },
  { key: "safety_boots", label: "Safety Boots" },
  { key: "safety_goggles", label: "Safety Goggles" },
];

function normalizeStatus(value: PPEStatus): PPEValue {
  const status = String(value ?? "uncertain").toLowerCase().trim();
  if (["present", "yes", "true", "available", "ok", "compliant"].includes(status)) return "present";
  if (["missing", "no", "false", "absent", "non-compliant", "non_compliant"].includes(status)) return "missing";
  return "uncertain";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function localDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function PPEBadge({ status }: { status: PPEStatus }) {
  const normalized = normalizeStatus(status);
  const styles =
    normalized === "present"
      ? "bg-emerald-500/10 text-emerald-600"
      : normalized === "missing"
        ? "bg-red-500/10 text-red-500"
        : "bg-amber-500/10 text-amber-600";
  const label =
    normalized === "present" ? "Present" :
    normalized === "missing" ? "Missing" : "Uncertain";
  const Icon =
    normalized === "present" ? ShieldCheck :
    normalized === "missing" ? ShieldAlert : CircleHelp;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${styles}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

export default function ModifyAttendance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState("");
  const [editExit, setEditExit] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        navigate("/login", { replace: true });
        return;
      }

      let query = (supabase as any)
        .from("worker_attendance")
        .select("id, worker_id, entry_time, exit_time")
        .eq("user_id", authData.user.id)
        .order("entry_time", { ascending: false })
        .limit(1000);

      if (fromDate) {
        query = query.gte("entry_time", new Date(`${fromDate}T00:00:00`).toISOString());
      }
      if (toDate) {
        const dayAfter = new Date(`${toDate}T00:00:00`);
        dayAfter.setDate(dayAfter.getDate() + 1);
        query = query.lt("entry_time", dayAfter.toISOString());
      }

      const { data: attendanceData, error: attendanceError } = await query;
      if (attendanceError) throw attendanceError;

      const attendance = (attendanceData ?? []) as Array<{
        id: string;
        worker_id: string;
        entry_time: string;
        exit_time: string | null;
      }>;

      if (attendance.length === 0) {
        setRows([]);
        return;
      }

      const workerIds = [...new Set(attendance.map((item) => item.worker_id))];
      const { data: workerData, error: workerError } = await (supabase as any)
        .from("worker_ppe_registry")
        .select("id, employee_id, name, helmet, safety_vest, gloves, safety_boots, safety_goggles")
        .eq("user_id", authData.user.id)
        .in("id", workerIds);
      if (workerError) throw workerError;

      const workerMap = new Map<string, WorkerInfo>(
        ((workerData ?? []) as WorkerInfo[]).map((worker) => [worker.id, worker]),
      );

      setRows(
        attendance.map((item) => {
          const worker = workerMap.get(item.worker_id);
          return {
            ...item,
            employee_id: worker?.employee_id ?? "Unknown ID",
            name: worker?.name ?? "Worker record unavailable",
            helmet: worker?.helmet ?? "uncertain",
            safety_vest: worker?.safety_vest ?? "uncertain",
            gloves: worker?.gloves ?? "uncertain",
            safety_boots: worker?.safety_boots ?? "uncertain",
            safety_goggles: worker?.safety_goggles ?? "uncertain",
          };
        }),
      );
    } catch (error) {
      console.error("Modify attendance load failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not load attendance records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate, fromDate, toDate]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate("/login", { replace: true });
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(term) ||
        row.employee_id.toLowerCase().includes(term);
      const matchesStatus =
        attendanceFilter === "all" ||
        (attendanceFilter === "inside" && !row.exit_time) ||
        (attendanceFilter === "exited" && Boolean(row.exit_time));
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, attendanceFilter]);

  const startEdit = (row: AttendanceRow) => {
    setEditingId(row.id);
    setEditEntry(new Date(row.entry_time).toISOString().slice(0, 16));
    setEditExit(row.exit_time ? new Date(row.exit_time).toISOString().slice(0, 16) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEntry("");
    setEditExit("");
  };

  const saveEdit = async (row: AttendanceRow) => {
    if (!editEntry) {
      toast.error("IN time is required.");
      return;
    }

    const entryDate = new Date(editEntry);
    const exitDate = editExit ? new Date(editExit) : null;
    if (Number.isNaN(entryDate.getTime()) || (exitDate && Number.isNaN(exitDate.getTime()))) {
      toast.error("Please enter valid date and time values.");
      return;
    }
    if (exitDate && exitDate < entryDate) {
      toast.error("OUT time cannot be earlier than IN time.");
      return;
    }

    const confirmed = window.confirm(
      `Save attendance time changes for ${row.name} (${row.employee_id})?`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        navigate("/login", { replace: true });
        return;
      }

      const { error } = await (supabase as any)
        .from("worker_attendance")
        .update({
          entry_time: entryDate.toISOString(),
          exit_time: exitDate ? exitDate.toISOString() : null,
        })
        .eq("id", row.id)
        .eq("user_id", authData.user.id);

      if (error) throw error;

      toast.success("Attendance record updated.");
      cancelEdit();
      await loadRecords(false);
    } catch (error) {
      console.error("Attendance update failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not update attendance.");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-black">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate("/")} className="flex shrink-0 items-center gap-2" aria-label="Go to MineScan dashboard">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-primary font-bold text-white">MS</span>
            <span className="text-lg font-bold text-white">MineScan</span>
          </button>
          <nav className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/safety")}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Analyze Image &amp; Add Attendance
            </Button>
            <a href={ROVER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
              <Bot className="mr-2 h-4 w-4" /> Rover <ExternalLink className="ml-2 h-3 w-3" />
            </a>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/attendance")}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Today's Attendance
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate("/modify-attendance")}>
              <ClipboardEdit className="mr-2 h-4 w-4" /> Modify Attendance
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-[1500px] px-4 py-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button onClick={() => navigate("/")} className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
            <h1 className="text-3xl font-bold text-foreground">Modify Attendance</h1>
            <p className="mt-2 text-muted-foreground">Review and correct worker IN/OUT times. Changes are saved to Supabase.</p>
          </div>
          <Button variant="outline" onClick={() => void loadRecords(false)} disabled={loading || refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Find attendance records</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search worker or Employee ID" className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground" aria-label="Search worker or Employee ID" />
            </div>
            <select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value as AttendanceFilter)} className={selectClass} aria-label="Filter attendance status">
              <option value="all">All attendance statuses</option>
              <option value="inside">Currently inside</option>
              <option value="exited">Checked out</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              From
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className={`${selectClass} min-w-0 flex-1`} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              To
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className={`${selectClass} min-w-0 flex-1`} />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">Attendance records ({filteredRows.length})</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use Edit to correct timestamps. Every change requires confirmation.</p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Loading attendance records...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardEdit className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No matching attendance records</h3>
              <p className="mt-2 text-sm text-muted-foreground">Try a different search or date range, or record a worker's IN time first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Worker</th>
                    <th className="px-4 py-3 font-medium">Employee ID</th>
                    <th className="px-4 py-3 font-medium">IN Time</th>
                    <th className="px-4 py-3 font-medium">OUT Time</th>
                    <th className="px-4 py-3 font-medium">Attendance</th>
                    <th className="px-4 py-3 font-medium">PPE Summary</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.employee_id}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="datetime-local" value={editEntry} onChange={(event) => setEditEntry(event.target.value)} className={`${selectClass} min-w-[205px]`} aria-label={`Edit IN time for ${row.name}`} />
                          ) : formatDateTime(row.entry_time)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="datetime-local" value={editExit} onChange={(event) => setEditExit(event.target.value)} className={`${selectClass} min-w-[205px]`} aria-label={`Edit OUT time for ${row.name}`} />
                              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditExit("")}>Clear OUT time (mark inside)</button>
                            </div>
                          ) : formatDateTime(row.exit_time)}
                        </td>
                        <td className="px-4 py-3">
                          {row.exit_time
                            ? <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Checked Out</span>
                            : <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">Inside</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1.5">
                            {PPE_ITEMS.map(({ key, label }) => (
                              <span key={key} title={`${label}: ${normalizeStatus(row[key])}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                                {label}: <PPEBadge status={row[key]} />
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => void saveEdit(row)} disabled={saving}>
                                <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                                <X className="mr-1 h-4 w-4" /> Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                              <Pencil className="mr-1 h-4 w-4" /> Edit
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-muted-foreground">
          Only attendance timestamps are editable on this page. PPE statuses are shown for reference and should be corrected through the worker registry/photo analysis workflow.
        </p>
      </main>
    </div>
  );
}
