/** เวลาที่ล็อกไว้ตอน reset (ศุกร์ 9 ต.ค. 2026 10:00 Asia/Bangkok) — วันที่ทั้งหมดใน test คิดจากค่านี้ */
export const LOCKED_NOW = '2026-10-09T10:00:00+07:00';
export const TODAY = '2026-10-09';
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/** ราคาต่อชั่วโมงตาม 04 BR-07 */
export const RATE = {
  A: { day: 800, evening: 1200 },
  B: { day: 800, evening: 1200 },
  C: { day: 1200, evening: 1800 },
} as const;

/** seed (SPEC ข้อ 1) */
export const SEED = {
  ton: { name: 'ต้น', phone: '0811111111', password: 'Ton12345' },
  mew: { name: 'มิว', phone: '0822222222', password: 'Mew12345' },
  joe: { name: 'โจ้', phone: '0833333333', password: 'Joe12345' },
  nan: { name: 'แนน', phone: '0844444444' },
  owner: { username: 'owner', password: 'Owner1234' },
  manager: { username: 'manager', password: 'Manager1234' },
  staff: { username: 'staff', password: 'Staff1234' },
} as const;
