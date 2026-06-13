export type DigitalTwinZoneType = 'racing-surface' | 'animal-area' | 'public-area' | 'operations' | 'restricted' | 'emergency' | 'device';

export interface DigitalTwinZone {
  id: string;
  name: string;
  type: DigitalTwinZoneType;
  restricted: boolean;
  sensors?: string[];
  cameras?: string[];
}

export const digitalTwinZones: DigitalTwinZone[] = [
  { id: 'oval', name: 'Oval', type: 'racing-surface', restricted: true },
  { id: 'dirt-track', name: 'Dirt Track', type: 'racing-surface', restricted: true, sensors: ['moisture', 'cushion-depth', 'compaction'] },
  { id: 'turf-track', name: 'Turf Track', type: 'racing-surface', restricted: true, sensors: ['moisture', 'temperature'] },
  { id: 'paddock', name: 'Paddock', type: 'animal-area', restricted: true, cameras: ['paddock-cam'] },
  { id: 'barns', name: 'Barns', type: 'animal-area', restricted: true },
  { id: 'gates', name: 'Starting Gates', type: 'operations', restricted: true, sensors: ['gate-status'] },
  { id: 'grandstand', name: 'Grandstand', type: 'public-area', restricted: false },
  { id: 'tote-room', name: 'Tote Room', type: 'restricted', restricted: true },
  { id: 'steward-room', name: 'Steward Room', type: 'restricted', restricted: true },
  { id: 'vet-area', name: 'Veterinary Area', type: 'animal-area', restricted: true },
  { id: 'parking', name: 'Parking', type: 'public-area', restricted: false },
  { id: 'entrances', name: 'Entrances', type: 'public-area', restricted: false },
  { id: 'emergency-lanes', name: 'Emergency Lanes', type: 'emergency', restricted: true },
  { id: 'sensors', name: 'Sensor Network', type: 'device', restricted: true },
  { id: 'cameras', name: 'Camera Network', type: 'device', restricted: true },
  { id: 'restricted-zones', name: 'Restricted Zones', type: 'restricted', restricted: true },
];
