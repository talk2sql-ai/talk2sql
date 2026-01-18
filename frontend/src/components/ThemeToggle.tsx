import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
    className?: string;
    id?: string;
}

export function ThemeToggle({ className, id }: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            id={id}
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={cn("h-9 w-9 rounded-lg hover:bg-muted transition-colors", className)}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <div className="relative h-5 w-5">
                <Sun
                    className={cn(
                        "h-5 w-5 transition-all duration-300 absolute inset-0",
                        theme === 'dark' ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                    )}
                />
                <Moon
                    className={cn(
                        "h-5 w-5 transition-all duration-300 absolute inset-0 text-primary",
                        theme === 'dark' ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                    )}
                />
            </div>
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
