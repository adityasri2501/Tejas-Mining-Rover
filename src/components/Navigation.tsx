import { Link, useLocation } from "react-router-dom";
import { Bot, Camera, ExternalLink } from "lucide-react";
import { ROVER_URL } from "@/lib/rover";

const Navigation = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-header border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">MS</span>
              </div>
              <span className="text-header-foreground font-bold text-xl">MineScan</span>
            </Link>
            
            <nav className="flex gap-1">
              <a
                href={ROVER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-header-foreground hover:bg-secondary"
              >
                <Bot className="w-4 h-4" />
                Rover
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Link
                to="/safety"
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  isActive("/safety")
                    ? "bg-primary text-primary-foreground"
                    : "text-header-foreground hover:bg-secondary"
                }`}
              >
                <Camera className="w-4 h-4" />
                Safety Analysis
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
