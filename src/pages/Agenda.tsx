import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutList,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isValid,
} from "date-fns";
import { fr } from "date-fns/locale";

import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type {
  EventRead,
  EventCreate,
  EventUpdate,
  SeasonRead,
  EventType,
  MemberSummary,
} from "@/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ---- Event type config ----
export const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; dot: string }
> = {
  training_show: {
    label: "Entraînement spectacle",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    dot: "bg-purple-400",
  },
  training_leisure: {
    label: "Entraînement loisir",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
  },
  match: {
    label: "Match",
    color: "bg-red-500/20 text-red-300 border-red-500/30",
    dot: "bg-red-400",
  },
  cabaret: {
    label: "Cabaret",
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
  },
  welsh: {
    label: "Welsh",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  formation: {
    label: "Formation",
    color: "bg-green-500/20 text-green-300 border-green-500/30",
    dot: "bg-green-400",
  },
  ag: {
    label: "AG",
    color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    dot: "bg-orange-400",
  },
  other: {
    label: "Autre",
    color: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    dot: "bg-gray-400",
  },
};

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const CAST_NOTES_MARKER = "--- CAST_DATA ---";
const COMMISSION_OPTIONS = ["comadh", "comform", "comcom", "comprog", "comspec", "ca"];
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

type CastFieldKey =
  | "player1"
  | "player2"
  | "player3"
  | "player4"
  | "player5"
  | "arbitre"
  | "mc"
  | "mj"
  | "dj"
  | "referent";

type CastFormState = Record<CastFieldKey, string>;

interface CastFieldDefinition {
  key: CastFieldKey;
  label: string;
  kind: "member" | "referent";
}

interface StructuredCastData {
  eventType: EventType;
  assignments: Partial<Record<CastFieldKey, string>>;
}

// Monday-first weekday index (0=Mon … 6=Sun)
function weekdayIndex(date: Date): number {
  const d = getDay(date); // 0=Sun, 1=Mon…6=Sat
  return d === 0 ? 6 : d - 1;
}

// ---- Cast member type ----
interface CastMember {
  member_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

const DETAIL_ROLE_LABELS: Record<string, { label: string; emoji: string }> = {
  JR: { label: "Joueur", emoji: "🎭" },
  MJ_MC: { label: "MJ / MC", emoji: "🎤" },
  DJ: { label: "DJ", emoji: "🎵" },
  AR: { label: "Arbitre", emoji: "⚖️" },
  COACH: { label: "Coach", emoji: "🏋️" },
};

const EMPTY_CAST_FORM: CastFormState = {
  player1: "",
  player2: "",
  player3: "",
  player4: "",
  player5: "",
  arbitre: "",
  mc: "",
  mj: "",
  dj: "",
  referent: "",
};

function getDefaultDateTime(): Date {
  const now = new Date();
  return setMilliseconds(setSeconds(setMinutes(now, 0), 0), 0);
}

function getCastFields(eventType: EventType, isAway: boolean = false): CastFieldDefinition[] {
  if (eventType === "match") {
    const baseFields: CastFieldDefinition[] = [
      { key: "player1", label: "Joueur 1", kind: "member" },
      { key: "player2", label: "Joueur 2", kind: "member" },
      { key: "player3", label: "Joueur 3", kind: "member" },
      { key: "player4", label: "Joueur 4", kind: "member" },
      { key: "player5", label: "Joueur 5", kind: "member" },
    ];
    if (!isAway) {
      baseFields.push(
        { key: "arbitre", label: "Arbitre", kind: "member" },
        { key: "mc", label: "MC", kind: "member" },
        { key: "dj", label: "DJ", kind: "member" }
      );
    }
    return baseFields;
  }

  if (eventType === "cabaret") {
    return [
      { key: "player1", label: "Joueur 1", kind: "member" },
      { key: "player2", label: "Joueur 2", kind: "member" },
      { key: "player3", label: "Joueur 3", kind: "member" },
      { key: "player4", label: "Joueur 4", kind: "member" },
      { key: "player5", label: "Joueur 5", kind: "member" },
      { key: "mj", label: "MJ (Maître de Jeu)", kind: "member" },
      { key: "dj", label: "DJ", kind: "member" },
    ];
  }

  if (eventType === "welsh") {
    return [
      { key: "player1", label: "Joueur 1", kind: "member" },
      { key: "player2", label: "Joueur 2", kind: "member" },
      { key: "player3", label: "Joueur 3", kind: "member" },
      { key: "player4", label: "Joueur 4", kind: "member" },
      { key: "mj", label: "MJ", kind: "member" },
    ];
  }

  return [{ key: "referent", label: "Référent", kind: "referent" }];
}

function parseStructuredNotes(notes?: string | null): {
  plainNotes: string;
  cast: CastFormState;
} {
  if (!notes) {
    return { plainNotes: "", cast: { ...EMPTY_CAST_FORM } };
  }

  const markerIndex = notes.indexOf(CAST_NOTES_MARKER);
  if (markerIndex === -1) {
    return { plainNotes: notes.trim(), cast: { ...EMPTY_CAST_FORM } };
  }

  const plainNotes = notes.slice(0, markerIndex).trim();
  const rawPayload = notes.slice(markerIndex + CAST_NOTES_MARKER.length).trim();

  try {
    const parsed = JSON.parse(rawPayload) as StructuredCastData;
    const nextCast = { ...EMPTY_CAST_FORM };

    Object.entries(parsed.assignments ?? {}).forEach(([key, value]) => {
      if (key in nextCast && typeof value === "string") {
        nextCast[key as CastFieldKey] = value;
      }
    });

    return { plainNotes, cast: nextCast };
  } catch {
    return { plainNotes: notes.trim(), cast: { ...EMPTY_CAST_FORM } };
  }
}

function buildStructuredNotes(notes: string, eventType: EventType, cast: CastFormState): string | undefined {
  const trimmedNotes = notes.trim();
  const assignments = Object.fromEntries(
    Object.entries(cast).filter(([, value]) => value.trim().length > 0),
  ) as Partial<Record<CastFieldKey, string>>;

  if (Object.keys(assignments).length === 0) {
    return trimmedNotes || undefined;
  }

  const payload: StructuredCastData = {
    eventType,
    assignments,
  };

  const serialized = JSON.stringify(payload, null, 2);
  return trimmedNotes
    ? `${trimmedNotes}\n\n${CAST_NOTES_MARKER}\n${serialized}`
    : `${CAST_NOTES_MARKER}\n${serialized}`;
}

function formatEventNotes(notes?: string | null): string | null {
  const plainNotes = parseStructuredNotes(notes).plainNotes;
  return plainNotes || null;
}

function parseDateTimeValue(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return isValid(parsed) ? parsed : undefined;
}

function combineDateAndTime(date: Date | undefined, hour: string, minute: string): string | undefined {
  if (!date) return undefined;

  const safeHour = Math.min(23, Math.max(0, Number(hour || "0")));
  const safeMinute = Number(minute || "0");
  const withTime = setMilliseconds(
    setSeconds(setMinutes(setHours(date, safeHour), safeMinute), 0),
    0,
  );

  return format(withTime, "yyyy-MM-dd'T'HH:mm:ss");
}

function getInitialDateTimeState(value?: string | null): {
  date: Date;
  hour: string;
  minute: string;
} {
  const parsed = parseDateTimeValue(value) ?? getDefaultDateTime();
  return {
    date: parsed,
    hour: format(parsed, "HH"),
    minute: MINUTE_OPTIONS.includes(format(parsed, "mm")) ? format(parsed, "mm") : "00",
  };
}

function displayDateTime(date?: Date, hour = "00", minute = "00"): string {
  if (!date) return "Choisir une date";
  return `${format(date, "dd/MM/yyyy")} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function useMembers() {
  return useQuery<MemberSummary[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MemberSummary[]>("/members"),
  });
}

function DateTimeField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value?: string;
  onChange: (value?: string) => void;
  required?: boolean;
}) {
  const initialState = useMemo(() => getInitialDateTimeState(value), [value]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialState.date);
  const [hour, setHour] = useState(initialState.hour);
  const [minute, setMinute] = useState(initialState.minute);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextState = getInitialDateTimeState(value);
    setSelectedDate(nextState.date);
    setHour(nextState.hour);
    setMinute(nextState.minute);
  }, [value]);

  const sync = (date: Date | undefined, nextHour: string, nextMinute: string) => {
    setSelectedDate(date);
    setHour(nextHour);
    setMinute(nextMinute);
    onChange(combineDateAndTime(date, nextHour, nextMinute));
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between bg-background/50 text-left font-normal hover:bg-background/70"
            >
              <span className={cn(!selectedDate && "text-muted-foreground")}>
                {displayDateTime(selectedDate, hour, minute)}
              </span>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-border bg-popover p-0" align="start">
            <Calendar
              mode="single"
              locale={fr}
              selected={selectedDate}
              onSelect={(date) => {
                sync(date ?? getDefaultDateTime(), hour, minute);
                setOpen(false);
              }}
              initialFocus
              className="bg-popover"
            />
          </PopoverContent>
        </Popover>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="number"
            min={0}
            max={23}
            inputMode="numeric"
            value={hour}
            onChange={(e) => {
              const raw = e.target.value;
              const nextHour = raw === "" ? "" : String(Math.min(23, Math.max(0, Number(raw)))).padStart(2, "0");
              sync(selectedDate ?? getDefaultDateTime(), nextHour, minute || "00");
            }}
            className="bg-background/50"
            placeholder="Heure (0-23)"
          />
          <Select
            value={minute}
            onValueChange={(nextMinute) => sync(selectedDate ?? getDefaultDateTime(), hour || "00", nextMinute)}
          >
            <SelectTrigger className="w-[120px] bg-background/50">
              <SelectValue placeholder="Minutes" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {MINUTE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function MemberCombobox({
  label,
  value,
  onChange,
  members,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  members: MemberSummary[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedMember = members.find((member) => member.id === value);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background/50 font-normal"
          >
            <span className="truncate text-left">
              {selectedMember
                ? `${selectedMember.first_name} ${selectedMember.last_name}`
                : (placeholder ?? "Sélectionner un membre")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-border bg-popover p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher un membre..." />
            <CommandList>
              <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="aucun"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  Aucun
                </CommandItem>
                {members.map((member) => {
                  const fullName = `${member.first_name} ${member.last_name}`;
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${fullName} ${member.email}`}
                      onSelect={() => {
                        onChange(member.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === member.id ? "opacity-100" : "opacity-0")} />
                      <span>{fullName}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ReferentField({
  value,
  onChange,
  members,
}: {
  value: string;
  onChange: (value: string) => void;
  members: MemberSummary[];
}) {
  const [open, setOpen] = useState(false);
  const selectedMember = members.find((member) => member.id === value);
  const selectedCommission = COMMISSION_OPTIONS.find((option) => option === value);

  const buttonLabel = selectedMember
    ? `${selectedMember.first_name} ${selectedMember.last_name}`
    : ((selectedCommission ?? value) || "Choisir un membre ou une commission");

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/30 p-3">
      <Label>Référent</Label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-background/50 font-normal"
            >
              <span className="truncate text-left">{buttonLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-border bg-popover p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher un membre ou une commission..." />
              <CommandList>
                <CommandEmpty>Aucun résultat.</CommandEmpty>
                <CommandGroup heading="Membres">
                  {members.map((member) => {
                    const fullName = `${member.first_name} ${member.last_name}`;
                    return (
                      <CommandItem
                        key={member.id}
                        value={`${fullName} ${member.email}`}
                        onSelect={() => {
                          onChange(member.id);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value === member.id ? "opacity-100" : "opacity-0")} />
                        {fullName}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandGroup heading="Commissions">
                  <CommandItem
                    value="aucun"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                    Aucun
                  </CommandItem>
                  {COMMISSION_OPTIONS.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Input
          value={selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background/50"
          placeholder="Ou saisir librement..."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Optionnel : membre de l'association ou code commission (comadh, comform, comcom, comprog, comspec, ca).
      </p>
    </div>
  );
}

function CastFieldsSection({
  eventType,
  isAway = false,
  cast,
  onChange,
  members,
  membersLoading,
}: {
  eventType: EventType;
  isAway?: boolean;
  cast: CastFormState;
  onChange: (key: CastFieldKey, value: string) => void;
  members: MemberSummary[];
  membersLoading: boolean;
}) {
  const fields = getCastFields(eventType, isAway);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Distribution & responsabilités</h3>
        <p className="text-xs text-muted-foreground">
          Tous les champs sont optionnels.
        </p>
      </div>

      {membersLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des membres...
        </div>
      ) : eventType === "match" || eventType === "cabaret" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <MemberCombobox
              key={field.key}
              label={field.label}
              value={cast[field.key]}
              onChange={(value) => onChange(field.key, value)}
              members={members}
            />
          ))}
        </div>
      ) : (
        <ReferentField
          value={cast.referent}
          onChange={(value) => onChange("referent", value)}
          members={members}
        />
      )}
    </div>
  );
}

// ---- Event Detail Drawer (mobile-friendly bottom sheet) ----
function EventDetailDrawer({
  event,
  open,
  isAdmin,
  onClose,
  onEdit,
  onDelete,
}: {
  event: EventRead;
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (event: EventRead) => void;
  onDelete: (event: EventRead) => void;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.other;

  const { data: cast = [], isLoading: castLoading } = useQuery<CastMember[]>({
    queryKey: ["event-cast", event.id],
    queryFn: () => api.get<CastMember[]>(`/events/${event.id}/cast`),
    enabled: open,
  });

  // Group by role
  const byRole = cast.reduce<Record<string, CastMember[]>>((acc, c) => {
    if (!acc[c.role]) acc[c.role] = [];
    acc[c.role].push(c);
    return acc;
  }, {});

  // Display order
  const roleOrder = ["JR", "MJ_MC", "DJ", "AR", "COACH"];
  const visibleNotes = formatEventNotes(event.notes);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh] bg-card border-border">
        <div className="overflow-y-auto px-4 pb-2">
          <DrawerHeader className="px-0">
            <DrawerTitle className="flex items-center gap-2 text-left">
              <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
              {event.title}
            </DrawerTitle>
            <DrawerDescription className="text-left">
              <Badge variant="outline" className={`text-xs ${cfg.color} mt-1`}>
                {cfg.label}
              </Badge>
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 text-sm py-2">
            <div>
              <span className="text-muted-foreground">Date : </span>
              {format(parseISO(event.start_at), "EEEE d MMMM yyyy — HH:mm", {
                locale: fr,
              })}
              {event.end_at && (
                <> → {format(parseISO(event.end_at), "HH:mm")}</>
              )}
            </div>
            {event.is_away && (
              <div>
                <span className="text-muted-foreground">Déplacement : </span>
                {event.away_city ?? "Ville inconnue"}
                {event.away_opponent && ` — ${event.away_opponent}`}
              </div>
            )}
            {visibleNotes && (
              <div>
                <span className="text-muted-foreground">Notes : </span>
                {visibleNotes}
              </div>
            )}

            {/* Cast */}
            {castLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement du casting…
              </div>
            ) : cast.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <span className="font-semibold text-foreground">🎬 Casting</span>
                {roleOrder.map((role) => {
                  const members = byRole[role];
                  if (!members?.length) return null;
                  const rl = DETAIL_ROLE_LABELS[role] ?? { label: role, emoji: "👤" };
                  return (
                    <div key={role}>
                      <span className="text-muted-foreground text-xs">{rl.emoji} {rl.label}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {members.map((m) => (
                          <Badge key={m.member_id} variant="secondary" className="text-xs">
                            {m.first_name} {m.last_name.charAt(0)}.
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2 border-t border-border pt-3">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(event)}
                className="gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifier
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(event)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Fermer
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ---- Edit Event Dialog ----
function EditEventDialog({
  event,
  open,
  onOpenChange,
}: {
  event: EventRead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading: membersLoading } = useMembers();

  const parsedNotes = useMemo(() => parseStructuredNotes(event.notes), [event.notes]);

  const [title, setTitle] = useState(event.title);
  const [eventType, setEventType] = useState<EventType>(event.event_type);
  const [isAway, setIsAway] = useState<boolean>(event.is_away || false);
  const [startAt, setStartAt] = useState<string | undefined>(event.start_at);
  const [endAt, setEndAt] = useState<string | undefined>(event.end_at ?? undefined);
  const [notes, setNotes] = useState(parsedNotes.plainNotes);
  const [cast, setCast] = useState<CastFormState>(parsedNotes.cast);

  useEffect(() => {
    const nextParsed = parseStructuredNotes(event.notes);
    setTitle(event.title);
    setEventType(event.event_type);
    setIsAway(event.is_away || false);
    setStartAt(event.start_at);
    setEndAt(event.end_at ?? undefined);
    setNotes(nextParsed.plainNotes);
    setCast(nextParsed.cast);
  }, [event]);

  const updateMutation = useMutation<EventRead, ApiError, EventUpdate>({
    mutationFn: (data) => api.put<EventRead>(`/events/${event.id}`, data),
    onSuccess: () => {
      toast.success("Événement modifié !");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la modification"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startAt) {
      toast.error("Titre et date de début sont requis");
      return;
    }
    updateMutation.mutate({
      title,
      event_type: eventType,
      is_away: isAway,
      start_at: startAt,
      end_at: endAt || undefined,
      notes: buildStructuredNotes(notes, eventType, cast),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'événement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titre</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {eventType === "match" && (
            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-background/30">
              <Switch
                id="edit-is-away"
                checked={isAway}
                onCheckedChange={setIsAway}
              />
              <Label htmlFor="edit-is-away">Déplacement (match à l'extérieur)</Label>
            </div>
          )}

          <CastFieldsSection
            eventType={eventType}
            isAway={isAway}
            cast={cast}
            onChange={(key, value) => setCast((prev) => ({ ...prev, [key]: value }))}
            members={members}
            membersLoading={membersLoading}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DateTimeField
              label="Début"
              value={startAt}
              onChange={setStartAt}
              required
            />
            <DateTimeField
              label="Fin (optionnel)"
              value={endAt}
              onChange={setEndAt}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background/50 min-h-28"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add Event Dialog ----
function AddEventDialog({
  open,
  onOpenChange,
  currentSeasonId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentSeasonId: string;
}) {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("training_show");
  const [isAway, setIsAway] = useState<boolean>(false);
  const [startAt, setStartAt] = useState<string | undefined>(() => combineDateAndTime(getDefaultDateTime(), format(getDefaultDateTime(), "HH"), "00"));
  const [endAt, setEndAt] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [cast, setCast] = useState<CastFormState>({ ...EMPTY_CAST_FORM });

  useEffect(() => {
    if (open) {
      setStartAt((current) => current ?? combineDateAndTime(getDefaultDateTime(), format(getDefaultDateTime(), "HH"), "00"));
    }
  }, [open]);

  const resetForm = () => {
    const defaultDate = getDefaultDateTime();
    setTitle("");
    setEventType("training_show");
    setIsAway(false);
    setStartAt(combineDateAndTime(defaultDate, format(defaultDate, "HH"), "00"));
    setEndAt(undefined);
    setNotes("");
    setCast({ ...EMPTY_CAST_FORM });
  };

  const createMutation = useMutation<EventRead, ApiError, EventCreate>({
    mutationFn: (data) => api.post<EventRead>("/events", data),
    onSuccess: () => {
      toast.success("Événement créé !");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la création"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startAt) {
      toast.error("Titre et date de début sont requis");
      return;
    }
    createMutation.mutate({
      season_id: currentSeasonId,
      title,
      event_type: eventType,
      start_at: startAt,
      end_at: endAt || undefined,
      notes: buildStructuredNotes(notes, eventType, cast),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen && !createMutation.isPending) {
          resetForm();
        }
      }}
    >
      <DialogContent className="bg-card border-border w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un événement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Titre</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as EventType)}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CastFieldsSection
            eventType={eventType}
            cast={cast}
            onChange={(key, value) => setCast((prev) => ({ ...prev, [key]: value }))}
            members={members}
            membersLoading={membersLoading}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DateTimeField
              label="Début"
              value={startAt}
              onChange={setStartAt}
              required
            />
            <DateTimeField
              label="Fin (optionnel)"
              value={endAt}
              onChange={setEndAt}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background/50 min-h-28"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- List View ----
interface AgendaListViewProps {
  events: EventRead[];
  onEventClick: (event: EventRead) => void;
}

function AgendaListView({ events, onEventClick }: AgendaListViewProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  // Group by "MMMM yyyy"
  const groups: { label: string; items: EventRead[] }[] = [];
  for (const ev of sorted) {
    const label = format(parseISO(ev.start_at), "MMMM yyyy", { locale: fr });
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(ev);
    } else {
      groups.push({ label, items: [ev] });
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-16 text-sm">
        Aucun événement pour cette saison.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 capitalize">
            {group.label}
          </h2>
          <div className="space-y-1.5">
            {group.items.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
              const startDate = parseISO(ev.start_at);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg border ${cfg.color} hover:opacity-80 transition-opacity`}
                >
                  <div className="shrink-0 text-center min-w-[2.5rem]">
                    <p className="text-xs font-semibold leading-none">
                      {format(startDate, "d", { locale: fr })}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {format(startDate, "EEE", { locale: fr })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(startDate, "HH:mm")}
                      {ev.is_away && ev.away_city ? ` · Déplacement — ${ev.away_city}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Main Page ----
export default function Agenda() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === "admin";
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventRead | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRead | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<EventRead | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/events/${id}`),
    onSuccess: () => {
      toast.success("Événement supprimé");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setDeleteEvent(null);
      setSelectedEvent(null);
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la suppression"),
  });

  // Fetch current season
  const { data: seasons } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
  });
  const currentSeason = seasons?.find((s) => s.is_current);

  // Fetch events
  const { data: events = [], isLoading } = useQuery<EventRead[]>({
    queryKey: ["events", currentSeason?.id],
    queryFn: () =>
      api.get<EventRead[]>("/events", currentSeason ? { season_id: currentSeason.id } : {}),
    enabled: !!currentSeason,
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = weekdayIndex(monthStart);

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_at), day));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-background" />
          </div>
          <h1 className="text-2xl font-bold">Agenda</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-none px-3"
              aria-label="Vue calendrier"
            >
              <CalendarDays className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none px-3"
              aria-label="Vue liste"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>

          {viewMode === "calendar" && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[160px] text-center font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: fr })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {isAdmin && currentSeason && (
            <Button
              onClick={() => setAddOpen(true)}
              className="ml-2 bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, (typeof EVENT_TYPE_CONFIG)[EventType]][]).map(
          ([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          )
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : viewMode === "list" ? (
        <AgendaListView
          events={events}
          onEventClick={setSelectedEvent}
        />
      ) : (
        /* Calendar grid */
        <div className="overflow-x-auto">
          <div className="min-w-[720px] rounded-lg border border-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border bg-sidebar">
            {DAYS_FR.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[80px] border-r border-b border-border/40 bg-sidebar/30" />
            ))}

            {days.map((day) => {
              const dayEvents = eventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const inMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] border-r border-b border-border/40 p-1 ${
                    !inMonth ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg =
                        EVENT_TYPE_CONFIG[ev.event_type] ??
                        EVENT_TYPE_CONFIG.other;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate border ${cfg.color} hover:opacity-80 transition-opacity`}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Event detail drawer (bottom sheet) */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          open={!!selectedEvent}
          isAdmin={isAdmin}
          onClose={() => setSelectedEvent(null)}
          onEdit={(ev) => {
            setSelectedEvent(null);
            setEditEvent(ev);
          }}
          onDelete={(ev) => {
            setDeleteEvent(ev);
          }}
        />
      )}

      {/* Add event dialog */}
      {isAdmin && currentSeason && (
        <AddEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          currentSeasonId={currentSeason.id}
        />
      )}

      {/* Edit event dialog */}
      {editEvent && (
        <EditEventDialog
          event={editEvent}
          open={!!editEvent}
          onOpenChange={(open) => !open && setEditEvent(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteEvent}
        onOpenChange={(open) => !open && setDeleteEvent(null)}
      >
        <AlertDialogContent className="bg-card border-border w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteEvent?.title}</span>
              {" "}sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEvent && deleteMutation.mutate(deleteEvent.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
