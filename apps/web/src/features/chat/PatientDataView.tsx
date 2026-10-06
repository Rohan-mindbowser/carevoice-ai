import type { DiagnosticReportSummary, LabResult, Patient } from '@carevoice/schemas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** "From EHR" badge marks structured data as authoritative, distinct from the AI's prose (§4). */
function EhrBadge() {
  return <Badge variant="outline">From EHR</Badge>;
}

function interpretationVariant(interpretation?: string): 'success' | 'muted' {
  return interpretation?.toLowerCase() === 'normal' ? 'success' : 'muted';
}

function LabTable({ title, results }: { title: string; results: LabResult[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <EhrBadge />
      </CardHeader>
      <CardContent className="space-y-2">
        {results.length === 0 && <p className="text-sm text-muted-foreground">No results returned.</p>}
        {results.map((lab) => (
          <div key={lab.id} className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
            <div>
              <div className="text-sm font-medium">{lab.name}</div>
              {lab.referenceRange && (
                <div className="text-xs text-muted-foreground">Ref: {lab.referenceRange}</div>
              )}
              {lab.effectiveDate && (
                <div className="text-xs text-muted-foreground">Collected {formatDate(lab.effectiveDate)}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm tabular-nums">
                {lab.value !== undefined ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ''}` : (lab.valueText ?? '—')}
              </div>
              {lab.interpretation && (
                <Badge variant={interpretationVariant(lab.interpretation)}>{lab.interpretation}</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient {patient.id}</CardTitle>
        <EhrBadge />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{patient.name}</dd>
          {patient.gender && (
            <>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="capitalize">{patient.gender}</dd>
            </>
          )}
          {patient.birthDate && (
            <>
              <dt className="text-muted-foreground">DOB</dt>
              <dd>{formatDate(patient.birthDate)}</dd>
            </>
          )}
          {patient.mrn && (
            <>
              <dt className="text-muted-foreground">MRN</dt>
              <dd>{patient.mrn}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function ReportsCard({ reports }: { reports: DiagnosticReportSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostic Reports</CardTitle>
        <EhrBadge />
      </CardHeader>
      <CardContent className="space-y-2">
        {reports.map((report) => (
          <div key={report.id} className="border-b pb-2 text-sm last:border-b-0 last:pb-0">
            <div className="font-medium">{report.name}</div>
            <div className="text-xs text-muted-foreground">
              {report.status}
              {report.effectiveDate ? ` · ${formatDate(report.effectiveDate)}` : ''}
            </div>
            {report.conclusion && <p className="mt-1 text-xs">{report.conclusion}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Discriminate the tool output by shape and render the appropriate structured card(s). */
export function PatientDataView({ data }: { data: unknown }) {
  const record = asRecord(data);
  if (!record) return null;

  if (Array.isArray(record.results)) {
    return <LabTable title="Latest Lab Results" results={record.results as LabResult[]} />;
  }
  if (Array.isArray(record.observations)) {
    return <LabTable title="Observations" results={record.observations as LabResult[]} />;
  }
  if (Array.isArray(record.reports)) {
    return <ReportsCard reports={record.reports as DiagnosticReportSummary[]} />;
  }
  if (Array.isArray(record.patients)) {
    const patients = record.patients as Patient[];
    return (
      <div className="space-y-2">
        {patients.map((patient) => (
          <PatientCard key={patient.id} patient={patient} />
        ))}
      </div>
    );
  }
  if (typeof record.id === 'string' && typeof record.name === 'string') {
    return <PatientCard patient={record as unknown as Patient} />;
  }
  return null;
}
