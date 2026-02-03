import ReactMarkdown from "react-markdown";
import { Copy, Download, FileText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlanPreviewProps {
  plan: string;
  isGenerating: boolean;
}

export function PlanPreview({ plan, isGenerating }: PlanPreviewProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan);
      toast.success("Plan copié dans le presse-papier !");
    } catch {
      toast.error("Impossible de copier le plan");
    }
  };

  const handleDownloadPDF = () => {
    // Simulated PDF download - in production, use a library like jspdf or html2pdf
    toast.info("Export PDF simulé - fonctionnalité à venir !");
    
    // For now, download as text file
    const blob = new Blob([plan], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-cabaret.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex-1 border-border/50 bg-card/50 backdrop-blur flex flex-col min-h-0">
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cabaret-gold to-cabaret-purple flex items-center justify-center">
              <FileText className="w-4 h-4 text-background" />
            </div>
            Plan de Soirée
          </CardTitle>
          {plan && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-border hover:bg-primary/10 hover:text-primary"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="border-border hover:bg-accent/10 hover:text-accent"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium animate-pulse">Génération en cours...</p>
              <p className="text-sm mt-2">Notre IA prépare votre plan de soirée</p>
            </div>
          ) : plan ? (
            <div className={cn(
              "prose prose-invert max-w-none",
              "prose-headings:text-foreground prose-headings:font-bold",
              "prose-h1:text-2xl prose-h1:gradient-text prose-h1:border-b prose-h1:border-border prose-h1:pb-2",
              "prose-h2:text-xl prose-h2:text-primary prose-h2:mt-6",
              "prose-h3:text-lg prose-h3:text-accent",
              "prose-p:text-foreground/90",
              "prose-li:text-foreground/90",
              "prose-strong:text-primary",
              "prose-em:text-accent",
              "prose-table:border-collapse",
              "prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2",
              "prose-td:border prose-td:border-border prose-td:p-2"
            )}>
              <ReactMarkdown>{plan}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-lg font-medium">Aucun plan généré</p>
              <p className="text-sm mt-2 text-center max-w-xs">
                Remplissez le formulaire et cliquez sur "Générer le Plan de Soirée" pour commencer
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
