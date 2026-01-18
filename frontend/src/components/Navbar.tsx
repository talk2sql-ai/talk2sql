import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Database, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50 transition-colors duration-300">
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

          {/* Navigation & Controls */}
          <div className="flex items-center gap-2 md:gap-6">
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Dashboard
              </Link>
              <a
                href="#docs"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Docs
              </a>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle id="theme-toggle-navbar" className="hidden sm:flex" />

              <Link to="/signin" className="hidden sm:block">
                <Button className="gradient-primary text-primary-foreground glow-primary-sm">
                  Get Started
                </Button>
              </Link>

              {/* Mobile Menu Button */}
              <button
                id="mobile-menu-toggle"
                className="md:hidden p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-4">
              <Link
                to="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors py-2 px-2 hover:bg-muted rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <a
                href="#docs"
                className="text-muted-foreground hover:text-foreground transition-colors py-2 px-2 hover:bg-muted rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </a>

              <div className="flex items-center justify-between pt-4 border-t border-border px-2">
                <span className="text-sm font-medium text-muted-foreground">Theme</span>
                <ThemeToggle id="theme-toggle-mobile" />
              </div>

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
