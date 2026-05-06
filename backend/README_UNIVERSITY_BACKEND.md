# Universitet uchun minimal backend

Bu variantda keraksiz API lar olib tashlandi yoki Swaggerdan yashirildi. Endi hujjatda faqat universitet frontend ishlatadigan asosiy endpointlar qoladi.

## Swaggerda ko'rinadigan endpointlar

- `GET /ai/health`
- `GET /ai/cameras`
- `GET /ai/cameras/{camera_id}`
- `POST /ai/cameras/{camera_id}/activate`
- `POST /ai/cameras/{camera_id}/clear-baseline`
- `GET /ai/cameras/{camera_id}/test-capture`
- `POST /ai/cameras/{camera_id}/capture`
- `POST /ai/participants/{participant_id}/start`
- `GET /ai/participants/{participant_id}/status`
- `POST /ai/participants/{participant_id}/complete`

## Nimalar olib tashlandi

- `region`, `branch`, `user`, `employee`, `result` CRUD routerlari app ichidan chiqarildi
- eski `soldiers/*` alias endpointlari saqlangan, lekin Swaggerda yashirilgan
- stream diagnostika, compare, websocketga oid servis endpointlari Swaggerda yashirilgan
- endi yo'llar `/api/v1/ai/...` emas, to'g'ridan-to'g'ri `/ai/...`

## Nega bu yaxshiroq

- diplom himoyasida API soddaroq ko'rinadi
- frontend bilan URL mosligi to'g'rilandi
- ichki ishlar tizimiga oid ortiqcha modul va CRUD lar ko'rinmaydi

## Ishga tushirish

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Eslatma

Kamera ma'lumotlari bazada bo'lishi kerak. `activate` ishlashi uchun `cameras` jadvalida RTSP ma'lumotlari saqlangan kamera yozuvi mavjud bo'lsin.
