import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "Qui est responsable ?",
    body: (
      <p>
        La LIMA (Ligue d'Improvisation du Maine-et-Loire), association loi 1901,
        est responsable du traitement des données de ce portail membres. Pour toute
        question ou demande relative à tes données, adresse-toi au bureau de
        l'association (en personne ou via un membre du CA).
      </p>
    ),
  },
  {
    title: "Quelles données et pourquoi ?",
    body: (
      <>
        <p>Le portail traite les données suivantes, pour la gestion de l'association :</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Identité et contact</strong> (nom, prénom, email, téléphone) —
            gestion des adhésions, communication interne, organisation des spectacles.
          </li>
          <li>
            <strong>Adhésion</strong> (statut joueur, cotisations, commissions, rôles) —
            suivi de la saison, grilles d'alignement.
          </li>
          <li>
            <strong>Photo de profil</strong> (facultative, ajoutée par toi) — trombinoscope
            interne réservé aux membres connectés.
          </li>
          <li>
            <strong>Photos d'événements</strong> — partagées dans la galerie interne,
            dans le cadre de l'autorisation d'utilisation de l'image signée à l'adhésion.
          </li>
          <li>
            <strong>Journaux techniques</strong> (pages consultées, adresse IP) —
            sécurité et bon fonctionnement du service, conservés 12 mois maximum.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Qui y a accès ?",
    body: (
      <>
        <p>
          Le portail est réservé aux membres authentifiés. Tes coordonnées complètes
          (téléphone, adresse, date de naissance) ne sont visibles que de toi-même et
          des administrateurs (CA / bureau). Les autres membres voient uniquement ton
          nom, ta photo et ton statut joueur.
        </p>
        <p className="mt-2">
          Hébergement et services techniques : Railway (API et base de données),
          Cloudflare R2 (photos, accès par liens signés à durée limitée), Sentry
          (suivi des erreurs, hébergement UE, sans données personnelles), Brevo
          (envoi des emails, France).
        </p>
      </>
    ),
  },
  {
    title: "Combien de temps ?",
    body: (
      <p>
        Les données d'adhésion sont conservées pendant ton adhésion puis archivées au
        plus 3 ans après ta dernière saison. Les journaux techniques sont supprimés
        automatiquement après 12 mois.
      </p>
    ),
  },
  {
    title: "Tes droits",
    body: (
      <p>
        Tu peux accéder à tes données, les rectifier (directement dans « Mon profil »
        pour la plupart), demander leur suppression, ou t'opposer à un traitement, en
        contactant le bureau de la LIMA. Tu peux aussi désactiver les emails de rappel
        depuis « Mon profil ». En cas de difficulté, tu peux saisir la CNIL (cnil.fr).
      </p>
    ),
  },
];

export default function DonneesPersonnelles() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold mb-2">Données personnelles</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Comment le portail membres de la LIMA utilise tes données.
        </p>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold mb-2">{s.title}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
