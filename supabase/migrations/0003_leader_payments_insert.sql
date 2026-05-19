-- Allow room leader to record payments for their room bills
-- This supports the workflow: leader is responsible for payments.

alter table public.payments enable row level security;

drop policy if exists payments_leader_insert on public.payments;
create policy payments_leader_insert on public.payments
  for insert
  with check (
    recorded_by = auth.uid()
    and paid_by = auth.uid()
    and exists (
      select 1
      from public.room_bills b
      where b.id = room_bill_id
        and public.is_room_leader(b.room_id)
    )
  );
