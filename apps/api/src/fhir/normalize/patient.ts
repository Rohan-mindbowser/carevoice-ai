import type { Patient } from '@carevoice/schemas';
import type { FhirPatient, FhirHumanName } from '../fhir-types.js';

function formatName(name: FhirHumanName): string {
  const given = (name.given ?? []).join(' ').trim();
  const family = name.family?.trim() ?? '';
  const full = [given, family].filter(Boolean).join(' ').trim();
  return full || name.text?.trim() || 'Unknown';
}

/**
 * Pick the display name. FHIR allows many name entries (plus a long history in Cerner's sandbox);
 * prefer the current official one, then any current name, then the first available.
 */
function pickDisplayName(names: FhirHumanName[] | undefined): string {
  if (!names || names.length === 0) return 'Unknown';
  const official = names.find((n) => n.use === 'official');
  const current = names.find((n) => n.use === 'usual') ?? names.find((n) => n.use === undefined);
  const chosen = official ?? current ?? names[0];
  return chosen ? formatName(chosen) : 'Unknown';
}

/** Medical record number, if the resource carries an identifier typed MR. */
function pickMrn(resource: FhirPatient): string | undefined {
  const mr = resource.identifier?.find((id) =>
    id.type?.coding?.some((c) => c.code === 'MR'),
  );
  return mr?.value;
}

export function normalizePatient(resource: FhirPatient): Patient {
  return {
    id: resource.id ?? '',
    name: pickDisplayName(resource.name),
    gender: resource.gender,
    birthDate: resource.birthDate,
    mrn: pickMrn(resource),
  };
}
