# Nishon Arena Backend

Bu backend arena/session modeliga moslashtirildi.

## Ko'rinadigan asosiy API lar
- GET /ai/health
- GET /ai/cameras
- GET /ai/cameras/{camera_id}
- POST /ai/cameras/{camera_id}/activate
- POST /ai/cameras/{camera_id}/clear-baseline
- GET /ai/cameras/{camera_id}/test-capture
- POST /arena/sessions
- GET /arena/sessions
- GET /arena/sessions/{session_id}
- POST /arena/sessions/{session_id}/players
- POST /arena/sessions/{session_id}/start
- POST /arena/sessions/{session_id}/finish
- GET /arena/sessions/{session_id}/scoreboard
- GET /arena/sessions/{session_id}/shots
- POST /arena/sessions/{session_id}/players/{player_id}/capture

## Ishga tushirish
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## Izoh
- AI model eski impact detektordan foydalanadi
- arena capture route scoringni archery/rifle profile bo'yicha qayta hisoblaydi
- eski participant/soldier endpointlar schema'dan yashirildi
