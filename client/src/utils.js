export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(km) {
  if (!km) return '0.0';
  return Number(km).toFixed(1);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPace(distanceKm, durationSeconds) {
  if (!distanceKm || !durationSeconds || distanceKm === 0) return '-';
  const paceSeconds = durationSeconds / distanceKm;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function activityIcon(type) {
  const icons = {
    run: '\u{1F3C3}',
    walk: '\u{1F6B6}',
    ski: '\u26F7\uFE0F',
    bike: '\u{1F6B2}',
    sled: '\u{1F6F7}',
    swim: '\u{1F3CA}',
    hike: '\u26F0\uFE0F',
    other: '\u{2B50}',
  };
  return icons[type] || icons.other;
}

export function activityTypes() {
  return [
    { value: 'run', label: 'Run' },
    { value: 'walk', label: 'Walk' },
    { value: 'sled', label: 'Sled' },
    { value: 'ski', label: 'Skijoring' },
    { value: 'bike', label: 'Bikejoring' },
    { value: 'hike', label: 'Hike' },
    { value: 'swim', label: 'Swim' },
    { value: 'other', label: 'Other' },
  ];
}

export function todayDate() {
  return new Date().toISOString().split('T')[0];
}
