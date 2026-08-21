-- 정부지원사업 매칭 서비스 — landing-page testimonials.
-- Placeholder/demo content: names are stored already masked (e.g. '김*원')
-- since these are fabricated sample reviews, not real user submissions.
-- Swap for real customer reviews (still masked the same way for privacy)
-- before public launch.

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  author_name   text not null,        -- pre-masked display name, e.g. '김*원'
  business_type text not null,        -- e.g. '카페 운영 · 서울 마포구'
  rating        int not null check (rating between 1 and 5),
  content       text not null,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index reviews_published_idx on reviews (is_published, created_at desc);

alter table reviews enable row level security;

-- reviews are public marketing content; writes are service-role only
create policy "published reviews are publicly readable"
  on reviews for select
  using (is_published = true);

insert into reviews (author_name, business_type, rating, content) values
('김*원', '카페 운영 · 서울 마포구', 5, '몰랐던 지원사업을 이렇게 많이 찾아주다니 놀랐어요. 신청서 초안까지 AI가 잡아줘서 시간이 정말 절약됐습니다.'),
('박*수', '제조업 · 경기 안산시', 5, '업력이랑 직원수까지 반영해서 진짜 신청 가능한 것만 골라주니까 헛수고할 일이 없어졌어요.'),
('이*진', 'IT 스타트업 대표 · 서울 강남구', 5, '마감 임박 알림이 진짜 유용해요. 놓칠 뻔한 사업을 이메일 덕분에 신청했습니다.'),
('최*영', '온라인 쇼핑몰 운영 · 부산 해운대구', 5, 'AI 요약이 공고문보다 훨씬 이해하기 쉬워서 좋아요. 지원사업 용어가 어려웠는데 도움이 많이 됐어요.'),
('정*훈', '미용실 운영 · 대구 수성구', 5, '소상공인인데도 저한테 맞는 사업이 이렇게 많은지 몰랐어요. 매칭 정확도에 감동했습니다.'),
('강*미', '공부방 운영 · 인천 남동구', 5, '중복수혜 확인 기능 덕분에 안 될 신청서에 시간 낭비하지 않았어요.'),
('조*현', '농업 (스마트팜) · 전남 나주시', 5, '지역 특화 지원사업까지 다 찾아줘서 신기했어요. 신청서 초안도 큰 도움이 됐습니다.'),
('윤*아', '배달대행업 · 대전 유성구', 5, '“왜 나에게 맞나요” 설명 기능이 신청 전에 확신을 줘서 좋았어요.'),
('임*석', '인테리어 시공 · 광주 서구', 5, '업종별로 딱 맞는 사업만 추려주니 예전처럼 하나하나 찾아볼 필요가 없어졌어요.'),
('한*주', '반려동물 용품점 · 경남 창원시', 5, '예비창업자 때부터 지금까지 계속 쓰고 있어요. 매달 새 사업 알림이 와서 놓치는 게 없습니다.');
