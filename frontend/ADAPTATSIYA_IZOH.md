# Universitet uchun moslashtirish bo'yicha izoh

## Qilingan asosiy o'zgarishlar
- Ichki ishlar va harbiy o'q otishga oid foydalanuvchi ko'radigan matnlar olib tashlandi.
- Loyiha `kamon otish imtihoni` formatiga moslashtirildi.
- Qurol tanlash bloki o'rniga `3 ta sinov + 5 ta baholash urinish` formati qo'yildi.
- Natijalar jadvali va PDF hisobot universitet imtihoni uslubiga o'tkazildi.
- Login sahifasi va footer matnlari yangilandi.
- Eski nusxa (`copy`) fayllari olib tashlandi.
- TypeScript kompilyatsiyasi tekshirildi va o'tdi.

## Muhim eslatma
Frontend qismi tozalandi. Lekin backend bilan moslik saqlanishi uchun `src/services/api.ts` ichida eski backend endpointlariga mos keluvchi legacy fallback mavjud. Agar backend ham universitet uchun to'liq yangilanadigan bo'lsa, shu fayldagi legacy fallback qismini ham olib tashlash kerak.
