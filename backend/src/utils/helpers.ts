export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}
export function generateSlots(workingHours: any, dateStr: string, slotDurationMinutes: number): { start: Date; end: Date }[] {
  const day = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const wh = workingHours[day];
  if (!wh || !wh.enabled) return [];
  const [sh, sm] = wh.start.split(':').map(Number);
  const [eh, em] = wh.end.split(':').map(Number);
  const start = new Date(dateStr + 'T00:00:00');
  start.setHours(sh, sm, 0, 0);
  const end = new Date(dateStr + 'T00:00:00');
  end.setHours(eh, em, 0, 0);
  const slots: { start: Date; end: Date }[] = [];
  let cur = new Date(start);
  while (cur.getTime() + slotDurationMinutes * 60000 <= end.getTime()) {
    const slotEnd = addMinutes(cur, slotDurationMinutes);
    slots.push({ start: new Date(cur), end: slotEnd });
    cur = new Date(slotEnd);
  }
  return slots;
}
