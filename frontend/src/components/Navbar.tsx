import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Database, Moon, Sun, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg gradient-primary glow-primary-sm">
              <Database className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg leading-none">
                Talk2SQL<span className="text-primary">.ai</span>
              </span>
              <span className="text-[10px] font-bold text-muted-foreground/50 tracking-[0.2em] mt-0.5 ml-0.5">
                BETA
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="#docs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </a>


            <Link to="/signin">
              <Button className="gradient-primary text-primary-foreground glow-primary-sm">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link
                to="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <a
                href="#docs"
                className="text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Docs
              </a>


              <Link to="/signin" onClick={() => setMobileMenuOpen(false)}>
                <Button className="gradient-primary text-primary-foreground w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
