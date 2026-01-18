import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Database,
    Code,
    Wrench,
    HelpCircle,
    Sparkles,
    LogOut,
    Menu,
    X,
    User,
    Zap,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '../ThemeToggle';

interface SidebarLayoutProps {
    children: ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Sidebar collapse state with localStorage persistence
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const stored = localStorage.getItem('sidebarCollapsed');
        return stored === 'true';
    });

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.toString());
    }, [isSidebarCollapsed]);

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

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden transition-colors duration-300">
            {/* Sidebar - Desktop */}
            <aside className={cn(
                "hidden lg:flex flex-col border-r border-border bg-card/50 backdrop-blur-md transition-all duration-300",
                isSidebarCollapsed ? "w-20" : "w-64"
            )}>
                <div className={cn("p-6 flex items-center", isSidebarCollapsed ? "justify-center" : "justify-between")}>
                    {!isSidebarCollapsed && (
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
                    )}
                    {isSidebarCollapsed && (
                        <div className="p-2 rounded-lg gradient-primary glow-primary-sm">
                            <Database className="h-6 w-6 text-primary-foreground" />
                        </div>
                    )}
                </div>

                {/* Collapse Toggle Button */}
                <div className={cn("px-4 mb-2", isSidebarCollapsed ? "flex justify-center" : "flex justify-end")}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                isActive
                                    ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                isSidebarCollapsed && "justify-center px-2"
                            )}
                            title={isSidebarCollapsed ? item.name : undefined}
                        >
                            <item.icon className={cn(
                                "h-5 w-5 transition-transform group-hover:scale-110",
                                "text-current shrink-0"
                            )} />
                            {!isSidebarCollapsed && <span>{item.name}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-border mt-auto space-y-2">
                    <NavLink
                        to="/profile"
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group mb-0",
                            isActive
                                ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            isSidebarCollapsed && "justify-center px-2"
                        )}
                        title={isSidebarCollapsed ? "Profile" : undefined}
                    >
                        <User className={cn(
                            "h-5 w-5 transition-transform group-hover:scale-110",
                            "text-current shrink-0"
                        )} />
                        {!isSidebarCollapsed && <span>Profile</span>}
                    </NavLink>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                            isSidebarCollapsed ? "justify-center px-2" : "justify-start"
                        )}
                        onClick={handleSignOut}
                        title={isSidebarCollapsed ? "Sign Out" : undefined}
                    >
                        <LogOut className={cn("h-4 w-4 shrink-0", !isSidebarCollapsed && "mr-2")} />
                        {!isSidebarCollapsed && "Sign Out"}
                    </Button>
                </div>
            </aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Top Header */}
                <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 transition-colors duration-300 z-40">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden h-9 w-9"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>

                        <div className="flex items-center gap-2 lg:hidden">
                            <div className="p-1.5 rounded-lg gradient-primary">
                                <Database className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="font-bold text-sm">Talk2SQL.ai</span>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-3">
                        <ThemeToggle id="theme-toggle-header" />
                    </div>
                </header>

                <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                    {children}
                </main>
            </div>

            {/* Mobile Drawer (Overlay) */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="h-full flex flex-col">
                        {/* Mobile drawer header */}
                        <div className="h-14 border-b border-border/50 flex items-center justify-between px-6">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg gradient-primary">
                                    <Database className="h-4 w-4 text-primary-foreground" />
                                </div>
                                <span className="font-bold text-sm">Talk2SQL.ai</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Mobile drawer content */}
                        <nav className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            <NavLink
                                to="/profile"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-4 text-lg font-medium py-3 border-b border-border"
                            >
                                <User className="h-6 w-6 text-primary" />
                                Profile
                            </NavLink>
                            <Button className="w-full mt-8" variant="destructive" onClick={handleSignOut}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Sign Out
                            </Button>
                        </nav>
                    </div>
                </div>
            )}
        </div>
    );
}
