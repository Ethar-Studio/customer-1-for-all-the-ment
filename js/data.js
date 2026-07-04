/* ============================================================
   ALL MEN SALON — static shop data
   Names/descriptions carry {en, ar} pairs; UI strings live in i18n.js
   ============================================================ */

window.CURRENCY = { en: 'SAR', ar: 'ر.س' };

/* Loyalty punch card: complete `goal` haircuts and the next one is free.
   Only reservations the admin marks "done" (status 'completed') that include
   one of `haircutServices` count toward it. */
window.LOYALTY = { goal: 5, haircutServices: ['haircut', 'combo'] };

/* completed haircut count -> { stamps 0..goal, freeEarned } */
window.loyaltyStatus = function (completedCount) {
  const cycle = window.LOYALTY.goal + 1;           // e.g. 6 (5 paid + 1 free)
  const stamps = ((completedCount % cycle) + cycle) % cycle;
  return { stamps, goal: window.LOYALTY.goal, freeEarned: stamps === window.LOYALTY.goal };
};

/* does a reservation count as a completed haircut? */
window.isCompletedHaircut = function (r) {
  return r && r.status === 'completed' &&
    (r.serviceIds || []).some((id) => window.LOYALTY.haircutServices.includes(id));
};

window.BARBERS = [
  { id: 'reda',  num: '01', name: { en: 'Reda',  ar: 'رضا' },  role: { en: 'Barber', ar: 'حلاق' } },
  { id: 'walid', num: '02', name: { en: 'Walid', ar: 'وليد' }, role: { en: 'Barber', ar: 'حلاق' } },
];

/* Real menu — prices from the shop. Durations are estimates; adjust freely. */
window.SERVICES = [
  { id: 'haircut', num: '01', min: 30, price: 25,
    name: { en: 'Haircut', ar: 'قص شعر' },
    desc: { en: 'Scissor or clipper cut, finished and styled.', ar: 'قص بالمقص أو الماكينة مع تصفيف نهائي.' } },
  { id: 'beard', num: '02', min: 15, price: 15,
    name: { en: 'Beard Trim & Shave', ar: 'حلاقة اللحية' },
    desc: { en: 'Shape, line-up and clean shave for the beard.', ar: 'تحديد وتشكيل وحلاقة نظيفة للحية.' } },
  { id: 'combo', num: '03', min: 45, price: 40,
    name: { en: 'Haircut + Beard', ar: 'قص شعر + لحية' },
    desc: { en: 'The full package — cut and beard in one sitting.', ar: 'الباقة الكاملة — قص الشعر وحلاقة اللحية في جلسة واحدة.' } },
  { id: 'wash', num: '04', min: 10, price: 5,
    name: { en: 'Hair Wash', ar: 'غسيل شعر' },
    desc: { en: 'Wash and quick dry before or after the cut.', ar: 'غسيل وتجفيف سريع قبل القصة أو بعدها.' } },
  { id: 'wax', num: '05', min: 10, price: 10,
    name: { en: 'Nose & Ear Wax', ar: 'شمع الأنف والأذن' },
    desc: { en: 'Quick and clean wax treatment.', ar: 'إزالة سريعة ونظيفة بالشمع.' } },
  { id: 'facial', num: '06', min: 20, price: 20,
    name: { en: 'Simple Facial Cleanse', ar: 'تنظيف بشرة بسيط' },
    desc: { en: 'Refreshing cleanse for the face after the cut.', ar: 'تنظيف منعش للبشرة بعد الحلاقة.' } },
  { id: 'bearddye', num: '07', min: 20, price: 20,
    name: { en: 'Beard Dye', ar: 'صبغة اللحية' },
    desc: { en: 'Even, natural-looking colour for the beard.', ar: 'لون متجانس وطبيعي للحية.' } },
  { id: 'hairdye', num: '08', min: 45, price: 40,
    name: { en: 'Hair Dye', ar: 'صبغة الشعر' },
    desc: { en: 'Full hair colour, applied and rinsed in-chair.', ar: 'صبغة كاملة للشعر تُطبّق وتُغسل على الكرسي.' } },
  { id: 'oilbath', num: '09', min: 30, price: 30,
    name: { en: 'Oil Bath / Hair Mask', ar: 'حمام زيت أو ماسك للشعر' },
    desc: { en: 'Deep treatment to restore the hair.', ar: 'عناية عميقة لاستعادة صحة الشعر.' } },
];

/* Opening hours — day 0 = Sunday … 5 = Friday, 6 = Saturday
   [openHour, closeHour] in 24h; null = closed */
window.HOURS = {
  0: [10, 22],  // Sunday
  1: [10, 22],  // Monday
  2: [10, 22],  // Tuesday
  3: [10, 22],  // Wednesday
  4: [10, 23],  // Thursday
  5: [14, 23],  // Friday — opens after Jumu'ah
  6: [10, 22],  // Saturday
};

window.LOCATION = {
  address: {
    en: 'Al Aqrabiyah District, Al Khobar 34445',
    ar: 'حي العقربية، الخبر ٣٤٤٤٥',
  },
  plusCode: '852M+59',
  phone: '+966 55 000 0000',
  instagram: '@forallmen.sa',
  mapsQuery: 'All Men Salon صالون لكل الرجال للحلاقة, Al Aqrabiyah, Al Khobar',
  mapsLink: 'https://maps.app.goo.gl/pyUCiHUamSUmgTLU6',
};

/* --- Slot helpers --- */

window.slotTimesFor = function (dateObj) {
  const hours = window.HOURS[dateObj.getDay()];
  if (!hours) return [];
  const [open, close] = hours;
  const out = [];
  for (let h = open; h < close; h++) {
    out.push(String(h).padStart(2, '0') + ':00');
    out.push(String(h).padStart(2, '0') + ':30');
  }
  return out;
};

window.isoDate = function (d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
