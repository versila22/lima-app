import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Upload, Loader2, Users } from "lucide-react";

import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { MemberSummary, ImportMemberReport } from "@/types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SeasonRead } from "@/types";
import { MemberDetailDrawer } from "@/components/MemberDetailDrawer";

// ---- Helpers ----
const STATUS_LABELS: Record<string, string> = {
  M: "Match",
  C: "Cabaret",
  L: "Loisir",
  A: "Adhérent",
};

const STATUS_COLORS: Record<string, string> = {
  M: "bg-red-500/20 text-red-400 border-red-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  L: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  A: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Membre",
};

function getPhotoUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[status] ?? STATUS_COLORS["A"]}`}
    >
      {status} — {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ---- Main Page ----
export default function Members() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === "admin";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const adherentsRef = useRef<HTMLInputElement>(null);
  const jouteursRef = useRef<HTMLInputElement>(null);

  // Fetch current season to know season_id for import
  const { data: seasons } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
  });
  const currentSeason = seasons?.find((s) => s.is_current);

  // Fetch members
  const {
    data: members = [],
    isLoading,
    isError,
  } = useQuery<MemberSummary[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MemberSummary[]>("/members"),
  });

  // Import mutation
  const importMutation = useMutation<
    ImportMemberReport,
    ApiError,
    { adherents: File; joueurs: File }
  >({
    mutationFn: async ({ adherents, joueurs }) => {
      if (!currentSeason) throw new ApiError(400, "Aucune saison courante");
      const form = new FormData();
      form.append("adherents", adherents);
      form.append("joueurs", joueurs);
      return api.postForm<ImportMemberReport>(
        `/members/import?season_id=${currentSeason.id}`,
        form
      );
    },
    onSuccess: (report) => {
      toast.success(
        `Import terminé : ${report.created} créés, ${report.updated} mis à jour`
      );
      setImportErrors(report.errors ?? []);
      if ((report.errors ?? []).length > 0) {
        toast.warning(`${(report.errors ?? []).length} erreur(s) lors de l'import`);
      } else {
        setImportOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err) => {
      toast.error(err.detail ?? "Erreur lors de l'import");
    },
  });

  const handleImport = () => {
    const adherentsFile = adherentsRef.current?.files?.[0];
    const jouteursFile = jouteursRef.current?.files?.[0];
    if (!adherentsFile || !jouteursFile) {
      toast.error("Veuillez sélectionner les deux fichiers CSV");
      return;
    }
    importMutation.mutate({ adherents: adherentsFile, joueurs: jouteursFile });
  };

  // Filter
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
            <Users className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Membres</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} membre{members.length !== 1 ? "s" : ""} — saison courante
            </p>
          </div>
        </div>

        {isAdmin && (
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importer CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border w-[95vw] max-w-lg">
              <DialogHeader>
                <DialogTitle>Importer des membres</DialogTitle>
                <DialogDescription>
                  Importez deux exports CSV HelloAsso (adhérents + joueurs) pour la saison courante.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="adherents-file">CSV Adhérents</Label>
                  <Input
                    id="adherents-file"
                    type="file"
                    accept=".csv"
                    ref={adherentsRef}
                    className="bg-background/50 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joueurs-file">CSV Joueurs</Label>
                  <Input
                    id="joueurs-file"
                    type="file"
                    accept=".csv"
                    ref={jouteursRef}
                    className="bg-background/50 cursor-pointer"
                  />
                </div>
              </div>
              {importErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-medium text-destructive">
                    {importErrors.length} erreur(s) :
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i} className="truncate">• {err}</li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => { setImportErrors([]); setImportOpen(false); }}
                  >
                    Fermer
                  </Button>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  disabled={importMutation.isPending}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Import…
                    </>
                  ) : (
                    "Importer"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, prénom ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-destructive">
          Impossible de charger les membres. Vérifiez votre connexion.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-sm">{search ? `Aucun résultat pour "${search}".` : "Aucun membre pour cette saison."}</p>
          {!search && isAdmin && (
            <button
              onClick={() => setImportOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              Importer des membres via CSV
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Rôle asso</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="border-border hover:bg-sidebar-accent/30 cursor-pointer"
                  onClick={() => {
                    setSelectedMember(m);
                    setDrawerOpen(true);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage
                          src={getPhotoUrl(m.photo_url)}
                          alt={`${m.first_name} ${m.last_name}`}
                        />
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {m.first_name[0]}{m.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{m.last_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{m.first_name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {m.email}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {m.app_role === "admin" ? (
                      <Badge variant="outline" className="border-primary/50 text-primary text-xs">
                        {ROLE_LABELS[m.app_role]}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{ROLE_LABELS[m.app_role]}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.player_status ?? "A"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MemberDetailDrawer
        member={selectedMember}
        isAdmin={isAdmin}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
