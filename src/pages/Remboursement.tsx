import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  submitReimbursement, adjustReimbursement, confirmReimbursement,
  getMyPendingReimbursement, type Reimbursement,
} from "@/lib/api";

const KM_RATE = 0.32;
const num = (v: string) => (v.trim() === "" ? 0 : Math.max(0, parseFloat(v.replace(",", ".")) || 0));
const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";

export default function Remboursement() {
  const { user } = useAuth();
  const [pending, setPending] = useState<Reimbursement | null>(null);
  const [editing, setEditing] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [purchase, setPurchase] = useState("");
  const [store, setStore] = useState("");
  const [email, setEmail] = useState("");
  const [expenses, setExpenses] = useState("");
  const [km, setKm] = useState("");
  const [trip, setTrip] = useState("");
  const [toll, setToll] = useState("");
  const [funds, setFunds] = useState<"own" | "association">("own");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (user) {
      setFirstName((p) => p || (user as any).first_name || "");
      setLastName((p) => p || (user as any).last_name || "");
      setEmail((p) => p || (user as any).email || "");
    }
  }, [user]);

  useEffect(() => {
    getMyPendingReimbursement().then((r) => {
      if (r) { setPending(r); setEditing(false); }
    }).catch(() => {});
  }, []);

  const kmAmount = useMemo(() => Math.round(num(km) * KM_RATE * 100) / 100, [km]);
  const total = useMemo(() => Math.round((num(expenses) + kmAmount + num(toll)) * 100) / 100, [expenses, kmAmount, toll]);

  function buildForm(): FormData {
    const f = new FormData();
    f.append("first_name", firstName); f.append("last_name", lastName);
    f.append("purchase_description", purchase); f.append("store", store);
    f.append("email", email); f.append("direct_expenses_eur", String(num(expenses)));
    f.append("funds_source", funds); f.append("km_distance", String(num(km)));
    f.append("trip_description", trip); f.append("toll_eur", String(num(toll)));
    files.forEach((file) => f.append("files", file));
    return f;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (num(expenses) + num(km) + num(toll) <= 0) { toast.error("Indique une dépense, des km ou un péage."); return; }
    setSubmitting(true);
    try {
      const r = pending
        ? await adjustReimbursement(pending.id, buildForm())
        : await submitReimbursement(buildForm());
      setPending(r); setEditing(false); setFiles([]);
      toast.success("Demande enregistrée — relis-la, tu as 5 min pour ajuster.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur à l'envoi");
    } finally { setSubmitting(false); }
  }

  async function onConfirm() {
    if (!pending) return;
    try {
      const r = await confirmReimbursement(pending.id);
      setPending(r);
      toast.success("Envoyé au trésorier. Merci !");
    } catch (err: any) { toast.error(err?.message || "Erreur"); }
  }

  // --- Vue relecture (awaiting) ---
  if (pending && pending.status === "awaiting_confirmation" && !editing) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold text-primary">Demande en relecture</h1>
        <Card className="p-4 space-y-2 border-primary/30">
          <p>Relis ta demande. Sans action sous 5 min, elle part au trésorier.</p>
          <ul className="text-sm space-y-1">
            <li>Achat : {pending.purchase_description}</li>
            <li>Dépenses : {eur(pending.direct_expenses_eur)}</li>
            <li>Km : {pending.km_distance} → {eur(pending.km_amount_eur)}</li>
            <li>Péage : {eur(pending.toll_eur)}</li>
            <li className="font-bold">Total : {eur(pending.total_eur)}</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button onClick={onConfirm}>C'est bon, envoyer au trésorier</Button>
            <Button variant="outline" onClick={() => setEditing(true)}>Ajuster</Button>
          </div>
        </Card>
      </div>
    );
  }
  if (pending && pending.status !== "awaiting_confirmation") {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-4">Ta demande a bien été transmise au trésorier ✅</Card>
      </div>
    );
  }

  // --- Formulaire ---
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-primary mb-1">Demande de remboursement</h1>
      <p className="text-muted-foreground mb-4">Merci d'avoir avancé des sous pour la Lima, c'est adorable.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
          <div><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
        </div>
        <div><Label>Qu'as-tu acheté ?</Label><Textarea value={purchase} onChange={(e) => setPurchase(e.target.value)} required /></div>
        <div><Label>Où ? (magasin)</Label><Input value={store} onChange={(e) => setStore(e.target.value)} /></div>
        <div><Label>Ton email (confirmation)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><Label>Combien as-tu dépensé ? (€)</Label><Input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0" /></div>

        <Card className="p-3 space-y-3 bg-secondary/40">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Km parcourus</Label><Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" /></div>
            <div><Label>Péage (€)</Label><Input inputMode="decimal" value={toll} onChange={(e) => setToll(e.target.value)} placeholder="0" /></div>
          </div>
          <div><Label>Trajet (optionnel)</Label><Input value={trip} onChange={(e) => setTrip(e.target.value)} placeholder="Angers → Nantes" /></div>
          <p className="text-sm text-muted-foreground">Frais km : {eur(kmAmount)} ({km || 0} km × 0,32 €/km)</p>
        </Card>

        <div>
          <Label>Avec quel sous ?</Label>
          <RadioGroup value={funds} onValueChange={(v) => setFunds(v as "own" | "association")} className="mt-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="own" id="own" /><Label htmlFor="own">Les miens</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="association" id="asso" /><Label htmlFor="asso">Ceux de la caisse / CB Lima (les trésoriers ont dit oui avant)</Label></div>
          </RadioGroup>
        </div>

        <div>
          <Label>Factures / tickets + RIB (images ou PDF)</Label>
          <Input type="file" multiple accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.length > 0 && <p className="text-sm mt-1">{files.length} fichier(s) sélectionné(s)</p>}
        </div>

        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="flex justify-between text-lg font-bold text-primary">
            <span>Total remboursable</span><span>{eur(total)}</span>
          </div>
        </Card>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Envoi…" : pending ? "Enregistrer les ajustements" : "Soumettre"}
        </Button>
      </form>
    </div>
  );
}
