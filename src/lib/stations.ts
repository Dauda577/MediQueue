export type DepartmentId = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity'

export interface StationLocation { room: string; wing: string }

// Default destination shown while a patient is still waiting (no staff has
// called them yet) — the real room/wing isn't known until they're assigned.
export const WAITING_PLACEHOLDER: StationLocation = { room: 'Reception', wing: 'Entrance' }

// Fallback default station per department — used for the check-in SMS and as a
// fallback in the staff "call next" SMS when the serving staff has no station set.
export const DEFAULT_STATIONS: Record<DepartmentId, string> = {
  OPD: 'Room 3, West Wing',
  Lab: 'Lab-1, East Wing',
  Pharmacy: 'Counter 2, Main Hall',
  Maternity: 'Ward 1, East Wing',
}

// Split a stored station ("Room 3, West Wing") into room/wing. Falls back to the
// waiting placeholder when nothing has been assigned yet.
export function parseStation(station?: string | null): StationLocation {
  if (!station || !station.trim()) return WAITING_PLACEHOLDER
  const [room, ...rest] = station.split(',')
  const wing = rest.join(',').trim()
  return { room: room.trim(), wing: wing || '—' }
}