import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, Upload, ArrowRight, SkipForward, Save } from 'lucide-react';
import { toast } from 'sonner';
import SidebarLayout from '@/components/layout/SidebarLayout';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function OnboardingPage() {
    const { user } = useAuth();

    // Get email synchronously from persistent storage or context to avoid flickering
    const userEmail = (() => {
        const savedUser = sessionStorage.getItem('auth_user');
        if (savedUser) {
            try {
                return JSON.parse(savedUser).email;
            } catch (e) {
                console.error('Error parsing auth_user:', e);
            }
        }
        return user?.email || 'default';
    })();

    const [database, setDatabase] = useState(() => localStorage.getItem(`selected_db_${userEmail}`) || 'mysql');
    const [schema, setSchema] = useState(() => localStorage.getItem(`last_schema_${userEmail}`) || '');
    const [isLoading, setIsLoading] = useState(false);
    const [onboardingCompleted, setOnboardingCompleted] = useState(() => localStorage.getItem(`onboarding_completed_${userEmail}`) === 'true');
    const navigate = useNavigate();

    // Load user-specific data when userEmail changes
    useEffect(() => {
        const db = localStorage.getItem(`selected_db_${userEmail}`) || 'mysql';
        const sc = localStorage.getItem(`last_schema_${userEmail}`) || '';
        const completed = localStorage.getItem(`onboarding_completed_${userEmail}`) === 'true';

        setDatabase(db);
        setSchema(sc);
        setOnboardingCompleted(completed);

        if (sc && completed) {
            const syncSchema = async () => {
                try {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                    await fetch(`${apiUrl}/upload-schema`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            db_key: 'default',
                            schema_sql: sc,
                            database_type: db,
                        }),
                    });
                } catch (err) {
                    console.error('Auto-sync failed:', err);
                }
            };
            syncSchema();
        }
    }, [userEmail]);

    const handleComplete = async () => {
        if (!schema.trim()) {
            toast.error('Please provide a schema or skip for now');
            return;
        }

        setIsLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/upload-schema`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    db_key: 'default', // Using default for now
                    schema_sql: schema,
                    database_type: database, // Send this so backend knows what dialect to expect/use if needed
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to upload schema');
            }

            toast.success(onboardingCompleted ? 'Schema updated!' : 'Onboarding completed!');
            localStorage.setItem(`onboarding_completed_${userEmail}`, 'true');
            localStorage.setItem(`selected_db_${userEmail}`, database);
            localStorage.setItem(`last_schema_${userEmail}`, schema);
            setOnboardingCompleted(true);
            if (!onboardingCompleted) {
                navigate('/dashboard');
            }
        } catch (err) {
            toast.error('Error uploading schema');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        localStorage.setItem(`onboarding_completed_${userEmail}`, 'true');
        localStorage.setItem(`selected_db_${userEmail}`, database);
        navigate('/dashboard');
    };

    if (onboardingCompleted) {
        return (
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Database Schema</h1>
                            <p className="text-muted-foreground mt-1 text-sm">Configure your database connection and DDL schema.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <Card className="border-border/50 bg-card/50 shadow-lg glow-primary-sm overflow-hidden">
                            <CardHeader className="border-b border-border/50 pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Database className="h-5 w-5 text-primary" />
                                    Connection Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Database Type</Label>
                                    <Select value={database} onValueChange={setDatabase}>
                                        <SelectTrigger className="w-full md:w-[240px] bg-muted/30">
                                            <SelectValue placeholder="Select Database" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mysql">MySQL 8.0+</SelectItem>
                                            <SelectItem value="postgresql">PostgreSQL 14+</SelectItem>
                                            <SelectItem value="sqlite">SQLite 3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/50 bg-card/50 shadow-lg glow-primary-sm overflow-hidden min-h-[500px] flex flex-col">
                            <CardHeader className="border-b border-border/50 pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Upload className="h-5 w-5 text-primary" />
                                    DDL Schema
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-1">
                                <Textarea
                                    placeholder="CREATE TABLE users ( id INT PRIMARY KEY, ... );"
                                    className="min-h-[400px] h-full font-mono text-sm bg-transparent border-none focus-visible:ring-0 resize-none p-6"
                                    value={schema}
                                    onChange={(e) => setSchema(e.target.value)}
                                />
                            </CardContent>
                            <CardFooter className="flex justify-end border-t border-border/50 p-4 bg-muted/10">
                                <Button
                                    onClick={handleComplete}
                                    disabled={isLoading}
                                    className="gradient-primary text-primary-foreground glow-primary-sm min-w-[160px]"
                                >
                                    {isLoading ? (
                                        'Updating...'
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Update Workspace
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-background">
            <div className="min-h-screen flex items-center justify-center px-4 gradient-hero overflow-y-auto py-12">
                <div className="w-full max-w-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <div className="p-3 rounded-xl gradient-primary glow-primary-sm">
                                <Database className="h-8 w-8 text-primary-foreground" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-3xl leading-none">
                                    Talk2SQL<span className="text-primary">.ai</span>
                                </span>
                                <span className="text-xs font-bold text-muted-foreground/50 tracking-[0.2em] mt-1 ml-0.5">
                                    BETA
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Setup Your Workspace</h1>
                        <p className="text-muted-foreground mt-2">Choose your database and provide your schema to get started.</p>
                    </div>

                    <Card className="border-border/50 shadow-2xl bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Onboarding</CardTitle>
                            <CardDescription>Step 1: Database & Schema</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-4">
                                <Label className="text-base font-semibold">1. Choose your Database Engine</Label>
                                <RadioGroup
                                    value={database}
                                    onValueChange={setDatabase}
                                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                >
                                    <div>
                                        <RadioGroupItem value="mysql" id="mysql" className="peer sr-only" />
                                        <Label
                                            htmlFor="mysql"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                        >
                                            <Database className="mb-3 h-6 w-6" />
                                            <span className="font-medium">MySQL</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="postgresql" id="postgresql" className="peer sr-only" />
                                        <Label
                                            htmlFor="postgresql"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                        >
                                            <Database className="mb-3 h-6 w-6" />
                                            <span className="font-medium">PostgreSQL</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="sqlite" id="sqlite" className="peer sr-only" />
                                        <Label
                                            htmlFor="sqlite"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                        >
                                            <Database className="mb-3 h-6 w-6" />
                                            <span className="font-medium">SQLite</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    2. Upload or Paste Schema (DDL)
                                </Label>
                                <Textarea
                                    placeholder="CREATE TABLE users ( id INT PRIMARY KEY, ... );"
                                    className="min-h-[200px] font-mono text-sm bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary"
                                    value={schema}
                                    onChange={(e) => setSchema(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste your SQL DDL statements (CREATE TABLE, etc.) to help the AI understand your data structure.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border/50">
                            <Button
                                variant="outline"
                                className="w-full flex items-center gap-2"
                                onClick={handleSkip}
                            >
                                <SkipForward className="h-4 w-4" />
                                Skip for now
                            </Button>
                            <Button
                                className="w-full gradient-primary text-primary-foreground glow-primary-sm flex items-center gap-2"
                                onClick={handleComplete}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Processing...' : 'Complete Setup'}
                                {!isLoading && <ArrowRight className="h-4 w-4" />}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
