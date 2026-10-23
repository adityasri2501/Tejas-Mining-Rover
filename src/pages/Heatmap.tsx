import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle, TrendingUp, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HazardPoint {
  id: string;
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
  category: string;
  site: string;
  area: string;
  shift: string;
  date: string;
  description: string;
}

const Heatmap = () => {
  const [hazards, setHazards] = useState<HazardPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    site: "all",
    area: "all",
    shift: "all",
    category: "all",
  });

  useEffect(() => {
    fetchHazardData();
  }, [filters]);

  const fetchHazardData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("heatmap-data", {
        body: { filters },
      });

      if (error) throw error;
      setHazards(data.hazards || []);
    } catch (error) {
      console.error("Error fetching hazard data:", error);
      toast.error("Failed to load hazard data");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-destructive";
      case "medium":
        return "bg-warning";
      case "low":
        return "bg-success";
      default:
        return "bg-muted";
    }
  };

  const stats = {
    total: hazards.length,
    high: hazards.filter((h) => h.severity === "high").length,
    medium: hazards.filter((h) => h.severity === "medium").length,
    low: hazards.filter((h) => h.severity === "low").length,
  };

  const handleExport = () => {
    const csvContent = [
      ["ID", "Site", "Area", "Category", "Severity", "Date", "Description"],
      ...hazards.map((h) => [h.id, h.site, h.area, h.category, h.severity, h.date, h.description]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minescan-hazards-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Data exported successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Risk Heatmap Dashboard</h1>
          <p className="text-muted-foreground">Monitor hazards and safety incidents across all sites</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Hazards</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <MapPin className="w-8 h-8 text-primary" />
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">High Risk</p>
                <p className="text-3xl font-bold text-destructive">{stats.high}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Medium Risk</p>
                <p className="text-3xl font-bold text-warning">{stats.medium}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </Card>
          
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Low Risk</p>
                <p className="text-3xl font-bold text-success">{stats.low}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 bg-card border-border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Site</label>
              <Select value={filters.site} onValueChange={(value) => setFilters({ ...filters, site: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  <SelectItem value="site-a">Site A</SelectItem>
                  <SelectItem value="site-b">Site B</SelectItem>
                  <SelectItem value="site-c">Site C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Area</label>
              <Select value={filters.area} onValueChange={(value) => setFilters({ ...filters, area: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  <SelectItem value="pit">Open Pit</SelectItem>
                  <SelectItem value="underground">Underground</SelectItem>
                  <SelectItem value="processing">Processing Plant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Shift</label>
              <Select value={filters.shift} onValueChange={(value) => setFilters({ ...filters, shift: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="day">Day Shift</SelectItem>
                  <SelectItem value="night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Category</label>
              <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="ppe">PPE Violations</SelectItem>
                  <SelectItem value="equipment">Equipment Issues</SelectItem>
                  <SelectItem value="structural">Structural Concerns</SelectItem>
                  <SelectItem value="spills">Spills/Leaks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleExport} className="bg-primary hover:bg-primary/90">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </Card>

        {/* Map Placeholder */}
        <Card className="p-6 bg-card border-border mb-8">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-background/50 to-muted" />
            <div className="relative z-10 text-center">
              <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2">Interactive Map View</p>
              <p className="text-sm text-muted-foreground">Hazard locations displayed with color-coded markers</p>
            </div>
            
            {/* Mock hazard markers */}
            {hazards.slice(0, 5).map((hazard, idx) => (
              <div
                key={hazard.id}
                className={`absolute w-4 h-4 rounded-full ${getSeverityColor(hazard.severity)} border-2 border-background shadow-lg animate-pulse`}
                style={{
                  left: `${20 + idx * 15}%`,
                  top: `${30 + idx * 10}%`,
                }}
              />
            ))}
          </div>
        </Card>

        {/* Hazard List */}
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground mb-4">Recent Hazards</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading hazards...</p>
          ) : hazards.length === 0 ? (
            <p className="text-muted-foreground">No hazards found with current filters</p>
          ) : (
            <div className="space-y-3">
              {hazards.slice(0, 10).map((hazard) => (
                <div key={hazard.id} className="p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(hazard.severity)}`} />
                        <span className="font-semibold text-foreground">{hazard.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {hazard.site} - {hazard.area}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{hazard.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{hazard.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Heatmap;
