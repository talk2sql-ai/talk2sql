import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Database,
    Code,
    Wrench,
    HelpCircle,
    Sparkles,
    LayoutDashboard,
    LogOut,
    ChevronRight,
    Menu,
    X,
    User,
    Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarLayoutProps {
    children: ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { name: 'Schema', path: '/onboarding', icon: Database },
        { name: 'Generate', path: '/dashboard?op=generate', icon: Code },
        { name: 'Fix SQL', path: '/dashboard?op=fix', icon: Wrench },
        { name: 'Explain', path: '/dashboard?op=explain', icon: HelpCircle },
        { name: 'Optimize', path: '/dashboard?op=optimize', icon: Zap },
        { name: 'AI Suggestions', path: '/dashboard?op=suggest', icon: Sparkles },
    ];

    const handleSignOut = () => {
        signOut();
        navigate('/signin');
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-md">
                <div className="p-6">
                    <NavLink to="/" className="flex items-center gap-2 group">
                        <div className="p-2 rounded-lg gradient-primary glow-primary-sm shrink-0">
                            <Database className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-xl tracking-tight">
                                Talk2SQL<span className="text-primary">.ai</span>
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground/50 tracking-[0.2em] -mt-1 ml-0.5">
                                BETA
                            </span>
                        </div>
                    </NavLink>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                isActive
                                    ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn(
                                "h-5 w-5 transition-transform group-hover:scale-110",
                                "text-current"
                            )} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-border mt-auto">
                    <NavLink
                        to="/profile"
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group mb-0",
                            isActive
                                ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <User className={cn(
                            "h-5 w-5 transition-transform group-hover:scale-110",
                            "text-current"
                        )} />
                        <span>Profile</span>
                    </NavLink>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={handleSignOut}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Mobile Header & Menu */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/80 backdrop-blur-md z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg gradient-primary">
                        <Database className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="font-bold">Talk2SQL</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </Button>
            </div>

            {/* Mobile Drawer */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-md pt-20 px-6">
                    <nav className="space-y-4">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-4 text-lg font-medium py-3 border-b border-border"
                            >
                                <item.icon className="h-6 w-6 text-primary" />
                                {item.name}
                            </NavLink>
                        ))}
                        <Button className="w-full mt-8" variant="destructive" onClick={handleSignOut}>
                            Sign Out
                        </Button>
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden pt-16 md:pt-0">
                {children}
            </main>
        </div>
    );
}
