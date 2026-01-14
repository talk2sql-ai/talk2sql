import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, Upload, ArrowRight, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
    const [database, setDatabase] = useState('mysql');
    const [schema, setSchema] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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

            toast.success('Onboarding completed!');
            localStorage.setItem('onboarding_completed', 'true');
            localStorage.setItem('selected_db', database);
            navigate('/dashboard');
        } catch (err) {
            toast.error('Error uploading schema');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('selected_db', database);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 gradient-hero">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <div className="p-3 rounded-xl gradient-primary glow-primary-sm">
                            <Database className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-3xl">
                            Talk2SQL<span className="text-primary">.ai</span>
                        </span>
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
    );
}
