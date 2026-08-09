-- 신규 주문 문자 알림 스케줄 — 4시간마다 사이트의 알림 API를 호출
-- 사용법: 아래 <CRON_SECRET> 두 글자를 실제 값으로 바꾼 뒤,
--        Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 실행하세요.
--        (같은 값을 Vercel 환경변수 CRON_SECRET에도 넣어야 합니다)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 이미 등록돼 있으면 지우고 다시 등록 (재실행 안전)
select cron.unschedule('limfruits-notify-orders')
where exists (select 1 from cron.job where jobname = 'limfruits-notify-orders');

-- 매 4시간 정각(UTC 기준 0,4,8,12,16,20시 = KST 1,5,9,13,17,21시)에 호출
select cron.schedule(
  'limfruits-notify-orders',
  '0 */4 * * *',
  $$
  select net.http_post(
    url := 'https://limfruits.vercel.app/api/cron/notify-orders',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
  );
  $$
);

-- 등록 확인
select jobname, schedule, active from cron.job where jobname = 'limfruits-notify-orders';
