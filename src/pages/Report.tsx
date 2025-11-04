import ReportForm from "@/components/ReportForm";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Lapor
          </h1>
          <Link to="/auth">
            <Button variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-2" />
              Admin Login
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold">
              Voice Your Concerns
            </h2>
            <p className="text-lg text-muted-foreground">
              Help us serve you better by reporting issues or sharing your aspirations
            </p>
          </div>

          <ReportForm />

          <div className="text-center text-sm text-muted-foreground">
            <p>Your reports are important to us and will be reviewed promptly.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
