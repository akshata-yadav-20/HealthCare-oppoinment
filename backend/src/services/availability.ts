import { isMockMode, getMockStore, getPrisma } from '../config/prisma';
import { generateSlots } from '../utils/helpers';
export async function getDoctorWithLeaves(doctorId: string) {
  if (isMockMode()) {
    const store = getMockStore();
    const doc = store.doctorProfiles.find(d=>d.id===doctorId);
    if (!doc) return null;
    const leaves = store.doctorLeaves.filter(l=>l.doctorId===doctorId);
    return { ...doc, leaves };
  } else {
    const prisma = getPrisma();
    return prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { leaves: true } as any });
  }
}
export async function getAvailableSlots(doctorId: string, dateStr: string) {
  const doctor = await getDoctorWithLeaves(doctorId);
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { status: 404 });
  const slots = generateSlots(doctor.workingHours, dateStr, doctor.slotDurationMinutes);
  const isOnLeave = (doctor as any).leaves?.some((l:any)=>{
    const d = new Date(dateStr);
    const s = new Date(l.startDate); const e = new Date(l.endDate);
    const d0 = new Date(d.toISOString().slice(0,10));
    const s0 = new Date(new Date(s).toISOString().slice(0,10));
    const e0 = new Date(new Date(e).toISOString().slice(0,10));
    return d0 >= s0 && d0 <= e0;
  });
  if (isOnLeave) return [];
  let bookings: any[] = [];
  const dayStart = new Date(dateStr + 'T00:00:00');
  const dayEnd = new Date(dateStr + 'T23:59:59');
  if (isMockMode()) {
    const store = getMockStore();
    bookings = store.appointments.filter(a=>a.doctorId===doctorId && new Date(a.slotStart) >= dayStart && new Date(a.slotStart) <= dayEnd && (a.status==='HELD' || a.status==='CONFIRMED') && (!a.holdExpiresAt || new Date(a.holdExpiresAt) > new Date()));
  } else {
    const prisma = getPrisma();
    bookings = await prisma.appointment.findMany({ where: { doctorId, slotStart: { gte: dayStart, lte: dayEnd }, status: { in: ['HELD','CONFIRMED'] } } as any });
    bookings = bookings.filter((b:any)=> !b.holdExpiresAt || new Date(b.holdExpiresAt) > new Date());
  }
  const bookedSet = new Set(bookings.map((b:any)=> new Date(b.slotStart).toISOString()));
  return slots.filter(s=> !bookedSet.has(s.start.toISOString())).map(s=> ({ start: s.start.toISOString(), end: s.end.toISOString() }));
}
export async function isSlotAvailable(doctorId: string, slotStart: Date): Promise<boolean> {
  const dateStr = slotStart.toISOString().slice(0,10);
  const slots = await getAvailableSlots(doctorId, dateStr);
  const iso = slotStart.toISOString();
  return slots.some(s=> s.start === iso);
}
