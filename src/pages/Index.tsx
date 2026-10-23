import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROVER_URL } from "@/lib/rover";
import {
  Camera,
  Bot,
  ExternalLink,
  CalendarCheck,
  ClipboardEdit,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const Index = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    navigate("/login", { replace: true });
  };

  const cards = [
    {
      title: "Analyze Image & Add Attendance",
      description:
        "Analyze worker photos, check visible PPE and register workers with attendance.",
      icon: Camera,
      action: () => navigate("/safety"),
      buttonText: "Analyze & Register",
    },
    {
      title: "Rover",
      description:
        "Open the existing MineScan rover dashboard for remote monitoring.",
      icon: Bot,
      action: () => window.open(ROVER_URL, "_blank", "noopener,noreferrer"),
      buttonText: "Open Rover",
      external: true,
    },
    {
      title: "Today's Attendance",
      description:
        "View today's worker attendance, entry time, exit time and current status.",
      icon: CalendarCheck,
      action: () => navigate("/attendance"),
      buttonText: "View Attendance",
    },
    {
      title: "Modify Attendance",
      description:
        "Review existing attendance records and make authorized corrections.",
      icon: ClipboardEdit,
      action: () => navigate("/modify-attendance"),
      buttonText: "Modify Records",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-header">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary">
              <span className="text-xl font-bold text-white">MS</span>
            </div>

            <div>
              <h1 className="text-xl font-bold text-header-foreground">
                MineScan
              </h1>
              <p className="text-xs text-muted-foreground">
                Mining Safety Dashboard
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-medium">
              Mining Safety Platform
            </span>
          </div>

          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
            MineScan Dashboard
          </h2>

          <p className="max-w-2xl text-muted-foreground">
            Manage worker safety, monitor attendance and access the rover from
            one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="flex min-h-[280px] flex-col rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>

                <h3 className="mb-3 text-lg font-bold text-foreground">
                  {card.title}
                  {"external" in card && card.external && (
                    <ExternalLink className="ml-2 inline h-4 w-4" />
                  )}
                </h3>

                <p className="mb-6 flex-1 text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>

                <Button className="w-full" onClick={card.action}>
                  {card.buttonText}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          MineScan · Worker Safety & Attendance Management
        </p>
      </main>
    </div>
  );
};

export default Index;
