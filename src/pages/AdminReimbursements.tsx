import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listReimbursements, setReimbursementStatus, deleteReimbursement, type Reimbursement } from "@/lib/api";

const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
const STATUS_LABEL: Record<string, string> = {
  awaiting_confirmation: "En relecture", pending: "À rembourser", processed: "Remboursé",
};

export default function AdminReimbursements() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["reimbursements"], queryFn: listReimbursements });
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: "pending" | "processed" }) => setReimbursementStatus(id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reimbursements"] }); toast.success("Statut mis à jour"); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteReimbursement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reimbursements"] }); toast.success("Supprimé"); },
  });

  if (isLoading) return <div className="p-4">Chargement…</div>;
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold text-primary">Remboursements</h1>
      {data.length === 0 && <p className="text-muted-foreground">Aucune demande.</p>}
      {data.map((r: Reimbursement) => (
        <Card key={r.id} className="p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold">{r.first_name} {r.last_name} — {eur(r.total_eur)}</p>
              <p className="text-sm text-muted-foreground">{r.purchase_description} · {r.store || "—"}</p>
            </div>
            <span className="text-xs rounded px-2 py-1 bg-secondary">{STATUS_LABEL[r.status] || r.status}</span>
          </div>
          <ul className="text-sm text-muted-foreground">
            <li>Dépenses {eur(r.direct_expenses_eur)} · Km {r.km_distance} → {eur(r.km_amount_eur)} · Péage {eur(r.toll_eur)}</li>
            <li>Fonds : {r.funds_source === "own" ? "siens" : "caisse Lima"} · {r.email}</li>
          </ul>
          {r.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{a.filename}</a>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {r.status !== "processed" && <Button size="sm" onClick={() => status.mutate({ id: r.id, s: "processed" })}>Marquer remboursé</Button>}
            {r.status === "processed" && <Button size="sm" variant="outline" onClick={() => status.mutate({ id: r.id, s: "pending" })}>Rouvrir</Button>}
            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Supprimer ?")) del.mutate(r.id); }}>Supprimer</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
