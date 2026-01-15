import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryInput } from '@/components/dashboard/QueryInput';
import { QueryOutput } from '@/components/dashboard/QueryOutput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Loader2, Code2, Sparkles, Terminal, X } from 'lucide-react';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [operation, setOperation] = useState('generate');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<{ sql?: string; explanation?: string; suggestions?: { sql: string; title: string }[] } | null>(null);
  const [error, setError] = useState('');
  const [numSuggestions, setNumSuggestions] = useState(5);

  useEffect(() => {
    const op = searchParams.get('op');
    if (op) {
      setOperation(op);
      // Clear state when switching operations
      setInput('');
      setOutput(null);
      setError('');
    }
  }, [searchParams]);

  const handleRunQuery = async () => {
    if (!input.trim()) {
      setError('Please enter a query or description');
      return;
    }

    setError('');
    setIsLoading(true);
    setOutput(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      // Determine endpoint based on operation
      let endpoint = '/generate-sql';
      if (operation === 'fix') endpoint = '/fix-sql';
      if (operation === 'explain') endpoint = '/explain-sql';
      if (operation === 'optimize') endpoint = '/optimize-sql';
      if (operation === 'suggest') endpoint = '/suggest-next';

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: operation === 'generate' ? input : undefined,
          sql: operation !== 'generate' ? input : undefined,
          db_key: 'default',
          max_rows: 100,
          max_suggestions: operation === 'suggest' ? numSuggestions : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to process query');
      }

      const data = await response.json();
      if (operation === 'suggest') {
        setOutput({
          suggestions: data.queries || [],
          explanation: data.notes || '',
        });
      } else {
        setOutput({
          sql: data.sql || '',
          explanation: data.explanation || '',
        });
      }
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-hidden">
      {/* Top Pane: Generate / Input Section */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 lg:max-w-5xl lg:mx-auto w-full">


        <Card className="border-border/50 bg-card/50 shadow-lg glow-primary-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              {operation === 'generate' ? 'Describe your query' :
                operation === 'fix' ? 'SQL to Fix' :
                  operation === 'explain' ? 'SQL to Explain' :
                    operation === 'optimize' ? 'SQL to Optimize' :
                      operation === 'suggest' ? 'SQL for AI Suggestions' :
                        'SQL to process'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              <QueryInput
                value={input}
                onChange={setInput}
                operation={operation}
              />

              {operation === 'suggest' && (
                <div className="mt-4 flex items-center gap-4">
                  <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    Number of Suggestions:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={numSuggestions}
                    onChange={(e) => setNumSuggestions(parseInt(e.target.value) || 5)}
                    className="w-20 bg-muted/30 border border-border/50 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                  <X className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleRunQuery}
                  disabled={isLoading}
                  className="gradient-primary text-primary-foreground glow-primary-sm min-w-[140px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run {operation}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Pane: Query Editor / Output Section */}
      <div className="h-[400px] border-t border-primary/20 bg-background p-6 shadow-2xl relative z-10">
        <div className="lg:max-w-5xl lg:mx-auto w-full h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              {operation === 'explain' ? 'Explanation' : 'Query Editor'}
            </h2>
            {output?.sql && (
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(output.sql)}>
                Copy SQL
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border border-primary/20 bg-white">
            <QueryOutput
              sql={output?.sql || ''}
              explanation={output?.explanation}
              suggestions={output?.suggestions}
              isLoading={isLoading}
              operation={operation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
