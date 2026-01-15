import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: January 11, 2026</p>
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using Talk2SQL.ai, you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground">
              Talk2SQL.ai provides an AI-powered service that converts natural language queries into SQL statements. 
              The service is provided "as is" and we make no guarantees about the accuracy of generated SQL queries.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. User Responsibilities</h2>
            <p className="text-muted-foreground">
              You are responsible for reviewing and testing all generated SQL queries before executing them 
              on your databases. You agree not to use our service for any illegal or unauthorized purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Talk2SQL.ai shall not be liable for any damages arising from the use of generated SQL queries, 
              including but not limited to data loss, system downtime, or security breaches.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Modifications</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. Continued use of the service 
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, please contact us at legal@talk2sql.ai.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
