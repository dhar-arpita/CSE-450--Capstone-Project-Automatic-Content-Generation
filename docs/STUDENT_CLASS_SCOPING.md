# Student class scoping — what has to change

**Decision:** a student belongs to exactly one class, chosen at signup, and can only
reach content for that class. No senior/junior class access.

Shreya owns the signup/login half (the class picker and writing `student.class_name`).
This document is everything *else* that has to change, because a filtered dropdown on
its own enforces nothing — every endpoint below currently accepts any `subject_id` from
any authenticated student.

---

## 1. The chokepoint: `_resolve_scope()`

`backend/routers/chat_router.py:49` already resolves `subject_id -> class_name` and
returns it in the dict. Adding the comparison there covers five endpoints at once:

- `POST /chat/qa/samples` (line 286)
- `POST /chat/qa/ask` (line 314)
- `POST /chat/practice/generate` (line 408)
- `POST /chat/practice/session/start` (line 472)
- `POST /chat/practice/session/next` (line 594)

The check: if the caller is a student, load `student.class_name` and 403 when it does
not match the resolved `class_name`. `_resolve_scope` does not currently take the user,
so it needs `current_user` (or the student's class) passed in.

## 2. Endpoints that bypass the chokepoint

These take scope ids but never call `_resolve_scope`, so they each need their own check:

- `POST /chat/qa/explain_more` (`chat_router.py:365`) — takes `topic_id`; resolve
  topic -> chapter -> subject -> class before answering.
- `POST /chat/quiz/generate` (`chat_router.py:829`) — passes `subject_id`,
  `chapter_id`, `topic_id` straight into the job payload at lines 848-850.

## 3. Session-bound endpoints have no ownership check at all

Separate from class scoping, and worse. `POST /chat/practice/session/hint` (line 501)
and `POST /chat/practice/session/answer` (line 553) take a `content_id` and a
`session_id` and verify **neither**. `answer` returns `content.answer_key` for any
content row in the database:

```
POST /chat/practice/session/answer  { "content_id": <any integer> }
-> the answer key for someone else's worksheet
```

Both need: the session belongs to `current_user`, and the content belongs to that
session. `practice_session_end` (line 633) already filters on
`LearningSession.student_id == current_user.user_id` — same pattern, applied to these.

## 4. The teacher generation endpoints are open to students

`backend/routers/generation.py` gates only the cache/seed endpoints with
`require_teacher_or_admin`. These use plain `get_current_user_from_header` with no role
check in the body, so any logged-in student can call them today for any class:

| Endpoint | Line |
| --- | --- |
| `POST /generate/worksheet` | 56 |
| `POST /generate/study-note` | 134 |
| `POST /generate/quiz` | 404 |
| `POST /generate/refine` | 357 |
| `POST /generate/quick-answer` | 516 |
| `GET /generate/download/{content_id}` | 191 |
| `GET /generate/worksheet/{content_id}` | 233 |

The comment at line 575 claims these are covered by `require_teacher_or_admin`. They
are not.

Per the team decision that admins do not generate content, the first five become
teacher-only. The two `GET`s by `content_id` need an ownership check instead, since a
student legitimately reads content assigned to them but should not be able to walk
`content_id` values belonging to anyone else.

## 5. Frontend (student UI)

- Class is no longer something the student picks per session — it comes from their
  profile. Drop any class selector from the student flows and scope the subject list to
  `student.class_name`.
- `GET /curriculum/classes` already exists and is what the signup picker reads from.
- Handle 403 from the endpoints above as a real state, not a crash. It should be
  unreachable through the UI, but stale tabs and cached ids will hit it.
- Existing students have `class_name = NULL` (signup never set it). Decide what they
  see: a one-time "pick your class" prompt is probably simplest. This also affects the
  admin stats, where NULL shows as an explicit "not set" bucket rather than being
  dropped.

## 6. Open question — who owns this

Sections 1-4 are backend, not student UI. They are the enforcement half of the signup
field Shreya is adding, but they sit in `chat_router.py` and `generation.py`, which are
not hers. Please settle ownership explicitly rather than assuming it is covered.

Section 3 in particular should not wait on the class-scoping work. It leaks answer keys
today, independent of any of this.
