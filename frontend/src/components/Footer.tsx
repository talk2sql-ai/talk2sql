import { Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md gradient-primary">
              <Database className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-muted-foreground text-sm">
              Talk2SQL.ai — Turn English into SQL using AI
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
