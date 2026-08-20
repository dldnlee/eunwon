-- AI-structured 신청 방법 (application method) as an ordered step list, parsed at
-- sync time from bizinfo's free-text apply_method field. Purely additive.

alter table programs add column apply_steps text[] not null default '{}';
