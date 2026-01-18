import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SplitPaneLayoutProps {
    leftPane: ReactNode;
    rightPane: ReactNode;
    className?: string;
}

/**
 * Responsive split-pane layout component for dashboard pages.
 * - Mobile (<1024px): Stacked layout (left on top, right below)
 * - Desktop (>=1024px): Side-by-side layout with 50/50 split
 */
export function SplitPaneLayout({ leftPane, rightPane, className }: SplitPaneLayoutProps) {
    return (
        <div className={cn(
            "h-full flex flex-col lg:grid lg:grid-cols-2 gap-6 p-6 overflow-hidden",
            className
        )}>
            {/* Left Pane - Input/Config Section */}
            <div className="flex flex-col min-h-0 lg:overflow-y-auto">
                {leftPane}
            </div>

            {/* Right Pane - Output/Editor Section */}
            <div className="flex flex-col min-h-0 flex-1 lg:flex-none lg:overflow-hidden">
                {rightPane}
            </div>
        </div>
    );
}
