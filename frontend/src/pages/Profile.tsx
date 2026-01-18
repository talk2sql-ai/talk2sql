import SidebarLayout from "@/components/layout/SidebarLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Calendar } from "lucide-react";

export default function Profile() {
    const { user } = useAuth();

    return (
        <div className="flex-1 p-8 overflow-y-auto transition-colors duration-300">
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
                </div>

                <Card className="border-border/50 bg-card/50 shadow-lg glow-primary-sm">
                    <CardHeader className="border-b border-border/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg">
                                {user?.email?.[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">{user?.email?.split('@')[0]}</h3>
                                <p className="text-sm text-muted-foreground">Free Plan Member</p>
                            </div>
                        </div>

                        <div className="grid gap-4 pt-4">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/20">
                                <Mail className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</p>
                                    <p className="text-sm font-medium">{user?.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/20">
                                <Shield className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Status</p>
                                    <p className="text-sm font-medium">Verified</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/20">
                                <Calendar className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Member Since</p>
                                    <p className="text-sm font-medium">January 2026</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
