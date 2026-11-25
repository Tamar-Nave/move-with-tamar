// Studio defaults for new classes. Every value can be changed by hand when adding a class.
export const CLASS_DEFAULTS = {
  reminderMinutes: 120,        // reminder notification 2 hours before the class
  morningReminderMinutes: 780, // ...but morning classes: 13 hours before (the evening before)
  cancelHours: 3,              // members can cancel until 3 hours before
  morningCancelHours: 12,      // ...but morning classes: until 12 hours before
  morningBeforeHour: 12,       // a class starting before 12:00 counts as a morning class
  waitlistConfirmMinutes: 10,
  // Registration opens every Thursday at 20:00 for the following week (weeks start on Sunday).
  openWeekday: 'thursday',
  openTime: '20:00',
} as const;

export const isMorningClass = (hhmm: string) => {
  const hour = Number(hhmm.slice(0, 2));
  return Number.isFinite(hour) && hour < CLASS_DEFAULTS.morningBeforeHour;
};

export const defaultReminderMinutes = (hhmm: string) =>
  isMorningClass(hhmm) ? CLASS_DEFAULTS.morningReminderMinutes : CLASS_DEFAULTS.reminderMinutes;

export const defaultCancelHours = (hhmm: string) =>
  isMorningClass(hhmm) ? CLASS_DEFAULTS.morningCancelHours : CLASS_DEFAULTS.cancelHours;
