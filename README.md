# PNL Calendar - 트레이딩 복기용 일지

월간 PNL 캘린더와 거래 복기 기능을 제공하는 웹 애플리케이션입니다.

## 프로젝트 구조

```
trading-diary/
├── frontend/     # React + Vite + Tailwind
└── backend/      # FastAPI + SQLite
```

## 실행 방법

### 1. 백엔드 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

## 기술 스택

**Frontend:** React, Vite, Tailwind CSS, React Router, Axios  
**Backend:** FastAPI, SQLite, Pydantic, CORS

## 주요 기능

- **월간 PNL 캘린더**: 일별 손익 시각화 및 통계
- **거래 복기**: 메모 작성 및 관리
- **고급 분석** (`/stats`):
  - Position Size Bucket Analysis (EV%, EV$ 계산)
  - Trade Type Analysis (Viral, Cult, KOL/Cabal, Political, Reversal, AI)
  - Equity Curve (누적 PNL 차트)
- **자동 Entry Amount 계산**: PnL과 Return % 입력 시 자동 계산

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/trades?year=&month= | 월별 거래 목록 |
| GET | /api/trades/daily?date= | 일별 거래 목록 |
| POST | /api/trades | 거래 추가 |
| PUT | /api/trades/{id} | 거래 수정 |
| DELETE | /api/trades/{id} | 거래 삭제 |
| GET | /api/stats?year=&month= | 월간 통계 |
| GET | /api/analytics?year=&month=&bucket_filter= | 고급 분석 (Position Size Buckets, Trade Type Stats, Equity Curve) |
