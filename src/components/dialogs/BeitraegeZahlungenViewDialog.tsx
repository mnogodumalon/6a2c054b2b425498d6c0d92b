import type { BeitraegeZahlungen, Mitglieder } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface BeitraegeZahlungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: BeitraegeZahlungen | null;
  onEdit: (record: BeitraegeZahlungen) => void;
  mitgliederList: Mitglieder[];
}

export function BeitraegeZahlungenViewDialog({ open, onClose, record, onEdit, mitgliederList }: BeitraegeZahlungenViewDialogProps) {
  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beiträge & Zahlungen anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mitglied</Label>
            <p className="text-sm">{getMitgliederDisplayName(record.fields.mitglied)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beitragsjahr</Label>
            <p className="text-sm">{record.fields.beitragsjahr ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beitragshöhe (€)</Label>
            <p className="text-sm">{record.fields.beitragshoehe ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
            <Badge variant="secondary">{record.fields.zahlungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.zahlungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsstatus</Label>
            <Badge variant="secondary">{record.fields.zahlungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen_zahlung ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.BEITRAEGE_ZAHLUNGEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}