"""
한국투자증권(KIS) WebSocket 실시간 체결 데이터 기반 1분봉 생성기

KIS WebSocket에서 수신하는 실시간 체결(H0STCNT0) 데이터를 집계하여
1분봉(OHLCV) 캔들을 실시간으로 생성·관리합니다.

사용법:
    manager = RealtimeCandleManager(
        app_key="YOUR_APP_KEY",
        app_secret="YOUR_APP_SECRET",
    )
    manager.add_stock("005930")  # 삼성전자
    manager.on_candle_closed = lambda candle: print(candle)
    asyncio.run(manager.start())
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Callable, Optional

import requests
import websockets

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 데이터 모델
# ──────────────────────────────────────────────
@dataclass
class CandleBar:
    """1분봉 캔들 데이터"""
    stock_code: str
    dt: datetime          # 분봉 시작 시각 (초·마이크로초 = 0)
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: int = 0       # 해당 분 누적 체결량
    trade_count: int = 0  # 해당 분 체결 건수
    is_closed: bool = False

    def update(self, price: float, qty: int) -> None:
        """새 체결 틱으로 캔들 업데이트"""
        if self.trade_count == 0:
            self.open = price
            self.high = price
            self.low = price
        else:
            self.high = max(self.high, price)
            self.low = min(self.low, price)
        self.close = price
        self.volume += qty
        self.trade_count += 1

    def to_dict(self) -> dict:
        d = asdict(self)
        d["dt"] = self.dt.strftime("%Y-%m-%d %H:%M:%S")
        return d

    def __repr__(self) -> str:
        sign = "▲" if self.close >= self.open else "▼"
        return (
            f"[{self.stock_code}] {self.dt:%H:%M} "
            f"O={self.open:,.0f} H={self.high:,.0f} "
            f"L={self.low:,.0f} C={self.close:,.0f} "
            f"V={self.volume:,} ({self.trade_count}건) {sign}"
        )


# ──────────────────────────────────────────────
# 종목별 캔들 버퍼
# ──────────────────────────────────────────────
class StockCandleBuffer:
    """
    단일 종목의 분봉 버퍼.
    - current : 현재 만들어지고 있는 (미완성) 캔들
    - history : 완성된 과거 캔들 (deque, 최대 max_history개 보관)
    """

    def __init__(self, stock_code: str, max_history: int = 1440):
        self.stock_code = stock_code
        self.max_history = max_history
        self.current: Optional[CandleBar] = None
        self.history: deque[CandleBar] = deque(maxlen=max_history)
        self._lock = threading.Lock()

    def _minute_key(self, dt: datetime) -> datetime:
        """datetime → 해당 분의 시작 시각(초·마이크로초 제거)"""
        return dt.replace(second=0, microsecond=0)

    def on_tick(
        self,
        price: float,
        qty: int,
        trade_time: datetime,
    ) -> Optional[CandleBar]:
        """
        새 체결 틱 수신 시 호출.
        분이 바뀌면 이전 캔들을 닫고 새 캔들을 시작한다.
        반환값: 방금 닫힌 캔들 (없으면 None)
        """
        minute = self._minute_key(trade_time)
        closed_candle: Optional[CandleBar] = None

        with self._lock:
            # ① 첫 틱이거나 분이 바뀐 경우 → 이전 캔들 마감
            if self.current is None or minute > self.current.dt:
                if self.current is not None and self.current.trade_count > 0:
                    self.current.is_closed = True
                    closed_candle = self.current
                    self.history.append(closed_candle)

                # 빈 분봉 채우기 (틱 없는 분은 직전 종가로 채움)
                if closed_candle is not None:
                    gap_minute = closed_candle.dt + timedelta(minutes=1)
                    while gap_minute < minute:
                        filler = CandleBar(
                            stock_code=self.stock_code,
                            dt=gap_minute,
                            open=closed_candle.close,
                            high=closed_candle.close,
                            low=closed_candle.close,
                            close=closed_candle.close,
                            volume=0,
                            trade_count=0,
                            is_closed=True,
                        )
                        self.history.append(filler)
                        gap_minute += timedelta(minutes=1)

                # 새 캔들 시작
                self.current = CandleBar(stock_code=self.stock_code, dt=minute)

            # ② 현재 캔들에 틱 반영
            self.current.update(price, qty)

        return closed_candle

    def get_current(self) -> Optional[CandleBar]:
        """현재(미완성) 캔들 반환"""
        with self._lock:
            return self.current

    def get_history(self, n: Optional[int] = None) -> list[CandleBar]:
        """최근 n개의 완성 캔들 반환 (n=None이면 전체)"""
        with self._lock:
            if n is None:
                return list(self.history)
            return list(self.history)[-n:]

    def get_all_candles(self, n: Optional[int] = None) -> list[CandleBar]:
        """완성 캔들 + 현재 캔들까지 포함하여 반환"""
        with self._lock:
            result = list(self.history)
            if self.current and self.current.trade_count > 0:
                result.append(self.current)
            if n is not None:
                result = result[-n:]
            return result


# ──────────────────────────────────────────────
# 메인 매니저
# ──────────────────────────────────────────────
class RealtimeCandleManager:
    """
    KIS WebSocket 실시간 체결 데이터 → 1분봉 변환 매니저

    Parameters
    ----------
    app_key : str
        KIS Open API appkey
    app_secret : str
        KIS Open API appsecret (= secretkey)
    is_mock : bool
        모의투자 여부 (기본 False). 모의투자는 실시간 시세 미지원이므로
        실전 WebSocket URL을 사용합니다.
    max_history : int
        종목당 보관할 최대 분봉 개수 (기본 1440 = 하루)
    ws_url : str | None
        KIS WebSocket URL (지정하지 않으면 실전 서버 사용)
    rest_url : str | None
        Approval Key 발급용 REST URL

    Callbacks
    ---------
    on_candle_closed : (CandleBar) -> None
        1분봉이 완성될 때마다 호출
    on_tick : (stock_code, price, qty, trade_time) -> None
        매 체결 틱마다 호출
    on_connected : () -> None
        WebSocket 연결 시 호출
    on_disconnected : () -> None
        WebSocket 연결 끊김 시 호출
    """

    # KIS WebSocket URL
    KIS_WS_URL = "ws://ops.koreainvestment.com:21000"
    KIS_REST_URL = "https://openapi.koreainvestment.com:9443"

    def __init__(
        self,
        app_key: str,
        app_secret: str,
        is_mock: bool = False,
        max_history: int = 1440,
        ws_url: Optional[str] = None,
        rest_url: Optional[str] = None,
    ):
        self.app_key = app_key
        self.app_secret = app_secret
        self.is_mock = is_mock
        self.max_history = max_history
        self.ws_url = ws_url or self.KIS_WS_URL
        self.rest_url = rest_url or self.KIS_REST_URL

        # 종목별 캔들 버퍼
        self._buffers: dict[str, StockCandleBuffer] = {}
        self._subscribed: set[str] = set()
        self._pending_subscribe: set[str] = set()

        # WebSocket 상태
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._approval_key: Optional[str] = None
        self._approval_key_expires: float = 0
        self._running = False
        self._reconnect_delay = 3

        # 콜백
        self.on_candle_closed: Optional[Callable[[CandleBar], None]] = None
        self.on_tick: Optional[Callable[[str, float, int, datetime], None]] = None
        self.on_connected: Optional[Callable[[], None]] = None
        self.on_disconnected: Optional[Callable[[], None]] = None

        # 통계
        self._tick_count = 0
        self._candle_count = 0
        self._last_tick_time: Optional[datetime] = None

    # ──────── Approval Key ────────
    def _get_approval_key(self) -> str:
        """KIS WebSocket 접속용 Approval Key 발급 (REST)"""
        if self._approval_key and time.time() < self._approval_key_expires:
            return self._approval_key

        url = f"{self.rest_url}/oauth2/Approval"
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "secretkey": self.app_secret,
        }
        resp = requests.post(url, json=body, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if "approval_key" not in data:
            raise RuntimeError(f"Approval key 발급 실패: {data}")

        self._approval_key = data["approval_key"]
        self._approval_key_expires = time.time() + 23 * 3600  # ~23시간
        logger.info("KIS WebSocket Approval Key 발급 완료")
        return self._approval_key

    # ──────── 종목 관리 ────────
    def add_stock(self, stock_code: str) -> None:
        """종목 추가 (연결 전/후 모두 가능)"""
        if stock_code not in self._buffers:
            self._buffers[stock_code] = StockCandleBuffer(
                stock_code, self.max_history
            )
        if self._ws and stock_code not in self._subscribed:
            self._pending_subscribe.add(stock_code)
        elif not self._ws:
            self._pending_subscribe.add(stock_code)

    def remove_stock(self, stock_code: str) -> None:
        """종목 제거"""
        self._pending_subscribe.discard(stock_code)
        if stock_code in self._subscribed and self._ws:
            asyncio.ensure_future(self._unsubscribe(stock_code))
        self._subscribed.discard(stock_code)

    def get_buffer(self, stock_code: str) -> Optional[StockCandleBuffer]:
        """종목의 캔들 버퍼 반환"""
        return self._buffers.get(stock_code)

    def get_candles(
        self, stock_code: str, n: Optional[int] = None, include_current: bool = True
    ) -> list[CandleBar]:
        """
        종목의 분봉 리스트 반환.

        Parameters
        ----------
        stock_code : 종목코드
        n : 최근 n개만 (None이면 전체)
        include_current : 현재(미완성) 캔들 포함 여부
        """
        buf = self._buffers.get(stock_code)
        if buf is None:
            return []
        if include_current:
            return buf.get_all_candles(n)
        return buf.get_history(n)

    # ──────── WebSocket 구독/해제 ────────
    async def _subscribe(self, stock_code: str) -> None:
        """H0STCNT0 (실시간 체결) 구독"""
        if not self._ws:
            return
        key = self._get_approval_key()
        msg = json.dumps({
            "header": {
                "approval_key": key,
                "custtype": "P",
                "tr_type": "1",
                "content-type": "utf-8",
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",
                    "tr_key": stock_code,
                }
            },
        })
        await self._ws.send(msg)
        self._subscribed.add(stock_code)
        logger.info(f"구독 요청: {stock_code} (H0STCNT0)")

    async def _unsubscribe(self, stock_code: str) -> None:
        """구독 해제"""
        if not self._ws:
            return
        key = self._get_approval_key()
        msg = json.dumps({
            "header": {
                "approval_key": key,
                "custtype": "P",
                "tr_type": "2",
                "content-type": "utf-8",
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",
                    "tr_key": stock_code,
                }
            },
        })
        await self._ws.send(msg)
        self._subscribed.discard(stock_code)
        logger.info(f"구독 해제: {stock_code}")

    # ──────── 틱 데이터 파싱 ────────
    def _parse_tick(self, raw: str) -> None:
        """
        KIS 실시간 체결 데이터 파싱.
        형식: 0|H0STCNT0|001|field0^field1^field2^...

        H0STCNT0 필드 순서 (^-구분):
          [0]  MKSC_SHRN_ISCD   종목코드
          [1]  STCK_CNTG_HOUR   체결시간 (HHMMSS)
          [2]  STCK_PRPR        현재가 (체결가)
          [3]  PRDY_VRSS_SIGN   전일대비부호
          [4]  PRDY_VRSS        전일대비
          [5]  PRDY_CTRT        전일대비율
          [6]  WGHN_AVRG_STCK_PRC  가중평균가
          [7]  STCK_OPRC        시가
          [8]  STCK_HGPR        고가
          [9]  STCK_LWPR        저가
          [10] ASKP1            매도호가1
          [11] BIDP1            매수호가1
          [12] CNTG_VOL         체결거래량 (이번 틱)
          [13] ACML_VOL         누적거래량
          [14] ACML_TR_PBMN     누적거래대금
          [15] SELN_CNTG_CSNU   매도체결건수
          [16] SHNU_CNTG_CSNU   매수체결건수
          [17] NTBY_CNTG_CSNU   순매수체결건수
          [18] CTTR             체결강도
          [19] SELN_CNTG_SMTN   총매도수량
          [20] SHNU_CNTG_SMTN   총매수수량
          [21] CCLD_DVSN        체결구분 (1:매수, 5:매도)
          ...
        """
        parts = raw.split("|")
        if len(parts) < 4:
            return

        encrypted = parts[0]
        tr_id = parts[1]

        if encrypted == "1":
            # 암호화 데이터 (체결 통보 등) — 시세가 아니므로 무시
            return

        if tr_id != "H0STCNT0":
            return

        fields = parts[3].split("^")
        if len(fields) < 14:
            return

        try:
            stock_code = fields[0]
            trade_time_str = fields[1]  # HHMMSS
            price = abs(float(fields[2]))
            cntg_vol = abs(int(fields[12]))  # 체결 거래량 (이번 틱)

            # 체결 시각 → datetime (오늘 날짜 + HHMMSS)
            today = datetime.now().date()
            h, m, s = int(trade_time_str[:2]), int(trade_time_str[2:4]), int(trade_time_str[4:6])
            trade_dt = datetime(today.year, today.month, today.day, h, m, s)

        except (ValueError, IndexError) as e:
            logger.warning(f"틱 파싱 오류: {e} | raw={raw[:100]}")
            return

        # 버퍼에 반영
        buf = self._buffers.get(stock_code)
        if buf is None:
            return

        closed_candle = buf.on_tick(price, cntg_vol, trade_dt)

        self._tick_count += 1
        self._last_tick_time = trade_dt

        # 콜백: 매 틱
        if self.on_tick:
            try:
                self.on_tick(stock_code, price, cntg_vol, trade_dt)
            except Exception as e:
                logger.error(f"on_tick 콜백 에러: {e}")

        # 콜백: 분봉 완성
        if closed_candle and self.on_candle_closed:
            self._candle_count += 1
            try:
                self.on_candle_closed(closed_candle)
            except Exception as e:
                logger.error(f"on_candle_closed 콜백 에러: {e}")

    # ──────── 메인 루프 ────────
    async def start(self) -> None:
        """WebSocket 연결 및 메시지 수신 루프 시작"""
        self._running = True
        logger.info("RealtimeCandleManager 시작")

        while self._running:
            try:
                await self._connect_and_listen()
            except Exception as e:
                logger.error(f"WebSocket 오류: {e}")

            if self._running:
                logger.info(f"{self._reconnect_delay}초 후 재연결...")
                await asyncio.sleep(self._reconnect_delay)

    async def _connect_and_listen(self) -> None:
        """단일 WebSocket 세션"""
        key = self._get_approval_key()

        async with websockets.connect(
            self.ws_url,
            ping_interval=None,  # KIS가 자체 PINGPONG 사용
            max_size=None,
        ) as ws:
            self._ws = ws
            logger.info(f"KIS WebSocket 연결 성공: {self.ws_url}")

            if self.on_connected:
                try:
                    self.on_connected()
                except Exception:
                    pass

            # 대기 중인 구독 처리
            for code in list(self._pending_subscribe):
                await self._subscribe(code)
            self._pending_subscribe.clear()

            # 메시지 수신 루프
            try:
                async for message in ws:
                    raw = message if isinstance(message, str) else message.decode("utf-8")

                    # PINGPONG 응답
                    if raw.startswith("{"):
                        try:
                            j = json.loads(raw)
                            header = j.get("header", {})
                            tr_id = header.get("tr_id", "")
                            if tr_id == "PINGPONG":
                                await ws.send(raw)  # PONG 응답
                                continue
                            msg1 = j.get("body", {}).get("msg1", "")
                            logger.debug(f"KIS 응답: {tr_id} - {msg1}")
                        except json.JSONDecodeError:
                            pass
                        continue

                    # 실시간 체결 데이터 파싱
                    if raw.startswith("0") or raw.startswith("1"):
                        self._parse_tick(raw)

            except websockets.ConnectionClosed as e:
                logger.warning(f"WebSocket 연결 종료: {e}")
            finally:
                self._ws = None
                self._subscribed.clear()
                if self.on_disconnected:
                    try:
                        self.on_disconnected()
                    except Exception:
                        pass

    def stop(self) -> None:
        """매니저 종료"""
        self._running = False
        if self._ws:
            asyncio.ensure_future(self._ws.close())
        logger.info("RealtimeCandleManager 종료 요청")

    # ──────── 유틸리티 ────────
    @property
    def stats(self) -> dict:
        """현재 통계 정보"""
        return {
            "is_connected": self._ws is not None,
            "subscribed_stocks": list(self._subscribed),
            "total_ticks": self._tick_count,
            "total_candles_closed": self._candle_count,
            "last_tick_time": (
                self._last_tick_time.strftime("%H:%M:%S")
                if self._last_tick_time
                else None
            ),
            "buffers": {
                code: {
                    "history_count": len(buf.history),
                    "current_candle": repr(buf.current) if buf.current else None,
                }
                for code, buf in self._buffers.items()
            },
        }


# ──────────────────────────────────────────────
# 사용 예시
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import os

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    APP_KEY = os.environ.get("KIS_APP_KEY", "")
    APP_SECRET = os.environ.get("KIS_APP_SECRET", "")

    if not APP_KEY or not APP_SECRET:
        print("환경변수 KIS_APP_KEY, KIS_APP_SECRET 를 설정해주세요.")
        print("  export KIS_APP_KEY='your_app_key'")
        print("  export KIS_APP_SECRET='your_app_secret'")
        exit(1)

    manager = RealtimeCandleManager(
        app_key=APP_KEY,
        app_secret=APP_SECRET,
        max_history=500,
    )

    # ── 콜백 설정 ──
    def on_candle_closed(candle: CandleBar):
        print(f"\n{'='*60}")
        print(f"  ✅ 1분봉 완성: {candle}")
        print(f"{'='*60}\n")

    def on_tick(stock_code: str, price: float, qty: int, trade_time: datetime):
        buf = manager.get_buffer(stock_code)
        current = buf.get_current() if buf else None
        if current:
            print(
                f"  💹 {stock_code} {trade_time:%H:%M:%S} "
                f"체결={price:,.0f}원 x {qty:,}주 | "
                f"분봉 O={current.open:,.0f} H={current.high:,.0f} "
                f"L={current.low:,.0f} C={current.close:,.0f} V={current.volume:,}"
            )

    def on_connected():
        print("\n🟢 KIS WebSocket 연결됨\n")

    def on_disconnected():
        print("\n🔴 KIS WebSocket 연결 끊김\n")

    manager.on_candle_closed = on_candle_closed
    manager.on_tick = on_tick
    manager.on_connected = on_connected
    manager.on_disconnected = on_disconnected

    # ── 종목 등록 ──
    # 원하는 종목 코드 추가
    STOCKS = ["005930", "000660", "373220"]  # 삼성전자, SK하이닉스, LG에너지솔루션
    for code in STOCKS:
        manager.add_stock(code)

    print(f"📊 실시간 1분봉 생성기 시작 (종목: {', '.join(STOCKS)})")
    print("   Ctrl+C 로 종료\n")

    # ── 실행 ──
    try:
        asyncio.run(manager.start())
    except KeyboardInterrupt:
        manager.stop()
        print("\n종료됨.")

        # 최종 캔들 출력
        for code in STOCKS:
            candles = manager.get_candles(code, n=5, include_current=True)
            if candles:
                print(f"\n[{code}] 최근 분봉:")
                for c in candles:
                    status = "⏳" if not c.is_closed else "✅"
                    print(f"  {status} {c}")


