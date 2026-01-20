import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryInput } from '@/components/dashboard/QueryInput';
import { QueryOutput } from '@/components/dashboard/QueryOutput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Loader2, Code2, Terminal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SplitPaneLayout } from '@/components/layout/SplitPaneLayout';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [operation, setOperation] = useState('generate');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<{
    sql?: string;
    explanation?: string;
    suggestions?: { sql: string; title: string }[];
  } | null>(null);
  const [error, setError] = useState('');

  // Source of truth for the input field (string to allow temporary empty/invalid states)
  const [numSuggestionsInput, setNumSuggestionsInput] = useState('5');
  // Tracks if the user has focused and then blurred the input at least once
  const [numSuggestionsWasValidated, setNumSuggestionsWasValidated] = useState(false);

  // Get database type from localStorage (set in OnboardingPage)
  const [databaseType, setDatabaseType] = useState(() => {
    const savedUser = sessionStorage.getItem('auth_user');
    let userEmail = 'default';
    if (savedUser) {
      try {
        userEmail = JSON.parse(savedUser).email;
      } catch (e) {
        console.error('Error parsing auth_user:', e);
      }
    }
    return localStorage.getItem(`selected_db_${userEmail}`) || 'mysql';
  });

  useEffect(() => {
    const op = searchParams.get('op');
    if (op) {
      setOperation(op);
      setInput('');
      setOutput(null);
      setError('');
    }
  }, [searchParams]);

  /**
   * Helper to parse and clamp suggestions.
   * Returns a valid integer within [1, 10].
   */
  const getValidatedSuggestions = useCallback((val: string) => {
    const parsed = parseInt(val, 10);
    if (val === '' || isNaN(parsed)) return 5;
    return Math.max(1, Math.min(10, parsed));
  }, []);

  const handleRunQuery = async () => {
    if (!input.trim()) {
      setError('Please enter a query or description');
      return;
    }

    setError('');
    setIsLoading(true);
    setOutput(null);

    // Trigger validation logic for UI before running
    const finalSuggestionsValue = getValidatedSuggestions(numSuggestionsInput);
    setNumSuggestionsInput(finalSuggestionsValue.toString());
    setNumSuggestionsWasValidated(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      let endpoint = '/api/generate-sql';
      if (operation === 'fix') endpoint = '/api/fix-sql';
      if (operation === 'explain') endpoint = '/api/explain-sql';
      if (operation === 'optimize') endpoint = '/api/optimize-sql';
      if (operation === 'suggest') endpoint = '/api/suggest-next';


      const payload: any = {
        db_key: 'default',
        max_rows: 100,
        database_type: databaseType, // Include database type for dialect-aware generation
      };

      if (operation === 'generate') payload.question = input;
      else payload.sql = input;

      if (operation === 'suggest') {
        // Double-check validation for API safety
        payload.max_suggestions = finalSuggestionsValue;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  /**
   * Handles validation purely on blur to prevent "inline red errors" while typing.
   */
  const handleNumSuggestionsBlur = () => {
    const validated = getValidatedSuggestions(numSuggestionsInput);
    setNumSuggestionsInput(validated.toString());
    setNumSuggestionsWasValidated(true);
  };

  // Logic for visual error state (only after blur/submit)
  const isCurrentlyInvalid = numSuggestionsInput === '' ||
    parseInt(numSuggestionsInput, 10) < 1 ||
    parseInt(numSuggestionsInput, 10) > 10;

  const showVisualError = numSuggestionsWasValidated && isCurrentlyInvalid;

  // Left pane: Input/Config section
  const leftPane = (
    <Card className="border-border/50 bg-card/50 shadow-lg glow-primary-sm overflow-hidden backdrop-blur-sm transition-colors duration-300 h-fit">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          {operation === 'generate'
            ? 'Describe your query'
            : operation === 'fix'
              ? 'SQL to Fix'
              : operation === 'explain'
                ? 'SQL to Explain'
                : operation === 'optimize'
                  ? 'SQL to Optimize'
                  : operation === 'suggest'
                    ? 'SQL for AI Suggestions'
                    : 'SQL to process'}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="p-4">
          <QueryInput value={input} onChange={setInput} operation={operation} />

          {operation === 'suggest' && (
            <div className="mt-4 flex items-center gap-4">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Number of Suggestions:
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={numSuggestionsInput}
                  onChange={(e) => {
                    // Clear validation flag when typing to remove error styling immediately
                    setNumSuggestionsWasValidated(false);

                    // Allow only digits or empty string to fix backspace/deleting issue
                    if (e.target.value === '' || /^\d*$/.test(e.target.value)) {
                      setNumSuggestionsInput(e.target.value);
                    }
                  }}
                  onBlur={handleNumSuggestionsBlur}
                  className={cn(
                    "w-20 bg-muted/30 border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 transition-all duration-200 text-foreground",
                    showVisualError
                      ? "border-destructive focus:ring-destructive ring-1 ring-destructive"
                      : "border-border/50 focus:ring-primary"
                  )}
                />
              </div>
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
  );

  // Right pane: Output/Editor section
  const rightPane = (
    <div className="h-full flex flex-col min-h-0 border border-primary/20 bg-background/30 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden transition-colors duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          {operation === 'explain' ? 'Explanation' : 'Query Editor'}
        </h2>

        {output?.sql && (
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(output.sql || '')} className="border-border hover:bg-muted">
            Copy SQL
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-card/80 backdrop-blur-sm">
        <QueryOutput
          sql={output?.sql || ''}
          explanation={output?.explanation}
          suggestions={output?.suggestions}
          isLoading={isLoading}
          operation={operation}
        />
      </div>
    </div>
  );

  return (
    <SplitPaneLayout
      leftPane={leftPane}
      rightPane={rightPane}
    />
  );
}
