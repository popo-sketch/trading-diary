# 테스트 결과 분석

## 코드 로직 검토 결과

### ✅ 테스트 1: Exit Entry MC 자동 계산

**AddTradeModal.jsx (32줄):**
```javascript
const exitEntryMc = (avgEntryMcNum != null && returnPercent !== '' && !isNaN(Number(returnPercent)))
  ? avgEntryMcNum * (1 + Number(returnPercent) / 100)
  : null
```
- ✅ **정상 동작**: `avgEntryMc` 또는 `returnPercent` 변경 시 컴포넌트 리렌더링으로 자동 재계산
- ✅ **실시간 업데이트**: React의 상태 관리로 즉시 반영됨
- ⚠️ **주의**: `returnPercent`가 빈 문자열일 때 `null` 반환 (정상)

**TradeMemoModal.jsx (50줄):**
```javascript
const exitEntryMc =
  avgEntryMcNum != null && returnNum != null && Number.isFinite(returnNum)
    ? avgEntryMcNum * (1 + returnNum / 100)
    : null
```
- ✅ **정상 동작**: `useMemo` 없이도 상태 변경 시 자동 재계산
- ✅ **실시간 업데이트**: `avgEntryMc` 또는 `returnPercent` 변경 시 즉시 반영

**결론**: 두 모달 모두 정상 동작 ✅

---

### ✅ 테스트 2: 같은 날짜 여러 거래 PnL 합계

**MainPage.jsx (54-59줄):**
```javascript
const dailyPnl = useMemo(() => {
  const map = {}
  trades.forEach((t) => {
    map[t.date] = (map[t.date] ?? 0) + Number(t.pnl || 0)
  })
  return map
}, [trades])
```

**로직 분석:**
- ✅ 각 거래의 `date`를 키로 사용
- ✅ 같은 날짜면 누적 합산: `(map[t.date] ?? 0) + Number(t.pnl || 0)`
- ✅ `null`/`undefined` 처리: `t.pnl || 0`로 0으로 변환

**예시 검증:**
- 2/10: +$1K, +$2K, -$500 → `0 + 1000 + 2000 + (-500) = 2500` ✅
- 2/11: +$3K, -$1K → `0 + 3000 + (-1000) = 2000` ✅

**결론**: 로직 정확함 ✅

---

### ✅ 테스트 3: Flow Status 최근 10개 거래 정렬

**flowStatusSignals.js (135-140줄):**
```javascript
const sortedTrades = [...(trades ?? [])].sort((a, b) => {
  const d = (b.date || '').localeCompare(a.date || '')
  if (d !== 0) return d
  return (b.created_at || '').localeCompare(a.created_at || '')
})
const lastNTrades = sortedTrades.slice(0, lastN)
```

**로직 분석:**
- ✅ 1차 정렬: `date` 내림차순 (최신 날짜 먼저)
- ✅ 2차 정렬: 같은 날짜면 `created_at` 내림차순 (최신 시간 먼저)
- ✅ `localeCompare` 사용으로 문자열 정렬 정확

**예시 검증:**
```
입력:
- 2/1 09:00
- 2/1 11:00
- 2/1 10:00
- 2/2 10:00
- 2/3 09:00
- 2/3 10:00

정렬 결과 (예상):
1. 2/3 10:00
2. 2/3 09:00
3. 2/2 10:00
4. 2/1 11:00
5. 2/1 10:00
6. 2/1 09:00
```

**결론**: 로직 정확함 ✅

---

### ✅ 테스트 4: Analytics API bucket_filter EV curve

**analytics.py (112-129줄):**
```python
# Equity curve (bucket filter 적용)
if include_in_bucket:
    cumulative_pnl += pnl
    equity_curve.append({"date": date, "cumulative_pnl": cumulative_pnl})
    # EV curve: 해당 시점까지 누적 거래로 EV% 계산
    bucket_trades_for_ev.append({"pnl": pnl, "return_percent": return_percent})
    wins_ev = [t for t in bucket_trades_for_ev if t["pnl"] > 0]
    losses_ev = [t for t in bucket_trades_for_ev if t["pnl"] <= 0]
    n = len(bucket_trades_for_ev)
    if n > 0:
        win_rate = len(wins_ev) / n
        loss_rate = 1 - win_rate
        avg_win_pct = sum(t["return_percent"] for t in wins_ev) / len(wins_ev) if wins_ev else 0
        avg_loss_pct = sum(t["return_percent"] for t in losses_ev) / len(losses_ev) if losses_ev else 0
        ev_percent = (win_rate * avg_win_pct) - (loss_rate * abs(avg_loss_pct))
    else:
        ev_percent = 0.0
    ev_curve.append({"date": date, "ev_percent": round(ev_percent, 2)})
```

**로직 분석:**
- ✅ `include_in_bucket`가 `True`일 때만 `bucket_trades_for_ev`에 추가
- ✅ 각 거래마다 **누적** EV% 계산 (월 시작부터 해당 날짜까지)
- ✅ `bucket_filter` 파라미터가 있으면 해당 bucket만 포함

**예시 검증:**
```
bucket_filter = "$1K-$5K"

거래:
- 2/1: $1K-$5K, +10%, +$200
- 2/2: $1K-$5K, -5%, -$100
- 2/3: >$10K, +20%, +$3000 (제외됨)
- 2/4: $1K-$5K, +15%, +$300

EV Curve:
- 2/1: EV = (1.0 * 10) - (0 * 0) = 10%
- 2/2: EV = (0.5 * 10) - (0.5 * 5) = 2.5%
- 2/4: EV = (0.67 * 12.5) - (0.33 * 5) = 6.25%
```

**결론**: 로직 정확함 ✅

---

## 실제 테스트 실행 방법

### 브라우저 콘솔에서 실행:

```javascript
// 전체 테스트 실행
import('./src/utils/testFlowStatus.js').then(m => m.runAllTests())

// 개별 테스트
import('./src/utils/testFlowStatus.js').then(m => {
  m.testExitEntryMcCalculation()
  m.testDailyPnlSum()
  m.testLast10TradesSorting()
  m.testBucketFilterEvCurve()
})
```

### 수동 테스트 시나리오:

#### 1. Exit Entry MC 실시간 업데이트
1. Add Trade 모달 열기
2. Avg Entry MC에 `100000` 입력 → Exit Entry MC 확인
3. Return%에 `50` 입력 → Exit Entry MC가 `$150.0K`로 변경되는지 확인
4. Return%를 `-50`으로 변경 → Exit Entry MC가 `$50.0K`로 변경되는지 확인

#### 2. 같은 날짜 여러 거래 PnL 합계
1. 같은 날짜에 거래 3개 추가:
   - 거래 1: PnL +$1K
   - 거래 2: PnL +$2K
   - 거래 3: PnL -$500
2. 캘린더에서 해당 날짜 확인 → `+$2.5K` 표시되는지 확인

#### 3. Flow Status 정렬
1. 같은 날짜에 여러 거래 추가 (다른 시간)
2. Flow Status의 "Last 10 trades" 로직 확인
3. 날짜 최신순, 같은 날짜면 시간 최신순인지 확인

#### 4. bucket_filter EV curve
1. Analytics API 호출: `/api/analytics?year=2026&month=2&bucket_filter=$1K-$5K`
2. `ev_curve` 응답 확인
3. 해당 bucket 거래만 포함되는지 확인
4. EV%가 누적 계산되는지 확인

---

## 코드 검토 결론

모든 로직이 **정확하게 구현**되어 있습니다:
- ✅ Exit Entry MC: 실시간 자동 계산
- ✅ Daily PnL 합계: 정확한 누적 계산
- ✅ 거래 정렬: 날짜 → 시간 내림차순 정확
- ✅ bucket_filter EV curve: 필터 적용 및 누적 계산 정확

**실제 데이터로 테스트**하여 UI 동작을 확인하는 것을 권장합니다.
