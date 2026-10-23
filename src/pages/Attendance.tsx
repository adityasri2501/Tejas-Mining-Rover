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
  Clock3,
  Users,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  CircleHelp,
  FilterX,
} from "lucide-react";
import { toast } from "sonner";

type PPEStatus = "present" | "missing" | "uncertain" | string | null;

type WorkerInfo = {
  id: string;
  employee_id: string;
  name: string;
  helmet?: PPEStatus;
  safety_vest?: PPEStatus;
  gloves?: PPEStatus;
  safety_boots?: PPEStatus;
  safety_goggles?: PPEStatus;
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

type PPEFilterKey =
  | "helmet"
  | "safety_vest"
  | "gloves"
  | "safety_boots"
  | "safety_goggles";

const PPE_ITEMS: { key: PPEFilterKey; label: string }[] = [
  { key: "helmet", label: "Helmet" },
  { key: "safety_vest", label: "Safety Vest" },
  { key: "gloves", label: "Gloves" },
  { key: "safety_boots", label: "Safety Boots" },
  { key: "safety_goggles", label: "Safety Goggles" },
];

function normalizeStatus(status: PPEStatus): "present" | "missing" | "uncertain" {
  const value = String(status ?? "uncertain").toLowerCase().trim();
  if (["present", "yes", "true", "available", "ok", "compliant"].includes(value)) return "present";
  if (["missing", "no", "false", "absent", "non-compliant", "non_compliant"].includes(value)) return "missing";
  return "uncertain";
}

function StatusBadge({ status }: { status: PPEStatus }) {
  const normalized = normalizeStatus(status);
  if (normalized === "present") {
    return (
      <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600">
        <ShieldCheck className="h-3 w-3" /> Helmet/PPE Present
      </span>
    );
  }
  if (normalized === "missing") {
    return (
      <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500">
        <ShieldAlert className="h-3 w-3" /> Missing
      </span>
    );
  }
  return (
    <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600">
      <CircleHelp className="h-3 w-3" /> Uncertain
    </span>
  );
}

function PPECell({ label, status }: { label: string; status: PPEStatus }) {
  const normalized = normalizeStatus(status);
  const shortLabel =
    normalized === "present" ? "Present" :
    normalized === "missing" ? "Missing" : "Uncertain";

  return (
    <div className="min-w-[105px] space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
          normalized === "present"
            ? "bg-emerald-500/10 text-emerald-600"
            : normalized === "missing"
              ? "bg-red-500/10 text-red-500"
              : "bg-amber-500/10 text-amber-600"
        }`}
      >
        {shortLabel}
      </span>
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function localDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function Attendance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "inside" | "exited">("all");
  const [ppeFilters, setPpeFilters] = useState<Record<PPEFilterKey, "all" | "present" | "missing" | "uncertain">>({
    helmet: "all",
    safety_vest: "all",
    gloves: "all",
    safety_boots: "all",
    safety_goggles: "all",
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadAttendance = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        navigate("/login", { replace: true });
        return;
      }

      const { start, end } = localDayRange();
      const { data: attendanceData, error: attendanceError } = await (supabase as any)
        .from("worker_attendance")
        .select("id, worker_id, entry_time, exit_time")
        .eq("user_id", authData.user.id)
        .gte("entry_time", start)
        .lt("entry_time", end)
        .order("entry_time", { ascending: false });

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
      console.error("Today's attendance load failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not load today's attendance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate("/login", { replace: true });
  };

  const hasPpeFilters = Object.values(ppeFilters).some((value) => value !== "all");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.employee_id.toLowerCase().includes(normalizedSearch);

      const matchesAttendance =
        attendanceFilter === "all" ||
        (attendanceFilter === "inside" && !row.exit_time) ||
        (attendanceFilter === "exited" && Boolean(row.exit_time));

      const matchesPPE = PPE_ITEMS.every(({ key }) => {
        const wanted = ppeFilters[key];
        return wanted === "all" || normalizeStatus(row[key]) === wanted;
      });

      return matchesSearch && matchesAttendance && matchesPPE;
    });
  }, [rows, search, attendanceFilter, ppeFilters]);

  const insideCount = rows.filter((row) => !row.exit_time).length;
  const exitedCount = rows.filter((row) => Boolean(row.exit_time)).length;

  const resetFilters = () => {
    setSearch("");
    setAttendanceFilter("all");
    setPpeFilters({
      helmet: "all",
      safety_vest: "all",
      gloves: "all",
      safety_boots: "all",
      safety_goggles: "all",
    });
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
            <Button variant="default" size="sm" onClick={() => navigate("/attendance")}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Today's Attendance
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/modify-attendance")}>
              <ClipboardEdit className="mr-2 h-4 w-4" /> Modify Attendance
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-[1600px] px-4 py-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button onClick={() => navigate("/")} className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
            <h1 className="text-3xl font-bold text-foreground">Today's Attendance</h1>
            <p className="mt-2 text-muted-foreground">{formatDate(new Date())}</p>
          </div>
          <Button variant="outline" onClick={() => void loadAttendance(false)} disabled={loading || refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Today's Entries</p><Users className="h-5 w-5 text-primary" /></div>
            <p className="mt-2 text-3xl font-bold">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Currently Inside</p><Clock3 className="h-5 w-5 text-emerald-500" /></div>
            <p className="mt-2 text-3xl font-bold">{insideCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Checked Out</p><LogOut className="h-5 w-5 text-muted-foreground" /></div>
            <p className="mt-2 text-3xl font-bold">{exitedCount}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="space-y-4 border-b border-border p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Attendance Records &amp; PPE Status</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every PPE item is shown separately. Multiple filters combine with AND logic.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search worker or ID..." className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground sm:w-64" aria-label="Search attendance records" />
                </div>
                <select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value as typeof attendanceFilter)} className={selectClass} aria-label="Filter attendance status">
                  <option value="all">All attendance</option>
                  <option value="inside">Currently inside</option>
                  <option value="exited">Checked out</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PPE_ITEMS.map(({ key, label }) => (
                <label key={key} className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{label} filter</span>
                  <select
                    value={ppeFilters[key]}
                    onChange={(event) => setPpeFilters((previous) => ({ ...previous, [key]: event.target.value as typeof previous[typeof key] }))}
                    className={`w-full ${selectClass}`}
                    aria-label={`${label} PPE filter`}
                  >
                    <option value="all">Any status</option>
                    <option value="present">{label} present</option>
                    <option value="missing">No {label.toLowerCase()}</option>
                    <option value="uncertain">Uncertain</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredRows.length}</span> of <span className="font-semibold text-foreground">{rows.length}</span> records
              </p>
              {hasPpeFilters || search || attendanceFilter !== "all" ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <FilterX className="mr-2 h-4 w-4" /> Clear all filters
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Loading today's attendance...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No matching attendance records</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No worker entry has been recorded today. Register or mark a worker's entry first."
                  : "Try changing or clearing the filters."}
              </p>
              {rows.length === 0 && (
                <Button className="mt-4" onClick={() => navigate("/safety")}>Go to Analyze Image &amp; Add Attendance</Button>
              )}
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
                    <th className="px-4 py-3 font-medium">Helmet</th>
                    <th className="px-4 py-3 font-medium">Safety Vest</th>
                    <th className="px-4 py-3 font-medium">Gloves</th>
                    <th className="px-4 py-3 font-medium">Safety Boots</th>
                    <th className="px-4 py-3 font-medium">Safety Goggles</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.employee_id}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTime(row.entry_time)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatTime(row.exit_time)}</td>
                      <td className="px-4 py-3">
                        {row.exit_time
                          ? <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Checked Out</span>
                          : <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">Inside</span>}
                      </td>
                      <td className="px-4 py-3"><PPECell label="Helmet" status={row.helmet} /></td>
                      <td className="px-4 py-3"><PPECell label="Vest" status={row.safety_vest} /></td>
                      <td className="px-4 py-3"><PPECell label="Gloves" status={row.gloves} /></td>
                      <td className="px-4 py-3"><PPECell label="Boots" status={row.safety_boots} /></td>
                      <td className="px-4 py-3"><PPECell label="Goggles" status={row.safety_goggles} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="mt-4 text-xs text-muted-foreground">
          PPE status comes from the worker registry's saved analysis. Visual AI results are estimates and should be verified by a safety supervisor.
        </p>
      </main>
    </div>
  );
}
