-- =============================================
-- Complete Database Schema — Final Version
-- =============================================
-- Changes from original:
--   1. Removed class_subject bridge table
--   2. Subject now has class_name directly
--   3. Chapter has chapter_no column
--   4. upload_request uses user_id instead of admin_id
--   5. saved_content has class_name FK
--   6. teacher_class.teacher_id fixed to INTEGER
-- =============================================

-- -------------------- Core User & Role Tables --------------------

CREATE TABLE "user" (
    user_id       SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password      VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class (
    class_name        VARCHAR(100) PRIMARY KEY,
    educational_level VARCHAR(100)
);

CREATE TABLE admin (
    admin_id INTEGER PRIMARY KEY REFERENCES "user"(user_id)
);

CREATE TABLE teacher (
    teacher_id INTEGER PRIMARY KEY REFERENCES "user"(user_id),
    join_date  DATE
);

CREATE TABLE student (
    student_id       INTEGER PRIMARY KEY REFERENCES "user"(user_id),
    class_name       VARCHAR(100) REFERENCES class(class_name),
    last_active_date TIMESTAMP
);

-- -------------------- Teacher Associations --------------------

CREATE TABLE teacher_class (
    teacher_id INTEGER REFERENCES teacher(teacher_id),
    class_name VARCHAR(100) REFERENCES class(class_name),
    PRIMARY KEY (teacher_id, class_name)
);

CREATE TABLE teacher_specialization (
    id              SERIAL PRIMARY KEY,
    teacher_id      INTEGER REFERENCES teacher(teacher_id),
    specialization  VARCHAR(255)
);

-- -------------------- Subject / Chapter / Topic --------------------

CREATE TABLE subject (
    subject_id   SERIAL PRIMARY KEY,
    subject_code VARCHAR(50) UNIQUE,
    name         VARCHAR(255) NOT NULL,
    class_name   VARCHAR(100) REFERENCES class(class_name),
    description  TEXT
);

CREATE TABLE chapter (
    chapter_id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subject(subject_id),
    chapter_no INTEGER,
    name       VARCHAR(255) NOT NULL
);

CREATE TABLE topic (
    topic_id   SERIAL PRIMARY KEY,
    chapter_id INTEGER REFERENCES chapter(chapter_id),
    name       VARCHAR(255) NOT NULL
);

CREATE TABLE learning_objective (
    obj_id      SERIAL PRIMARY KEY,
    topic_id    INTEGER REFERENCES topic(topic_id),
    description TEXT
);

-- -------------------- Sessions --------------------

CREATE TABLE learning_session (
    session_id        SERIAL PRIMARY KEY,
    student_id        INTEGER REFERENCES student(student_id),
    current_topic_id  INTEGER REFERENCES topic(topic_id),
    start_time        TIMESTAMP,
    end_time          TIMESTAMP,
    max_hints_allowed INTEGER
);

CREATE TABLE learning_session_topic (
    session_id INTEGER REFERENCES learning_session(session_id),
    topic_id   INTEGER REFERENCES topic(topic_id),
    PRIMARY KEY (session_id, topic_id)
);

CREATE TABLE teacher_session (
    session_id    SERIAL PRIMARY KEY,
    teacher_id    INTEGER REFERENCES teacher(teacher_id),
    started_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at      TIMESTAMP,
    last_modified TIMESTAMP
);

CREATE TABLE teacher_session_topic (
    session_id INTEGER REFERENCES teacher_session(session_id),
    topic_id   INTEGER REFERENCES topic(topic_id),
    PRIMARY KEY (session_id, topic_id)
);

-- -------------------- Upload & Ingestion Pipeline --------------------

CREATE TABLE upload_request (
    request_id   SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES "user"(user_id),
    subject_id   INTEGER REFERENCES subject(subject_id),
    file_name    VARCHAR(255),
    status       VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingestion_job (
    job_id        SERIAL PRIMARY KEY,
    request_id    INTEGER REFERENCES upload_request(request_id),
    error_message TEXT,
    job_status    VARCHAR(50),
    chunk_count   INTEGER DEFAULT 0
);

CREATE TABLE upload_metadata (
    metadata_id  SERIAL PRIMARY KEY,
    job_id       INTEGER REFERENCES ingestion_job(job_id),
    file_name    VARCHAR(255),
    file_type    VARCHAR(50),
    file_size    BIGINT,
    storage_path VARCHAR(500),
    upload_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------- Embeddings --------------------

CREATE TABLE content_embedding (
    embedding_id     SERIAL PRIMARY KEY,
    embedding_vector TEXT,
    metadata         TEXT,
    topic_id         INTEGER REFERENCES topic(topic_id),
    job_id           INTEGER REFERENCES ingestion_job(job_id)
);

-- -------------------- Generated Content & Feedback --------------------

CREATE TABLE generated_content (
    content_id          SERIAL PRIMARY KEY,
    learning_session_id INTEGER REFERENCES learning_session(session_id),
    teacher_session_id  INTEGER REFERENCES teacher_session(session_id),
    topic_id            INTEGER REFERENCES topic(topic_id),
    content_type        VARCHAR(100),
    difficulty_level    VARCHAR(50),
    display_body        TEXT,
    answer_key          TEXT,
    explanation         TEXT,
    generated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE worksheet_feedback (
    feedback_id   SERIAL PRIMARY KEY,
    content_id    INTEGER REFERENCES generated_content(content_id),
    teacher_id    INTEGER REFERENCES teacher(teacher_id),
    feedback_text TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_content (
    saved_content_id     SERIAL PRIMARY KEY,
    user_id              INTEGER REFERENCES "user"(user_id),
    content_id           INTEGER REFERENCES generated_content(content_id),
    is_assigned_to_class BOOLEAN DEFAULT FALSE,
    class_name           VARCHAR(100) REFERENCES class(class_name),
    timestamp            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_notes           TEXT,
    creator_role         VARCHAR(50) NOT NULL CHECK (creator_role IN ('admin', 'teacher', 'student'))
);

-- -------------------- Student Interaction & Remediation --------------------

CREATE TABLE student_interaction (
    interaction_id   SERIAL PRIMARY KEY,
    session_id       INTEGER REFERENCES learning_session(session_id),
    content_id       INTEGER REFERENCES generated_content(content_id),
    student_answer   TEXT,
    is_correct       BOOLEAN,
    hints_used       INTEGER DEFAULT 0,
    timestamp        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    difficulty_level VARCHAR(50),
    time_spent       INTEGER
);

CREATE TABLE remediation_decision_log (
    decision_id          SERIAL PRIMARY KEY,
    interaction_id       INTEGER REFERENCES student_interaction(interaction_id),
    action_type          VARCHAR(100),
    suggested_difficulty VARCHAR(50),
    weakness_tag         VARCHAR(255),
    mastery_score        NUMERIC(5,2),
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------- Topic Performance --------------------

CREATE TABLE topic_performance (
    performance_id   SERIAL PRIMARY KEY,
    student_id       INTEGER REFERENCES student(student_id),
    topic_id         INTEGER REFERENCES topic(topic_id),
    total_attempts   INTEGER DEFAULT 0,
    correct_answer   INTEGER DEFAULT 0,
    total_hints_used INTEGER DEFAULT 0,
    mastery_score    NUMERIC(5,2),
    last_practiced   TIMESTAMP
);