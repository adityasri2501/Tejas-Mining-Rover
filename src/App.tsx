import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import Index from "./pages/Index";
import Heatmap from "./pages/Heatmap";
import Safety from "./pages/Safety";
import Attendance from "./pages/Attendance";
import ModifyAttendance from "./pages/ModifyAttendance";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({
  session,
}: {
  session: Session | null;
}) {
  const location = useLocation();

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        setLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.error("Session check failed:", error);
          setSession(null);
        } else {
          setSession(data.session);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error("Unable to check login session:", error);

        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Checking login session...
      </div>
    );
  }

  return (
    <Routes>
      {/* Login page */}
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* All dashboard pages require authentication */}
      <Route element={<ProtectedLayout session={session} />}>
        {/* Dashboard after login */}
        <Route path="/" element={<Index />} />

        {/* Existing pages */}
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/safety" element={<Safety />} />

        {/* Today's Attendance */}
        <Route path="/attendance" element={<Attendance />} />

        {/* Modify Attendance */}
        <Route
          path="/modify-attendance"
          element={<ModifyAttendance />}
        />
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
