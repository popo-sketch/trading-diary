# Trading Diary - 테스트 체크리스트 및 버그 리스트

## 1. 데이터 입력/수정

### Add Coin (거래 추가)
- [ ] 모든 필드 입력 → DB 저장 확인
  - Date, Ticker, Chain, CA, PnL, Return%, Trade Type, Avg Entry MC
- [ ] 필수 필드 (Date, Ticker, PnL, Return%) 비어있을 때 에러 메시지
- [ ] Return% = 0 입력 시 에러 메시지
- [ ] PnL과 Return% 부호 불일치 시 자동 정규화 확인
- [ ] Entry Amount 자동 계산 정확성
- [ ] Avg Entry MC 입력 시 콤마 포맷 (100,000)
- [ ] Exit Entry MC 자동 계산: `Avg Entry MC × (1 + Return% / 100)`
- [ ] 거래 추가 후 통계 자동 갱신 확인

### 거래 수정
- [ ] PnL 수정 → Entry Amount 재계산 확인
- [ ] Return% 수정 → Entry Amount 재계산 확인
- [ ] Trade Type 수정 확인
- [ ] Memo 수정 확인
- [ ] Avg Entry MC 수정 → Exit Entry MC 자동 업데이트 확인
- [ ] 수정 후 통계 재계산 확인

### 거래 삭제
- [ ] 삭제 확인 다이얼로그 표시
- [ ] 삭제 후 통계 재계산 확인
- [ ] 삭제 후 캘린더에서 해당 날짜 PnL 업데이트 확인

## 2. 캘린더 화면

### 월간 통계
- [ ] 월간 PnL 합계 정확성: `sum(all trades.pnl) === stats.total_pnl`
- [ ] Win/Loss 카운트: `wins + losses === total_trades`
- [ ] Win Rate 계산: `(wins / total_trades) * 100`
- [ ] Best/Worst 거래 표시 정확성

### 날짜별 표시
- [ ] 날짜별 PnL 합계 정확성 (같은 날 여러 거래)
- [ ] 날짜별 거래 개수 (● 점 개수) 정확성
- [ ] 점(●) 색상: 초록(양수), 빨강(음수), 회색(0)
- [ ] 날짜 클릭 → 일별 상세 페이지 이동

### 월 이동
- [ ] 이전 월 이동 시 데이터 로딩
- [ ] 다음 월 이동 시 데이터 로딩
- [ ] 연도 변경 시 데이터 로딩
- [ ] 로딩 중 스피너 표시
- [ ] 데이터 없을 때 "No Data" 표시

## 3. Equity Curve & EV Curve

### Equity Curve (좌측)
- [ ] Y축 색상: 양수 초록(#10B981), 음수 빨강(#EF4444)
- [ ] 0 기준선 점선 표시 (데이터가 0을 포함할 때)
- [ ] Max Drawdown 계산 정확성
- [ ] Current Equity = 마지막 cumulative_pnl
- [ ] High Water Mark 표시 (파란 점)
- [ ] 호버 시 툴팁 표시 (날짜, PnL)

### Expected Value Curve (우측)
- [ ] Y축: 퍼센트(%) 단위
- [ ] 0% 기준선 점선 항상 표시
- [ ] Current EV 계산: 마지막 ev_percent
- [ ] Kelly% 계산 및 표시
- [ ] 색상: 양수 초록, 음수 빨강
- [ ] 배경색: 양수 영역 초록 투명, 음수 영역 빨강 투명

### 레이아웃
- [ ] 두 차트 동일 높이 (200px)
- [ ] 차트 사이 얇은 구분선
- [ ] 반응형: 작은 화면에서도 깨지지 않음

## 4. Flow Status Module

### 표시 위치
- [ ] "February 2026" 왼쪽 정렬
- [ ] Flow Status 가운데 정렬
- [ ] 두 줄 모두 가운데 정렬

### 메시지
- [ ] 모든 시그널 정확히 트리거되는지
- [ ] 우선순위 정확성 (A → B → C → D → E → F → G)
- [ ] 색상: RED, BLUE, WHITE
- [ ] 메시지 길이 80자 이내
- [ ] `[FLOW]` 제거 확인

## 5. Position Size & Trade Type 테이블

### Position Size Buckets
- [ ] 버킷별 통계 정확성
- [ ] Total PnL 합계 = 전체 Total PnL
- [ ] EV%, Kelly% 계산 정확성

### Trade Type Stats
- [ ] 타입별 통계 정확성
- [ ] Total PnL 합계 = 전체 Total PnL

## 6. 입력 검증

### 숫자 필드
- [ ] PnL에 문자 입력 시 처리
- [ ] Return%에 문자 입력 시 처리
- [ ] Avg Entry MC에 문자 입력 시 처리 (콤마는 허용)
- [ ] 음수 입력 허용 여부 확인

### 날짜 필드
- [ ] 날짜 형식 검증 (YYYY-MM-DD)
- [ ] 미래 날짜 입력 가능 여부 확인

### 필수 필드
- [ ] Date 비어있을 때 에러
- [ ] Ticker 비어있을 때 에러
- [ ] PnL 비어있을 때 에러
- [ ] Return% 비어있을 때 에러

## 7. API 에러 처리

### 백엔드 연결 실패
- [ ] 네트워크 에러 시 에러 메시지 표시
- [ ] 500 에러 시 에러 메시지 표시
- [ ] 타임아웃 처리

### 데이터 로딩 실패
- [ ] Fallback UI 표시
- [ ] Flow Status: "Data unavailable" 메시지
- [ ] 빈 상태에서도 앱이 크래시하지 않음

## 8. 계산 에러 방지

### Division by Zero
- [ ] Return% = 0 체크 (이미 구현됨)
- [ ] Avg Win% = 0일 때 Kelly% 계산 (0 반환)

### NaN, Infinity 처리
- [ ] 모든 숫자 계산에 `Number.isFinite()` 체크
- [ ] 포맷 함수에서 NaN 처리

### Null/Undefined 방어
- [ ] 모든 데이터 접근에 옵셔널 체이닝 (`?.`)
- [ ] 기본값 설정 (`??`)

## 9. 성능

- [ ] 월 전환 속도 (< 500ms)
- [ ] 거래 추가/수정/삭제 반응 속도 (< 300ms)
- [ ] 차트 렌더링 속도 (< 1s)
- [ ] 메모리 누수 확인 (월 전환 반복 시)

## 10. 데이터 정합성

### 통계 합계 검증
- [ ] `sum(buckets.total_pnl) === stats.total_pnl`
- [ ] `sum(type_stats.total_pnl) === stats.total_pnl`
- [ ] `wins + losses === total_trades`
- [ ] `equity_curve[last].cumulative_pnl === stats.total_pnl`

### 계산 정확성
- [ ] Entry Amount = PnL / (Return% / 100)
- [ ] Exit Entry MC = Avg Entry MC × (1 + Return% / 100)
- [ ] EV% = Win Rate × Avg Win% - Loss Rate × Avg Loss%
- [ ] Kelly% = (Win Rate × Avg Win% - Loss Rate × Avg Loss%) / Avg Win%

## 11. UI/UX

### 레이아웃
- [ ] 모든 요소 정렬 확인
- [ ] 여백/간격 일관성
- [ ] 반응형 (모바일, 태블릿, 데스크톱)

### 폰트/텍스트
- [ ] 가독성 확인
- [ ] 숫자 포맷 일관성 ($1.2K, 45.5%)
- [ ] 영어 표시 (한글 없음)

### 접근성
- [ ] 키보드 네비게이션 (Tab, Enter, Escape)
- [ ] 모달 ESC 키로 닫기
- [ ] 포커스 관리

---

# 버그 리스트

## [버그 #1] TradeMemoModal: Return% 수정 시 부호 정규화 누락 ✅ 수정됨
- **재현 방법:**
  1. 거래 수정 모달 열기
  2. PnL = -100, Return% = 50 입력
  3. 저장
- **원인:**
  - `TradeMemoModal.jsx`의 `handleSave`에서 부호 정규화 로직 없음
  - `AddTradeModal`에는 있지만 `TradeMemoModal`에는 없음
- **수정 완료:**
  - `TradeMemoModal.jsx`의 `handleSave`에 부호 정규화 로직 추가
  - PnL과 Return% 부호 불일치 시 자동 정규화

## [버그 #2] Exit Entry MC 계산: Return% 변경 시 실시간 업데이트 누락
- **재현 방법:**
  1. Add Trade 모달에서 Avg Entry MC = 100000 입력
  2. Return% = 50 입력 → Exit Entry MC = $150.0K 표시됨
  3. Return%를 -50으로 변경
  4. Exit Entry MC가 즉시 업데이트되지 않을 수 있음
- **원인:**
  - `exitEntryMc` 계산이 `returnPercent` 변경에 즉시 반응하지 않을 수 있음
- **수정 방법:**
  - `useMemo` 또는 `useEffect`로 `returnPercent` 변경 감지하여 재계산
  - 현재 코드 확인 필요

## [버그 #3] Calendar: 같은 날짜 여러 거래 시 PnL 합계 정확성
- **재현 방법:**
  1. 같은 날짜에 거래 3개 추가 (PnL: +100, -50, +200)
  2. 캘린더에서 해당 날짜 PnL 확인
- **예상:** +250 표시
- **원인:**
  - `dailyPnl` 계산 로직 확인 필요
- **수정 방법:**
  - 현재 코드는 정확해 보임: `map[t.date] = (map[t.date] ?? 0) + Number(t.pnl || 0)`
  - 테스트로 검증 필요

## [버그 #4] Equity Curve: 데이터가 1개일 때 차트 깨짐 가능성 ✅ 수정됨
- **재현 방법:**
  1. 월에 거래 1개만 추가
  2. Equity Curve 확인
- **원인:**
  - `points` 계산 시 `data.length - 1`이 0이 되어 division by zero 가능
- **수정 완료:**
  - `EquityChart`와 `EvChart` 모두에서 `data.length === 1` 체크 추가
  - `pathData`도 단일 포인트일 때 처리 추가

## [버그 #5] Flow Status: Entry MC Bucket 계산 미사용
- **재현 방법:**
  - 코드에서 `entryMCBucketStats` 계산하지만 실제 시그널에서 사용하지 않음
- **원인:**
  - `flowStatusSignals.js`에서 Entry MC bucket 통계는 계산하지만 시그널 로직에서 활용 안 함
- **수정 방법:**
  - Entry MC bucket도 Oversizing/Edge Confirmed 시그널에 포함하거나
  - 계산 코드 제거 (성능 최적화)

## [버그 #6] formatDollarKMB: 0 값 처리 ✅ 수정됨
- **재현 방법:**
  - `formatDollarKMB(0)` 호출 시 `$0.0` 반환 (소수점 불필요)
- **원인:**
  - `abs.toFixed(1)`로 인해 0도 `$0.0`으로 표시
- **수정 완료:**
  - `formatDollarKMB` 함수에 `if (abs === 0) return '$0'` 추가

## [버그 #7] TradeMemoModal: Avg Entry MC 수정 시 Exit Entry MC 업데이트
- **재현 방법:**
  1. 거래 수정 모달 열기
  2. Avg Entry MC 수정
  3. Exit Entry MC가 즉시 업데이트되는지 확인
- **원인:**
  - `exitEntryMc` 계산이 `avgEntryMc`와 `returnPercent` 모두에 의존
  - `useMemo`로 처리되어 있어야 함 (확인 필요)

## [버그 #8] Calendar: Flow Status가 없을 때 레이아웃 깨짐 가능성
- **재현 방법:**
  1. 거래가 10개 미만인 월 선택
  2. Flow Status가 "Insufficient Data"로 표시됨
  3. 레이아웃 확인
- **원인:**
  - `absolute` positioning 사용 시 부모 컨테이너 높이 문제 가능
- **수정 방법:**
  - 레이아웃 테스트 필요

## [버그 #9] Analytics API: bucket_filter 사용 시 ev_curve 누락 가능성
- **재현 방법:**
  1. Analytics API에 `bucket_filter` 파라미터 전달
  2. `ev_curve`가 해당 bucket만 포함하는지 확인
- **원인:**
  - `bucket_trades_for_ev`가 `include_in_bucket`일 때만 추가됨
  - 정확하지만 테스트 필요

## [버그 #10] Flow Status: 최근 10개 거래 정렬 순서
- **재현 방법:**
  1. 같은 날짜에 여러 거래 추가
  2. Flow Status의 "Last 10 trades" 확인
- **원인:**
  - `created_at`으로 정렬하지만, 같은 날짜면 순서가 불명확할 수 있음
- **수정 방법:**
  - 정렬 로직 확인: `date` 먼저, 그 다음 `created_at` (이미 구현됨)

---

# 우선순위별 수정 권장사항

## 높음 (Critical) ✅ 모두 수정됨
1. ~~**버그 #1**: TradeMemoModal 부호 정규화 누락~~ ✅
2. ~~**버그 #4**: Equity Curve 데이터 1개일 때 처리~~ ✅

## 중간 (Medium)
3. **버그 #2**: Exit Entry MC 실시간 업데이트 (확인 필요 - useMemo로 처리되어 있어야 함)
4. ~~**버그 #6**: formatDollarKMB 0 값 처리~~ ✅
5. **버그 #7**: TradeMemoModal Exit Entry MC 업데이트 (확인 필요 - useMemo로 처리되어 있어야 함)

## 낮음 (Low)
6. **버그 #5**: Entry MC Bucket 미사용 코드 정리
7. **버그 #8**: Calendar 레이아웃 테스트
8. **버그 #9**: Analytics API bucket_filter 테스트
9. **버그 #10**: 정렬 순서 검증

---

# 추가 개선 사항

1. **에러 바운더리 추가**: React Error Boundary로 예상치 못한 에러 처리
2. **로딩 상태 개선**: 각 섹션별 개별 로딩 상태
3. **캐싱**: 월별 데이터 캐싱으로 성능 개선
4. **유효성 검사 강화**: 클라이언트/서버 양쪽 검증
5. **접근성**: ARIA 레이블, 키보드 네비게이션 개선
